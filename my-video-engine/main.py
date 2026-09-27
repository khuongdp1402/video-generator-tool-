"""
CLI entrypoint wiring the 5 modules together. Also what mcp-server/src/index.js
shells out to, so an agent (Antigravity, Gemini CLI, Claude Code) can drive
the whole pipeline through MCP tools instead of calling this directly.
"""

from __future__ import annotations

import argparse
import json
import sys

from config_manager import get_logger, load_config

logger = get_logger(__name__)


def cmd_script(args):
    from ai_generator import generate_scenario

    scenario = generate_scenario(args.topic)
    cfg = load_config()
    data_file = cfg.path("data_file")

    data = {
        "meta": {
            "title": args.topic,
            "voice": cfg.get("tts", "voice"),
            "voiceRate": cfg.get("tts", "rate"),
        },
        "scenes": [
            {
                "id": i + 1,
                "text": scene["text"],
                "imagePrompt": scene.get("imagePrompt", ""),
                "highlightWords": scene.get("highlightWords", []),
                "audioFile": "",
                "durationInFrames": 0,
                "mediaStatus": "pending",
            }
            for i, scene in enumerate(scenario["scenes"])
        ],
    }
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("Wrote %d scenes to %s", len(data["scenes"]), data_file)


def cmd_voiceover(args):
    from media_engine import process_scenario

    process_scenario()


def cmd_render(args):
    from render_engine import render_video

    output_path = render_video(output_file=args.output)
    print(str(output_path))


def cmd_upload(args):
    if args.platform == "youtube":
        from uploader import upload_youtube

        url = upload_youtube(args.video, args.title, args.description or "", tags=args.tags)
        print(url)
    elif args.platform == "tiktok":
        from uploader import upload_tiktok

        result = upload_tiktok(args.video, args.title)
        print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(prog="main.py")
    sub = parser.add_subparsers(dest="command", required=True)

    p_script = sub.add_parser("script", help="Generate a scored scenario from a topic (Module 2)")
    p_script.add_argument("topic")
    p_script.set_defaults(func=cmd_script)

    p_voice = sub.add_parser("voiceover", help="TTS + Whisper alignment for all scenes (Module 3)")
    p_voice.set_defaults(func=cmd_voiceover)

    p_render = sub.add_parser("render", help="Render the final video (Module 4)")
    p_render.add_argument("--output", default=None)
    p_render.set_defaults(func=cmd_render)

    p_upload = sub.add_parser("upload", help="Publish via an official platform API (Module 5)")
    p_upload.add_argument("platform", choices=["youtube", "tiktok"])
    p_upload.add_argument("video")
    p_upload.add_argument("--title", required=True)
    p_upload.add_argument("--description", default="")
    p_upload.add_argument("--tags", nargs="*", default=[])
    p_upload.set_defaults(func=cmd_upload)

    args = parser.parse_args()
    try:
        args.func(args)
    except Exception:
        logger.exception("Command %r failed", args.command)
        sys.exit(1)


if __name__ == "__main__":
    main()
