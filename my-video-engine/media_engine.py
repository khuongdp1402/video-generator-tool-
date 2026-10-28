"""
Module 3: Audio & Sync Engine.
Generates TTS voiceover per scene (edge-tts) and aligns it to word-level
timestamps using a local Whisper model — replacing the old approach of
trusting edge-tts's own WordBoundary events, which came back empty for
some voices/scenes in practice.
"""

from __future__ import annotations

import asyncio
import json
import urllib.parse
from pathlib import Path

import edge_tts
import requests
import whisper
from mutagen.mp3 import MP3

from config_manager import get_logger, load_config

logger = get_logger(__name__)

_whisper_model = None


def _get_whisper_model(cfg):
    global _whisper_model
    if _whisper_model is None:
        model_name = cfg.get("whisper", "model", default="base")
        logger.info("Loading Whisper model %r (first call only)...", model_name)
        _whisper_model = whisper.load_model(model_name)
    return _whisper_model


async def _synthesize(text: str, voice: str, rate: str, audio_path):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(audio_path))


def _google_tts_fallback(text: str, voice: str, audio_path) -> None:
    prefix = (voice or "en-US").split("-")[0].lower()
    tl = "en" if prefix == "en" else ("ja" if prefix == "ja" else "vi")
    chunks = [text[i : i + 150] for i in range(0, len(text), 150)] or [text]
    audio_bytes = bytearray()
    for chunk in chunks:
        q = urllib.parse.quote(chunk)
        last_err = None
        for client_id in ("gtx", "tw-ob"):
            try:
                url = f"https://translate.googleapis.com/translate_tts?ie=UTF-8&client={client_id}&tl={tl}&q={q}"
                resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
                resp.raise_for_status()
                audio_bytes.extend(resp.content)
                last_err = None
                break
            except Exception as e:
                last_err = e
        if last_err is not None:
            raise last_err
    with open(audio_path, "wb") as f:
        f.write(audio_bytes)


def _macos_say_fallback(text: str, voice: str, audio_path) -> None:
    import os
    import subprocess
    import tempfile

    prefix = (voice or "en-US").split("-")[0].lower()
    say_voice = {"ja": "Kyoko", "en": "Samantha", "vi": "Linh"}.get(prefix, "Samantha")
    env = os.environ.copy()
    env["PATH"] = os.pathsep.join([str(Path.home() / "bin"), "/opt/homebrew/bin", "/usr/local/bin", env.get("PATH", "")])
    with tempfile.TemporaryDirectory() as tmp:
        aiff = Path(tmp) / "out.aiff"
        subprocess.run(["say", "-v", say_voice, "-o", str(aiff), text], check=True, env=env)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(aiff), "-codec:a", "libmp3lame", "-qscale:a", "4", str(audio_path)],
            check=True, capture_output=True, env=env,
        )


def generate_voiceover(text: str, audio_path, voice: str | None = None, rate: str | None = None):
    cfg = load_config()
    voice = voice or cfg.get("tts", "voice")
    rate = rate or cfg.get("tts", "rate")
    try:
        asyncio.run(_synthesize(text, voice, rate, audio_path))
    except Exception as exc:
        logger.warning("edge-tts failed (%s), falling back to Google TTS for voice=%s", exc, voice)
        try:
            _google_tts_fallback(text, voice, audio_path)
        except Exception as exc2:
            logger.warning("Google TTS failed (%s), falling back to macOS 'say'", exc2)
            _macos_say_fallback(text, voice, audio_path)


def align_words(audio_path, expected_text: str | None = None, language: str = "vi") -> list[dict]:
    """
    Run Whisper on the generated audio to get word-level timestamps.
    Supports 'en' (US), 'ja' (Japan), and 'vi' (Vietnam).
    Returns a list of {"word": str, "start": float, "end": float} (seconds).
    """
    cfg = load_config()
    lang_code = (language or "vi").split("-")[0].lower()
    try:
        model = _get_whisper_model(cfg)
        result = model.transcribe(str(audio_path), word_timestamps=True, language=lang_code)

        words = []
        for segment in result.get("segments", []):
            for w in segment.get("words", []):
                token = w["word"].strip()
                if token:
                    words.append(
                        {
                            "word": token,
                            "start": round(float(w["start"]), 3),
                            "end": round(float(w["end"]), 3),
                        }
                    )
        if words:
            return words
    except Exception as exc:
        logger.warning("Whisper alignment fallback (%s): %s", lang_code, exc)

    # Fallback: uniform timing across tokens if Whisper returns empty or fails
    if not expected_text:
        return []
    duration = MP3(audio_path).info.length
    if lang_code == "ja" and " " not in expected_text.strip():
        # Split Japanese text into 2-4 char chunks for readable karaoke progression
        raw_text = expected_text.strip()
        tokens = [raw_text[i : i + 3] for i in range(0, len(raw_text), 3)]
    else:
        tokens = [t for t in expected_text.strip().split() if t]
    if not tokens:
        return []
    step = duration / len(tokens)
    return [
        {
            "word": tok,
            "start": round(idx * step, 3),
            "end": round((idx + 1) * step, 3),
        }
        for idx, tok in enumerate(tokens)
    ]


def process_scenario(data_file=None) -> dict:
    """
    For every scene in video_data.json: synthesize voiceover, align words with
    Whisper, and update audioFile / durationInFrames / wordTimestamps in place.
    """
    cfg = load_config()
    fps = cfg.get("fps", default=30)
    padding_seconds = cfg.get("tts", "padding_seconds", default=0.5)
    data_file = data_file or cfg.path("data_file")
    audio_dir = cfg.path("audio_dir")

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("meta", {})
    market_code = meta.get("market", "VI")
    m_cfg = cfg.market(market_code)
    language = meta.get("language") or m_cfg.get("language", "vi")
    voice = meta.get("voice") or m_cfg.get("voice") or cfg.get("tts", "voice")
    rate = meta.get("voiceRate") or m_cfg.get("rate") or cfg.get("tts", "rate")

    for scene in data["scenes"]:
        scene_id = scene["id"]
        if scene.get("type") == "lesson":
            if not scene.get("durationInFrames"):
                scene["durationInFrames"] = 4 * fps
            continue

        text = (scene.get("text") or "").strip()
        if not text:
            continue

        logger.info(
            "[Scene %s] Synthesizing voiceover (market=%s, lang=%s, voice=%s): %s",
            scene_id,
            market_code,
            language,
            voice,
            text[:60],
        )

        audio_path = audio_dir / f"scene_{scene_id}.mp3"
        words_path = audio_dir / f"scene_{scene_id}_words.json"

        generate_voiceover(text, audio_path, voice=voice, rate=rate)

        duration_seconds = MP3(audio_path).info.length
        duration_frames = int((duration_seconds + padding_seconds) * fps)

        logger.info("[Scene %s] Aligning words with Whisper (lang=%s)...", scene_id, language)
        words = align_words(audio_path, expected_text=text, language=language)
        with open(words_path, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)

        scene["audioFile"] = str(audio_path.relative_to(cfg.project_root))
        scene["wordTimestamps"] = str(words_path.relative_to(cfg.project_root))
        scene["durationInFrames"] = duration_frames

        logger.info(
            "[Scene %s] %.2fs = %d frames, %d words aligned",
            scene_id,
            duration_seconds,
            duration_frames,
            len(words),
        )

    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_frames = sum(s.get("durationInFrames", 0) for s in data["scenes"])
    logger.info("Done. Total duration: %.1fs (%d frames)", total_frames / fps, total_frames)
    return data


if __name__ == "__main__":
    process_scenario()

