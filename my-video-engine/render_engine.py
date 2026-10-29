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
import os
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
    env = os.environ.copy()
    extra_paths = [str(Path.home() / "bin"), "/opt/homebrew/bin", "/usr/local/bin"]
    env["PATH"] = os.pathsep.join(extra_paths + [env.get("PATH", "")])
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        logger.error("Command failed: %s\n%s", " ".join(cmd), result.stderr)
        raise RuntimeError(f"Command failed ({cmd[0]}): {result.stderr[-2000:]}")


def _placeholder_image(scene: dict, width: int, height: int, out_path: Path) -> None:
    """Generate a rich cinematic atmospheric background with glowing bokeh orbs per scene."""
    import math
    from PIL import ImageFilter

    scene_id = int(scene.get("id", 1) or 1)
    palettes = [
        ((10, 15, 38), (30, 64, 175), (56, 189, 248)),
        ((24, 12, 42), (109, 40, 217), (244, 114, 182)),
        ((8, 28, 36), (13, 148, 136), (250, 204, 21)),
        ((32, 14, 24), (190, 18, 60), (251, 146, 60)),
        ((14, 22, 40), (67, 56, 202), (129, 140, 248)),
    ]
    base_rgb, mid_rgb, glow_rgb = palettes[(scene_id - 1) % len(palettes)]

    # Create smooth vertical gradient at 1/4 resolution then upscale for speed
    gw, gh = max(1, width // 4), max(1, height // 4)
    grad = Image.new("RGB", (gw, gh), base_rgb)
    g_draw = ImageDraw.Draw(grad)
    for y in range(gh):
        t = y / max(1, gh - 1)
        r = int(base_rgb[0] * (1 - t) + mid_rgb[0] * t * 0.75)
        g = int(base_rgb[1] * (1 - t) + mid_rgb[1] * t * 0.75)
        b = int(base_rgb[2] * (1 - t) + mid_rgb[2] * t * 0.75)
        g_draw.line([(0, y), (gw, y)], fill=(r, g, b))

    # Draw glowing ambient orbs
    for idx in range(3):
        angle = (scene_id * 1.3) + idx * 2.1
        cx = int(gw * (0.5 + 0.28 * math.cos(angle)))
        cy = int(gh * (0.38 + 0.22 * math.sin(angle)))
        rad = int(min(gw, gh) * (0.28 - idx * 0.05))
        color = glow_rgb if idx == 0 else mid_rgb
        g_draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=color)

    grad = grad.filter(ImageFilter.GaussianBlur(radius=28))
    img = grad.resize((width, height), Image.Resampling.BICUBIC)

    # Add subtle architectural grid & vignette accents
    draw = ImageDraw.Draw(img)
    step = max(60, min(width, height) // 12)
    grid_color = (
        min(255, base_rgb[0] + 28),
        min(255, base_rgb[1] + 32),
        min(255, base_rgb[2] + 45),
    )
    for x in range(0, width, step):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for y in range(0, height, step):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)

    img.save(out_path)


def _image_data_uri(path: Path) -> str:
    ext = path.suffix.lstrip(".").lower()
    mime = "jpeg" if ext in ("jpg", "jpeg") else ext
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/{mime};base64,{data}"


def _resolve_asset(cfg, rel_path: str | None) -> Path | None:
    if not rel_path:
        return None
    p1 = cfg.project_root / rel_path
    if p1.exists():
        return p1
    p2 = cfg.project_root / "public" / rel_path
    if p2.exists():
        return p2
    return None


def _is_video_media(media_path: Path | None) -> bool:
    if not media_path:
        return False
    return media_path.suffix.lower() in (".mp4", ".webm", ".mov", ".mkv")


def _build_scene_html(
    scene: dict,
    image_path: Path | None,
    words: list[dict],
    duration_seconds: float,
    cfg,
    width: int,
    height: int,
    language: str,
    font_family: str,
    transparent_bg: bool = False,
) -> str:
    template = string.Template(TEMPLATE_PATH.read_text(encoding="utf-8"))
    return template.safe_substitute(
        WIDTH=width,
        HEIGHT=height,
        FONT_FAMILY=font_family,
        FONT_SIZE_PX=cfg.get("render", "subtitle", "font_size_px", default=64),
        STROKE_PX=cfg.get("render", "subtitle", "stroke_px", default=6),
        HIGHLIGHT_COLOR=cfg.get("render", "subtitle", "highlight_color", default="#FFD400"),
        IMAGE_DATA_URI="" if transparent_bg or not image_path else _image_data_uri(image_path),
        DURATION_SECONDS=duration_seconds,
        END_SCALE=cfg.get("render", "kenburns_end_scale", default=1.1),
        LANGUAGE_JSON=json.dumps((language or "vi").split("-")[0].lower()),
        SCENE_TYPE_JSON=json.dumps(scene.get("type", "narrative")),
        LESSON_TITLE_JSON=json.dumps(scene.get("title", ""), ensure_ascii=False),
        SCENE_TEXT_JSON=json.dumps(scene.get("text", ""), ensure_ascii=False),
        TRANSPARENT_BG_JSON=json.dumps(bool(transparent_bg)),
        WORDS_JSON=json.dumps(words, ensure_ascii=False),
        HIGHLIGHT_WORDS_JSON=json.dumps(scene.get("highlightWords", []), ensure_ascii=False),
    )


