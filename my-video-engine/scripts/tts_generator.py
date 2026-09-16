#!/usr/bin/env python3
"""
TTS Generator for AI Video Engine.
Reads video_data.json, generates audio for each scene using edge-tts,
captures word-level timestamps via WordBoundary events,
and updates the JSON with accurate frame durations.
"""

import asyncio
import json
import os
import sys
import time

# Ensure proper utf-8 encoding on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import edge_tts
from mutagen.mp3 import MP3

# Paths relative to project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(PROJECT_ROOT, "src", "data", "video_data.json")
AUDIO_DIR = os.path.join(PROJECT_ROOT, "public", "audio")

FPS = 30
PADDING_FRAMES = 15  # 0.5s padding after each scene
MAX_RETRIES = 3
RETRY_DELAY = 3  # seconds between retries


async def generate_with_stream(text, voice, rate, audio_path, words_path):
    """
    Try streaming method to get word boundaries + audio.
    """
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    word_timestamps = []
    audio_chunks = bytearray()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            word_data = chunk.get("data", chunk)
            offset_ticks = word_data.get("offset", 0)
            duration_ticks = word_data.get("duration", 0)
            word_text = word_data.get("text", "")
            word_timestamps.append({
                "word": word_text,
                "offset": offset_ticks / 10000,
                "duration": duration_ticks / 10000,
            })

    if len(audio_chunks) == 0:
        raise RuntimeError("No audio data received from stream")

    with open(audio_path, "wb") as f:
        f.write(bytes(audio_chunks))

    with open(words_path, "w", encoding="utf-8") as f:
        json.dump(word_timestamps, f, ensure_ascii=False, indent=2)

    return word_timestamps


async def generate_with_save(text, voice, rate, audio_path, words_path):
    """
    Fallback: use simple save method (no word timestamps).
    """
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(audio_path)

    with open(words_path, "w", encoding="utf-8") as f:
        json.dump([], f)

    return []


async def generate_scene_audio(scene, voice, rate):
    """
    Generate TTS audio for a single scene. Tries stream method first,
    falls back to save method on error.
    """
    scene_id = scene["id"]
    text = scene["text"]
    audio_path = os.path.join(AUDIO_DIR, f"scene_{scene_id}.mp3")
    words_path = os.path.join(AUDIO_DIR, f"scene_{scene_id}_words.json")

    print(f"  [Scene {scene_id}] Generating: \"{text[:60]}\"")

    word_timestamps = None

    # Try stream method with retries
    for attempt in range(MAX_RETRIES):
        try:
            word_timestamps = await generate_with_stream(
                text, voice, rate, audio_path, words_path
            )
            break
        except Exception as e:
            print(f"  [Scene {scene_id}] ⚠ Stream attempt {attempt + 1}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY)

    # Fallback to save method
    if word_timestamps is None:
        print(f"  [Scene {scene_id}] Using save fallback...")
        for attempt in range(MAX_RETRIES):
            try:
                word_timestamps = await generate_with_save(
                    text, voice, rate, audio_path, words_path
                )
                break
            except Exception as e:
                print(f"  [Scene {scene_id}] ⚠ Save attempt {attempt + 1}/{MAX_RETRIES}: {e}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY)

    if word_timestamps is None:
        print(f"  [Scene {scene_id}] ✗ All methods failed. Using default duration.")
        scene["audioFile"] = ""
        return scene

    # Calculate duration in frames
    audio_info = MP3(audio_path)
    duration_seconds = audio_info.info.length
    duration_frames = int(duration_seconds * FPS) + PADDING_FRAMES

    print(f"  [Scene {scene_id}] ✓ {duration_seconds:.2f}s = {duration_frames} frames, {len(word_timestamps)} words")

    scene["audioFile"] = f"audio/scene_{scene_id}.mp3"
    scene["durationInFrames"] = duration_frames
    return scene


async def main():
    """Main entry point: process all scenes one by one."""
    os.makedirs(AUDIO_DIR, exist_ok=True)

    print(f"📂 Reading data from: {DATA_FILE}")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    voice = data.get("meta", {}).get("voice", "vi-VN-NamMinhNeural")
    rate = data.get("meta", {}).get("voiceRate", "+10%")
    print(f"🎤 Voice: {voice}, Rate: {rate}")
    print(f"🎬 Processing {len(data['scenes'])} scenes...\n")

    for i, scene in enumerate(data["scenes"]):
        data["scenes"][i] = await generate_scene_audio(scene, voice, rate)
        # Longer delay between scenes to avoid rate limiting
        if i < len(data["scenes"]) - 1:
            print(f"  ... waiting 2s before next scene")
            await asyncio.sleep(2)

    # Write updated data back
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_frames = sum(s["durationInFrames"] for s in data["scenes"])
    total_seconds = total_frames / FPS
    print(f"\n✅ Done! Total video duration: {total_seconds:.1f}s ({total_frames} frames)")
    print(f"   Data saved to: {DATA_FILE}")
    print(f"   Audio files in: {AUDIO_DIR}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
