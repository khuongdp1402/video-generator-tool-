# video-engine-mcp

MCP server that lets a coding agent (Gemini CLI, Claude Code, ...) drive the
`my-video-engine` Remotion pipeline as tools, instead of hand-writing React
scene components per video.

## Setup

```console
cd mcp-server
npm install
```

Already wired into this repo:
- `.mcp.json` (Claude Code)
- `.gemini/settings.json` (Gemini CLI)

Both register a `video-engine` MCP server that runs `node mcp-server/src/index.js`.

## Tools

| Tool | What it does |
|---|---|
| `save_scenario` | Writes the scene breakdown (title, theme, scenes with text + imagePrompt/videoPrompt) you produced from the raw script into `video_data.json`. |
| `get_scenario_status` | Reports per scene: has audio? media status? and the image/video prompt to hand off for generation. |
| `generate_all_voiceovers` | Runs `scripts/tts_generator.py` (edge-tts) to fill real audio + word-accurate scene durations. |
| `import_media` | Copies a locally downloaded image/video into `public/media/` and marks the scene as fulfilled. |
| `render_video` | Runs `remotion render` to produce `output/final.mp4`. |

## Workflow (semi-automatic, uses your Gemini Ultra quota)

1. **You give the agent a raw script.** The agent (not this server) breaks it
   into scenes and writes a detailed `imagePrompt` / `videoPrompt` per scene —
   that's an LLM reasoning step, not a tool call.
2. Agent calls **`save_scenario`** with the scene list.
3. Agent calls **`generate_all_voiceovers`** to get real TTS audio + timing.
4. Agent calls **`get_scenario_status`**, then for each pending scene tells
   *you* the `imagePrompt`/`videoPrompt` to paste into Gemini Ultra chat
   (Nano Banana for the still image, Veo for image-to-video). You download
   the result.
5. You give the agent the downloaded file path; it calls **`import_media`**
   (`sceneId`, `sourcePath`, `mediaType: "image" | "video"`).
6. Repeat 4–5 until `get_scenario_status` shows no scene pending.
7. Agent calls **`render_video`** to produce the final multi-scene video.

This keeps image/video generation on your Gemini Ultra subscription (no
separate API billing) while everything else — scenario bookkeeping, TTS,
media placement, final render — is automated through the MCP tools.

## Extending to full automation later

If you later want zero manual copy-paste, add a `generate_image` /
`generate_video` tool here that calls the Gemini API (Imagen/Veo) directly
with an API key, and have the agent call it instead of asking you to use
the chat UI. `import_media`'s contract (scene gets a file in `public/media/`
and a `mediaStatus`) stays the same either way.
