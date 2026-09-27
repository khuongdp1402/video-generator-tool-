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

import edge_tts
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


def generate_voiceover(text: str, audio_path, voice: str | None = None, rate: str | None = None):
    cfg = load_config()
    voice = voice or cfg.get("tts", "voice")
    rate = rate or cfg.get("tts", "rate")
    asyncio.run(_synthesize(text, voice, rate, audio_path))


def align_words(audio_path, expected_text: str | None = None) -> list[dict]:
    """
    Run Whisper on the generated audio to get word-level timestamps.
    Returns a list of {"word": str, "start": float, "end": float} (seconds).
    """
    cfg = load_config()
    model = _get_whisper_model(cfg)
    result = model.transcribe(str(audio_path), word_timestamps=True, language="vi")

    words = []
    for segment in result.get("segments", []):
        for w in segment.get("words", []):
            words.append(
                {
                    "word": w["word"].strip(),
                    "start": round(w["start"], 3),
                    "end": round(w["end"], 3),
                }
            )
    return words


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

    voice = data.get("meta", {}).get("voice") or cfg.get("tts", "voice")
    rate = data.get("meta", {}).get("voiceRate") or cfg.get("tts", "rate")

    for scene in data["scenes"]:
        scene_id = scene["id"]
        text = scene["text"]
        logger.info("[Scene %s] Synthesizing voiceover: %s", scene_id, text[:60])

        audio_path = audio_dir / f"scene_{scene_id}.mp3"
        words_path = audio_dir / f"scene_{scene_id}_words.json"

        generate_voiceover(text, audio_path, voice=voice, rate=rate)

        duration_seconds = MP3(audio_path).info.length
        duration_frames = int((duration_seconds + padding_seconds) * fps)

        logger.info("[Scene %s] Aligning words with Whisper...", scene_id)
        words = align_words(audio_path, expected_text=text)
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

    total_frames = sum(s["durationInFrames"] for s in data["scenes"])
    logger.info("Done. Total duration: %.1fs (%d frames)", total_frames / fps, total_frames)
    return data


if __name__ == "__main__":
    process_scenario()