def _render_scene_frames(
    page, html: str, duration_seconds: float, fps: int, frames_dir: Path, transparent_bg: bool = False
) -> int:
    frames_dir.mkdir(parents=True, exist_ok=True)
    page.set_content(html)
    total_frames = max(1, round(duration_seconds * fps))
    for i in range(total_frames):
        t = i / fps
        page.evaluate("t => window.setFrame(t)", t)
        if transparent_bg:
            page.screenshot(path=str(frames_dir / f"{i:06d}.png"), omit_background=True)
        else:
            page.screenshot(path=str(frames_dir / f"{i:06d}.jpg"), type="jpeg", quality=92)
    return total_frames


def _probe_video_duration(video_path: Path) -> float:
    env = os.environ.copy()
    extra_paths = [str(Path.home() / "bin"), "/opt/homebrew/bin", "/usr/local/bin"]
    env["PATH"] = os.pathsep.join(extra_paths + [env.get("PATH", "")])
    try:
        res = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            env=env,
            timeout=8,
        )
        if res.returncode == 0 and res.stdout.strip():
            return float(res.stdout.strip())
    except Exception:
        pass
    return 0.0


def _fit_image_single_layer(image_path: Path, width: int, height: int, tmp_root: Path, scene_id) -> Path:
    """
    Ensure every still image renders as a 100% single-layer full-screen frame
    with ZERO 3-tier blur bars and ZERO liquid glass boxes.
    If an illustration has a uniform paper/canvas background (e.g. 2D hand-drawn cream paper)
    and differs in aspect ratio, seamlessly extend the exact paper color to fill width x height.
    """
    try:
        im = Image.open(image_path).convert("RGB")
        iw, ih = im.size
        target_ratio = width / max(1, height)
        src_ratio = iw / max(1, ih)
        if abs(src_ratio - target_ratio) / target_ratio < 0.18:
            return image_path

        # Sample corners to check if this is a uniform paper/canvas illustration
        corners = [
            im.getpixel((min(iw - 1, 12), min(ih - 1, 12))),
            im.getpixel((max(0, iw - 13), min(ih - 1, 12))),
            im.getpixel((min(iw - 1, 12), max(0, ih - 13))),
            im.getpixel((max(0, iw - 13), max(0, ih - 13))),
        ]
        avg_r = sum(c[0] for c in corners) // 4
        avg_g = sum(c[1] for c in corners) // 4
        avg_b = sum(c[2] for c in corners) // 4
        max_diff = max(abs(c[0] - avg_r) + abs(c[1] - avg_g) + abs(c[2] - avg_b) for c in corners)

        if max_diff < 55:
            # Uniform paper/canvas background -> seamless single-sheet canvas extension!
            canvas = Image.new("RGB", (width, height), (avg_r, avg_g, avg_b))
            scale = min(width / iw, (height * 0.72) / ih)
            nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
            resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
            px = (width - nw) // 2
            py = int((height - nh) * 0.42)
            canvas.paste(resized, (px, py))
            out_p = tmp_root / f"seamless_single_{scene_id}.png"
            canvas.save(out_p)
            return out_p
    except Exception as exc:
        logger.warning("Could not pre-fit image %s: %s", image_path, exc)
    return image_path


def _encode_scene(
    frames_dir: Path,
    audio_path: Path | None,
    duration_seconds: float,
    fps: int,
    out_path: Path,
    video_bg_path: Path | None = None,
    width: int = 1080,
    height: int = 1920,
) -> None:
    if video_bg_path and video_bg_path.exists():
        v_dur = _probe_video_duration(video_bg_path)
        stretch_pts = ""
        use_loop = True
        if v_dur > 0.5 and v_dur < duration_seconds <= v_dur * 1.85:
            ratio = (duration_seconds + 0.15) / v_dur
            stretch_pts = f"setpts={ratio:.4f}*PTS,"
            use_loop = False

        cmd = ["ffmpeg", "-y"]
        if use_loop:
            cmd += ["-stream_loop", "-1"]
        cmd += [
            "-i", str(video_bg_path),
            "-framerate", str(fps), "-i", str(frames_dir / "%06d.png"),
        ]
        if audio_path and audio_path.exists():
            cmd += ["-i", str(audio_path)]
        else:
            cmd += [
                "-f", "lavfi",
                "-t", f"{duration_seconds:.3f}",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            ]
        cmd += [
            "-filter_complex",
            f"[0:v]{stretch_pts}scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={fps},setsar=1[bg];"
            f"[bg][1:v]overlay=0:0:shortest=1[v]",
            "-map", "[v]", "-map", "2:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "-shortest",
            str(out_path),
        ]
        _run(cmd)
        return

    cmd = ["ffmpeg", "-y", "-framerate", str(fps), "-i", str(frames_dir / "%06d.jpg")]
    if audio_path and audio_path.exists():
        cmd += ["-i", str(audio_path)]
    else:
        # Ensure every scene has an audio stream so acrossfade never fails on lesson scenes
        cmd += [
            "-f", "lavfi",
            "-t", f"{duration_seconds:.3f}",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        ]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "-shortest", str(out_path)]
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
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-movflags", "+faststart",
                str(merged),
            ])
            current = merged
            running_duration = offset + next_duration
        shutil.copy(current, out_path)


