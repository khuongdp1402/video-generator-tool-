# my-video-engine

Python video engine: turns a scene breakdown (`src/data/video_data.json`) into
a finished vertical video — static AI-generated images animated with a Ken
Burns effect, TTS voiceover, and word-synced karaoke subtitles. No AI video
generation (Kling/Veo) and no browser-scraping — see `mcp-server/README.md`
at the repo root for the full pipeline and how an agent drives this via MCP.

## Setup

```console
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env   # fill in GEMINI_API_KEY, etc.
```

Requires `ffmpeg` on PATH.

## Modules

| File | Role |
|---|---|
| `config_manager.py` | Loads `config.yaml` + `.env`, sets up logging to `logs/app.log`. |
| `ai_generator.py` | Gemini API script writer with a generate→score→regenerate loop (Hook/Pacing/Loopability). |
| `media_engine.py` | TTS (edge-tts) + local Whisper word-level alignment per scene. |
| `render_engine.py` | HTML/CSS scene template + Playwright frame capture (Ken Burns zoom, karaoke subtitles) + FFmpeg encode/crossfade. |
| `uploader.py` | Publishes via official APIs only — YouTube Data API v3, TikTok Content Posting API. |

## CLI

```console
python3 main.py script "Kỹ Năng Buông Bỏ"     # Module 2: writes video_data.json
python3 main.py voiceover                      # Module 3: TTS + Whisper alignment
python3 main.py render --output output/final.mp4   # Module 4
python3 main.py upload youtube output/final.mp4 --title "..."  # Module 5
```

In normal use these are called through the MCP server (`mcp-server/`) by a
coding agent, not run by hand — see the root README.
