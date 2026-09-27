# Unified Video Portal — Design Spec

Date: 2026-09-16
Status: Approved (architecture direction confirmed by user in chat; sections B–G consolidated after "ok triển khai")

## 1. Problem & Goal

Two separate local projects currently do related but disconnected work:

- **`video-generator-ai`** (this repo): generates narrated story-style videos via
  Remotion, using Playwright to drive Gemini Ultra's web chat for images/video
  clips, and edge-tts for Vietnamese narration. Driven today by hand-editing
  `video_data.json` and running CLI/MCP tools from an editor session.
- **`E:\Project\douyin-reup-tool`**: downloads Douyin videos, "remakes" them
  (flip/crop/pitch to dodge duplicate-content detection), uploads to
  MinIO, and auto-publishes to TikTok. Already has a working local **portal**
  (Express + static JS UI, port 3050) and a partial API-based "video factory"
  (Gemini API + Veo API) that will NOT be reused (see §4).

**Goal:** merge both into one repo (`video-generator-ai`, confirmed as the
canonical location), exposed through the existing douyin-reup-tool portal UI,
covering 3 functions:

1. **Scripted story video** — today's Rùa-và-Thỏ-style pipeline, plus a new
   auto-appended "bài học" (moral/lesson) closing scene.
2. **Hand-drawn 2D explainer video** — same pipeline as (1), different visual
   style preset (blue pencil/crayon line art, paper texture, simple
   characters — keywords: hand-drawn animation, doodle animation, sketch
   animation, 2D explainer animation).
3. **Download → remake → auto-post** — douyin-reup-tool's existing pipeline,
   unchanged, just relocated into the merged repo.

All decisions below were made by the user in chat during brainstorming; this
doc consolidates them into one reference instead of re-litigating each.

## 2. Confirmed Decisions

| Question | Decision |
|---|---|
| Canonical repo location | `video-generator-ai` (this directory). douyin-reup-tool's code is ported in, then that source folder is retired. |
| Video/image generation | 100% Playwright automation against Gemini Ultra web chat (`gemini.google.com`), reusing the paid Ultra subscription. **No paid Gemini/Veo API calls anywhere** — including scene planning. |
| Scene planning ("director") | Also 100% via Playwright/chat, not the Gemini text API. Portal sends a structured prompt asking Gemini to reply with a JSON scene breakdown; the reply is parsed. Accepted trade-off: less reliable than an API call, needs retry/repair logic (§5.1). |
| Aspect ratio | User picks **16:9 or 9:16 per project** at creation time. Remotion composition width/height become parameters, not constants. |
| Style differentiation (function 1 vs 2) | **One pipeline**, parameterized by a style preset (character/style keyword block injected into every image/video prompt). Function 2 is not a separate renderer — it reuses `MediaScene.tsx` exactly as function 1 does. |
| Moral-lesson closing scene | Adapt existing `OutroScene.tsx` (already a "CTA card" template) into a `lesson` scene type: same spring/ring visual treatment, swap the hardcoded "FOLLOW NGAY" CTA for the lesson text, driven by TTS narration same as other scenes. |
| TTS | Reuse `scripts/tts_generator.js`, already fixed this session (was silently falling back to `en-US-AnaNeural` because `voice` was never passed to `synthesize()`; now correctly uses `vi-VN-NamMinhNeural`). |
| Render engine | Remotion for functions 1 & 2 (quality bar = the just-approved `rua_va_tho_fixed.mp4`). ffmpeg concat+subtitle-burn stays for function 3 (unchanged, already working, different problem shape — no per-word subtitle highlight or Ken Burns needed for reup). |
| Publishing | Auto-post button available after render for **all 3 functions**, reusing `services/tiktokUploader.js` / `publisherPlan.js` as-is. |
| Known Remotion render quirk | On this machine, `OffthreadVideo` under default concurrency races the compositor's frame cache (`No frame found at position X`). Confirmed workaround: `--concurrency=1`. Portal's render call must pass this flag (see §5.4). |

## 3. Data Model

Two existing, incompatible project shapes need to converge:

- douyin-reup-tool: `storage/video_projects.json` — flat array of reup
  projects (`scraped`, `remade`, `published` states).
- video-generator-ai: `src/data/video_data.json` — a single active
  scenario (`meta` + `scenes[]`), overwritten per render, no project history,
  no id.

New unified store: `storage/generated_projects.json`, array of:

```jsonc
{
  "id": "gp_<timestamp>",
  "kind": "story" | "handdrawn",       // maps to a style preset
  "aspectRatio": "16:9" | "9:16",
  "title": "...",
  "rawScript": "...",                   // what the user typed in the portal
  "meta": {
    "theme": "vibrant-orange",
    "voice": "vi-VN-NamMinhNeural",
    "voiceRate": "+0%",
    "bgMusic": ""
  },
  "scenes": [
    {
      "id": 1,
      "type": "media" | "lesson",
      "text": "...",
      "audioFile": "",
      "durationInFrames": 0,
      "highlightWords": [],
      "imagePrompt": "...",
      "videoPrompt": "...",
      "mediaStatus": "pending" | "image" | "video",
      "mediaFile": null
    }
  ],
  "status": "planning" | "generating_media" | "generating_audio" | "rendering" | "done" | "failed",
  "outputPath": null,
  "publishing": { "tiktok": { "posted": false, "postedAt": null, "url": null } },
  "createdAt": "...",
  "updatedAt": "..."
}
```

