# video-engine-mcp

MCP server that lets a coding agent (Antigravity, Gemini CLI, Claude Code, ...)
drive the `my-video-engine` Python pipeline as tools, instead of hand-writing
render code per video.

## Setup

```console
cd mcp-server
npm install
```

```console
cd ../my-video-engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env   # fill in GEMINI_API_KEY if you want generate_scenario_from_topic
```

Already wired into this repo:
- `.mcp.json` (Claude Code)
- `.gemini/settings.json` (Gemini CLI)
- `~/.gemini/config/mcp_config.json` and `~/.gemini/antigravity/mcp_config.json` (Antigravity)

All register a `video-engine` MCP server that runs `node mcp-server/src/index.js`.

## Tools

| Tool | What it does |
|---|---|
| `generate_scenario_from_topic` | Runs the Gemini AI Brain (`ai_generator.py`) — generate→self-score→regenerate loop — to write a full scene breakdown from a topic and save it. |
| `save_scenario` | Writes a scene breakdown *you* (the agent) already wrote into `video_data.json`. |
| `get_scenario_status` | Reports per scene: audio/word-alignment done? media imported? plus the `imagePrompt` to hand off. |
| `generate_all_voiceovers` | Runs `media_engine.py`: edge-tts voiceover + local Whisper word-level alignment. |
| `import_media` | Copies a locally downloaded still image into `public/media/` and marks the scene fulfilled. |
| `render_video` | Runs `render_engine.py`: HTML/CSS Ken Burns + karaoke subtitles, captured via Playwright, encoded with FFmpeg, crossfaded into `output/final.mp4`. |
| `upload_video` | Runs `uploader.py`: publishes via YouTube Data API v3 or TikTok Content Posting API (official APIs only — no anti-detect browsers, no bot-detection evasion). |

## Workflow (semi-automatic image generation, uses your Gemini Ultra quota)

1. Agent calls **`generate_scenario_from_topic`** (or writes scenes itself and calls **`save_scenario`**) — each scene gets a still-image `imagePrompt` (no motion prompts; Ken Burns is added in code).
2. Agent calls **`generate_all_voiceovers`** for real TTS audio + Whisper-aligned word timing.
3. Agent calls **`get_scenario_status`**, then for each pending scene tells *you* the `imagePrompt` to paste into Gemini Ultra chat (Nano Banana). You download the image.
4. You give the agent the downloaded file path; it calls **`import_media`** (`sceneId`, `sourcePath`).
5. Repeat 3–4 until `get_scenario_status` shows nothing pending.
6. Agent calls **`render_video`** to produce the final multi-scene video.
7. Optionally, **`upload_video`** to publish via an official platform API.

This keeps image generation on your Gemini Ultra subscription (no separate
API billing for images) while script writing (if using the AI Brain),
voiceover/alignment, rendering, and upload are fully automated through MCP.

## Extending to full automation

To remove the manual image copy-paste step, add a `generate_image` tool here
that calls an image-generation API (Imagen, Flux, etc.) with your own API key
and have the agent call it instead of asking you to use the chat UI.
`import_media`'s contract (scene gets a file in `public/media/` and a
`mediaStatus`) stays the same either way.
