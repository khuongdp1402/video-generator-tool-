"""
Module 4: Render Engine (commercial grade).
Renders each scene as an HTML page (static image + CSS Ken Burns zoom +
word-synced karaoke subtitles), captures it frame-by-frame with Playwright
using a virtual clock (deterministic, not real-time — avoids frame drops),
encodes each scene with FFmpeg, then stitches all scenes together with a
crossfade transition. No MoviePy: text rendering through real CSS/fonts
looks far less robotic, and Playwright + FFmpeg carry no per-seat/company
licensing cost for a commercial product.
"""

from __future__ import annotations

import base64
import json
import shutil
import string
import subprocess
import tempfile
from pathlib import Path

from mutagen.mp3 import MP3
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

from config_manager import get_logger, load_config

logger = get_logger(__name__)

TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "scene_template.html"


def _run(cmd: list[str]) -> None:
    logger.info("$ %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("Command failed: %s\n%s", " ".join(cmd), result.stderr)
        raise RuntimeError(f"Command failed ({cmd[0]}): {result.stderr[-2000:]}")


def _placeholder_image(scene: dict, width: int, height: int, out_path: Path) -> None:
    """Generate a readable placeholder so rendering never crashes on missing media."""
    img = Image.new("RGB", (width, height), color=(20, 12, 30))
    draw = ImageDraw.Draw(img)
    prompt = scene.get("imagePrompt", "")
    text = f"[Scene {scene['id']} - image pending]\n\n{prompt}"
    draw.multiline_text((60, height // 2 - 100), text, fill=(180, 170, 200), spacing=12)
    img.save(out_path)


def _image_data_uri(path: Path) -> str:
    ext = path.suffix.lstrip(".").lower()
    mime = "jpeg" if ext in ("jpg", "jpeg") else ext
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/{mime};base64,{data}"


def _build_scene_html(scene: dict, image_path: Path, words: list[dict], duration_seconds: float, cfg) -> str:
    template = string.Template(TEMPLATE_PATH.read_text(encoding="utf-8"))
    width = cfg.get("resolution", "width", default=1080)
    height = cfg.get("resolution", "height", default=1920)
    return template.safe_substitute(
        WIDTH=width,
        HEIGHT=height,
        FONT_FAMILY=cfg.get("render", "subtitle", "font_family", default="sans-serif"),
        FONT_SIZE_PX=cfg.get("render", "subtitle", "font_size_px", default=64),
        STROKE_PX=cfg.get("render", "subtitle", "stroke_px", default=6),
        HIGHLIGHT_COLOR=cfg.get("render", "subtitle", "highlight_color", default="#FFD400"),
        IMAGE_DATA_URI=_image_data_uri(image_path),
        DURATION_SECONDS=duration_seconds,
        END_SCALE=cfg.get("render", "kenburns_end_scale", default=1.1),
        WORDS_JSON=json.dumps(words, ensure_ascii=False),
        HIGHLIGHT_WORDS_JSON=json.dumps(scene.get("highlightWords", []), ensure_ascii=False),
    )


def _render_scene_frames(page, html: str, duration_seconds: float, fps: int, frames_dir: Path) -> int:
    frames_dir.mkdir(parents=True, exist_ok=True)
    page.set_content(html)
    total_frames = max(1, round(duration_seconds * fps))
    for i in range(total_frames):
        t = i / fps
        page.evaluate("t => window.setFrame(t)", t)
        page.screenshot(path=str(frames_dir / f"{i:06d}.png"))
    return total_frames


def _encode_scene(frames_dir: Path, audio_path: Path | None, fps: int, out_path: Path) -> None:
    cmd = ["ffmpeg", "-y", "-framerate", str(fps), "-i", str(frames_dir / "%06d.png")]
    if audio_path and audio_path.exists():
        cmd += ["-i", str(audio_path)]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if audio_path and audio_path.exists():
        cmd += ["-c:a", "aac", "-shortest"]
    cmd += [str(out_path)]
    _run(cmd)


def _crossfade_concat(
    scene_videos: list[Path], scene_durations: list[float], crossfade_seconds: float, out_path: Path
) -> None:
    """
    scene_durations are the *encoded* clip durations (audio length, since each
    scene is encoded with -shortest against its own audio) — known up front
    from the render loop, so no ffprobe dependency is needed here.
    """
    if len(scene_videos) == 1:
        shutil.copy(scene_videos[0], out_path)
        return

    current = scene_videos[0]
    running_duration = scene_durations[0]

    with tempfile.TemporaryDirectory() as tmp:
        for idx, (next_clip, next_duration) in enumerate(zip(scene_videos[1:], scene_durations[1:]), start=1):
            offset = max(0.0, running_duration - crossfade_seconds)
            merged = Path(tmp) / f"merged_{idx}.mp4"
            _run([
                "ffmpeg", "-y",
                "-i", str(current), "-i", str(next_clip),
                "-filter_complex",
                f"[0:v][1:v]xfade=transition=fade:duration={crossfade_seconds}:offset={offset}[v];"
                f"[0:a][1:a]acrossfade=d={crossfade_seconds}[a]",
                "-map", "[v]", "-map", "[a]",
                str(merged),
            ])
            current = merged
            running_duration = offset + next_duration
        shutil.copy(current, out_path)


def render_video(data_file=None, output_file=None) -> Path:
    cfg = load_config()
    fps = cfg.get("fps", default=30)
    width = cfg.get("resolution", "width", default=1080)
    height = cfg.get("resolution", "height", default=1920)
    crossfade_seconds = cfg.get("render", "crossfade_seconds", default=0.5)

    data_file = Path(data_file) if data_file else cfg.path("data_file")
    output_file = Path(output_file) if output_file else cfg.path("output_dir") / "final.mp4"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    scenes = data["scenes"]
    if not scenes:
        raise ValueError("video_data.json has no scenes")

    with tempfile.TemporaryDirectory() as tmp_root:
        tmp_root = Path(tmp_root)
        scene_videos = []
        scene_durations = []

        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": width, "height": height})

            for scene in scenes:
                scene_id = scene["id"]
                logger.info("Rendering scene %s", scene_id)

                media_file = scene.get("mediaFile")
                if media_file and (cfg.project_root / media_file).exists():
                    image_path = cfg.project_root / media_file
                else:
                    logger.warning("Scene %s has no media yet — using placeholder image", scene_id)
                    image_path = tmp_root / f"placeholder_{scene_id}.png"
                    _placeholder_image(scene, width, height, image_path)

                words_file = scene.get("wordTimestamps")
                words = []
                if words_file and (cfg.project_root / words_file).exists():
                    with open(cfg.project_root / words_file, "r", encoding="utf-8") as f:
                        words = json.load(f)

                duration_seconds = scene["durationInFrames"] / fps
                html = _build_scene_html(scene, image_path, words, duration_seconds, cfg)

                frames_dir = tmp_root / f"frames_{scene_id}"
                _render_scene_frames(page, html, duration_seconds, fps, frames_dir)

                audio_path = None
                if scene.get("audioFile"):
                    candidate = cfg.project_root / scene["audioFile"]
                    if candidate.exists():
                        audio_path = candidate

                scene_out = tmp_root / f"scene_{scene_id}.mp4"
                _encode_scene(frames_dir, audio_path, fps, scene_out)
                scene_videos.append(scene_out)
                # -shortest in _encode_scene trims to the audio when present (no padding tail),
                # otherwise the clip is exactly the rendered frame count.
                scene_durations.append(MP3(audio_path).info.length if audio_path else duration_seconds)

                shutil.rmtree(frames_dir, ignore_errors=True)

            browser.close()

        logger.info("Stitching %d scenes with %.1fs crossfade", len(scene_videos), crossfade_seconds)
        _crossfade_concat(scene_videos, scene_durations, crossfade_seconds, output_file)

    logger.info("Render complete: %s", output_file)
    return output_file


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--data", dest="data_file", default=None)
    parser.add_argument("--output", dest="output_file", default=None)
    args = parser.parse_args()

    result_path = render_video(args.data_file, args.output_file)
    print(str(result_path))