This is a strict superset of today's `video_data.json` scene shape (so
`MediaScene.tsx` / `OutroScene.tsx` / `VideoComposition.tsx` need minimal
changes — mainly reading from a per-project file instead of the single
static `video_data.json` import, and honoring `aspectRatio`). Reup projects
stay in their own existing `video_projects.json` — no forced unification
there; only the publishing call is shared code.

## 4. Generation Flow

```
Portal "Tạo Video" tab
  → POST /api/generate/plan          { rawScript, kind, aspectRatio }
      services/videoGenerator/director.js
        - builds a prompt (script + JSON schema instructions) using the
          kind's style preset from stylePresets.js
        - Playwright sends it to the already-open Gemini Ultra chat
          (reuses .chrome_profile session, CDP port 9222 — same connection
          pattern as gemini_automator.js today)
        - extracts JSON block from the reply (fenced code block or raw),
          parses; on parse failure, re-prompts once with "trả lời DUY NHẤT
          JSON hợp lệ" before failing the project to `status: failed`
        - if kind === "story", appends one extra scene of type "lesson"
          (its text is a follow-up prompt asking Gemini for the moral, or
          user-supplied — TBD in implementation plan, see §7 open item)
      → writes new project to generated_projects.json, status: planning

  → POST /api/generate/media/:id     (per scene, or "generate all")
      services/videoGenerator/mediaGen.js
        - for each scene missing mediaFile: sends imagePrompt/videoPrompt
          to Gemini Ultra chat (same connect-over-CDP pattern), waits for
          the video element, downloads it into public/media/
        - updates scene.mediaStatus / mediaFile in the project record
      status → generating_media → generating_audio (auto-chained)

  → (auto) services/videoGenerator/ttsGenerator.js
        - same fixed logic as scripts/tts_generator.js, but reads/writes
          the project record instead of the single video_data.json
      status → rendering

  → services/videoGenerator/render.js
        - writes the project's scenes into my-video-engine's
          src/data/video_data.json (still the file Remotion imports;
          simplest bridge without restructuring the Remotion project)
        - spawns `npx remotion render ... --concurrency=1` sized to
          aspectRatio (1280x720 vs 720x1280)
        - moves output into storage/video-factory/<id>/output.mp4
      status → done, outputPath set

  → POST /api/publish/:id/tiktok     (optional, all 3 functions)
        - reuses tiktokUploader.js exactly as function 3 does today
```

Function 3 (download/remake/publish) is untouched — only relocated.

## 5. Notable Implementation Risks (carried into the plan, not resolved here)

1. **Chat-JSON parsing fragility** — Gemini's chat replies can wrap JSON in
   markdown fences, add commentary before/after, or (rarely) refuse the
   format. Director needs a tolerant extractor + one retry + a clear
   `failed` state surfaced in the UI rather than a silent hang.
2. **Sequential media generation** — Playwright can only drive one chat
   conversation at a time realistically; generating 6-8 scenes' media is
   inherently serial and slow (minutes per scene based on today's manual
   runs). Portal UI must show per-scene progress, not just a spinner.
3. **Single shared browser session** — all 3 functions that touch Gemini
   Ultra or TikTok share one Playwright-controlled Chrome
   (`.chrome_profile`, CDP 9222). The portal must serialize/queue jobs that
   need that browser rather than let two generations run concurrently and
   fight over the same tab.
4. **`--concurrency=1` render workaround** — slower renders (confirmed ~1
   min per 300 frames on this machine). Acceptable per user's earlier
   approval of the fixed render; flagged here so the plan doesn't
   "optimize" it back to default concurrency and reintroduce the crash.

## 6. Cleanup (part of this migration, requested explicitly as "clean code")

- Remove `services/videoFactory/` (API-based: `geminiClient.js`,
  `imageGen.js`, `videoGen.js`, `costEstimate.js`) and the `tab-video-factory`
  UI wiring — superseded by `services/videoGenerator/` (Playwright-based).
  `director.js`'s prompt-building logic (the Vietnamese director prompt
  template) is worth reading for inspiration but not reused as-is (it calls
  the API client directly).
- Remove now-orphaned root-level one-off scripts once ported:
  `scripts/send_prompt.js`, `scripts/download_video_direct.js`,
  `scripts/wait_and_download_video.js` (superseded by
  `services/videoGenerator/*`).
- `mcp-server/` stays as a secondary interface for Claude-Code-driven
  sessions (useful for ad-hoc work like this one), but is no longer the
  primary workflow. Its `save_scenario` tool has a known bug (unconditionally
  resets `audioFile` to `""` on every call, already diagnosed this session)
  — fix while touched, not in scope to fix blindly beforehand.
- `GEMINI_API_KEY` / MinIO env vars stay for MinIO (still used) but the
  Gemini API key becomes unused after `videoFactory/` removal — note in
  `.env.example` rather than silently deleting the var (MinIO section stays).

## 7. Open Items For the Implementation Plan

These are deliberately left for `writing-plans`, not decided here:

- Exact wording/flow for the "lesson" scene text: auto-generated by a
  follow-up Gemini prompt, or a manual textarea in the portal UI?
- Whether "generate all media" retries a failed scene automatically or
  requires a manual per-scene retry button.
- Exact TikTok caption/hashtag input point for functions 1/2 (reuse
  function 3's existing publish UI fields as-is, or a new minimal form).