def render_video(data_file=None, output_file=None) -> Path:
    cfg = load_config()
    fps = cfg.get("fps", default=30)
    crossfade_seconds = cfg.get("render", "crossfade_seconds", default=0.5)

    data_file = Path(data_file) if data_file else cfg.path("data_file")
    output_file = Path(output_file) if output_file else cfg.path("output_dir") / "final.mp4"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("meta", {})
    fps = int(meta.get("fps") or fps)
    aspect_ratio = meta.get("aspectRatio", "9:16")
    if aspect_ratio == "16:9":
        width, height = 1920, 1080
    else:
        width = cfg.get("resolution", "width", default=1080)
        height = cfg.get("resolution", "height", default=1920)

    market_code = meta.get("market", "VI")
    m_cfg = cfg.market(market_code)
    language = meta.get("language") or m_cfg.get("language", "vi")
    font_family = m_cfg.get("font_family") or cfg.get("render", "subtitle", "font_family", default="sans-serif")

    scenes = data["scenes"]
    if not scenes:
        raise ValueError("video_data.json has no scenes")

    with tempfile.TemporaryDirectory() as tmp_root:
        tmp_root = Path(tmp_root)
        scene_videos = []
        scene_durations = []

        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch()
            except Exception:
                chrome_path = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
                if chrome_path.exists():
                    browser = pw.chromium.launch(executable_path=str(chrome_path))
                else:
                    browser = pw.chromium.launch(channel="chrome")
            page = browser.new_page(viewport={"width": width, "height": height})

            for scene in scenes:
                scene_id = scene["id"]
                logger.info("Rendering scene %s (market=%s, aspect=%s)", scene_id, market_code, aspect_ratio)

                media_path = _resolve_asset(cfg, scene.get("mediaFile"))
                is_video_bg = _is_video_media(media_path)
                image_path = None
                if media_path and not is_video_bg:
                    image_path = _fit_image_single_layer(media_path, width, height, tmp_root, scene_id)
                elif not media_path:
                    logger.warning("Scene %s has no media yet — using placeholder image", scene_id)
                    image_path = tmp_root / f"placeholder_{scene_id}.png"
                    _placeholder_image(scene, width, height, image_path)

                words_path = _resolve_asset(cfg, scene.get("wordTimestamps"))
                words = []
                if words_path:
                    with open(words_path, "r", encoding="utf-8") as f:
                        words = json.load(f)
                elif scene.get("text") and scene.get("type") != "lesson":
                    # Fallback word tokens if wordTimestamps JSON wasn't generated yet
                    raw_text = scene["text"].strip()
                    dur = max(1.0, (scene.get("durationInFrames") or (4 * fps)) / fps)
                    if language.startswith("ja") and " " not in raw_text:
                        toks = [raw_text[i : i + 3] for i in range(0, len(raw_text), 3)]
                    else:
                        toks = [t for t in raw_text.split() if t]
                    step = dur / max(1, len(toks))
                    words = [
                        {"word": tok, "start": round(idx * step, 3), "end": round((idx + 1) * step, 3)}
                        for idx, tok in enumerate(toks)
                    ]

                duration_seconds = max(1.0, (scene.get("durationInFrames") or (4 * fps)) / fps)
                html = _build_scene_html(
                    scene,
                    image_path,
                    words,
                    duration_seconds,
                    cfg,
                    width=width,
                    height=height,
                    language=language,
                    font_family=font_family,
                    transparent_bg=is_video_bg,
                )

                frames_dir = tmp_root / f"frames_{scene_id}"
                _render_scene_frames(page, html, duration_seconds, fps, frames_dir, transparent_bg=is_video_bg)

                audio_path = _resolve_asset(cfg, scene.get("audioFile"))

                scene_out = tmp_root / f"scene_{scene_id}.mp4"
                _encode_scene(
                    frames_dir,
                    audio_path,
                    duration_seconds,
                    fps,
                    scene_out,
                    video_bg_path=media_path if is_video_bg else None,
                    width=width,
                    height=height,
                )
                scene_videos.append(scene_out)
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

