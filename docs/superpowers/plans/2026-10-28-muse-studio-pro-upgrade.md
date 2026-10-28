# Muse Studio Pro Upgrade + Lành Tâm Psychology Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `video-generator-ai` with all Muse AI Studio Pro capabilities (Batch Queue, 8 Reference Images, Long Video Continuity 10s–60s, Film Projects with Character/Scene-Range Assets & Rules, AI Prompt Writer Single/Bulk, Multi-Account & Bulk Proxy Pool, Browser Extension Sync, and Unified Library) plus 8 AI Video Styles including the 3-Zone Split Psychology ("Lành Tâm") bilingual format, alongside the existing Douyin/TikTok Reup & Autopilot pipeline.

**Architecture:** Express backend (`server.js`) extended with modular services under `services/videoGenerator/` and `services/accountManager.js`, backed by JSON stores in `storage/`. Remotion engine (`my-video-engine`) extended with `SplitPsychScene.tsx` for 3-zone vertical psychology videos with bilingual Vietnamese/English subtitles. Frontend (`public/index.html`, `public/style.css`, `public/app.js`) redesigned into a clean 2-section Studio Workspace (AI Video Studio + Douyin/TikTok Reup).

**Tech Stack:** Node.js, Express, Playwright (CDP & Chromium profiles), Remotion 4 (React 19 + TypeScript), fluent-ffmpeg, `@andresaya/edge-tts`, Vanilla JS SPA.

**Spec:** `docs/superpowers/specs/2026-10-28-muse-studio-pro-upgrade-design.md`

## Global Constraints

- Keep 100% of existing Douyin download, FFmpeg remake, MinIO upload, TikTok uploader, and Autopilot 24/7 endpoints and functionality working without regression.
- Default AI generation uses Playwright connected to Gemini Ultra Web (zero API cost), with optional API key support in the Prompt Writer module.
- Remotion renders must keep `--concurrency=1` to avoid `OffthreadVideo` frame cache race conditions on Windows.
- All `node --test services/**/*.test.js` unit tests must pass.

---

### Task 1: Expanded Style Presets (8 Styles + Layout Mode) & Bilingual Director

**Files:**
- Modify: `services/videoGenerator/stylePresets.js`
- Modify: `services/videoGenerator/stylePresets.test.js`
- Modify: `services/videoGenerator/director.js`
- Modify: `services/videoGenerator/director.test.js`
- Modify: `services/videoGenerator/store.js`
- Modify: `services/videoGenerator/store.test.js`

- [ ] **Step 1: Update `stylePresets.js` with 8 styles (`psych_split`, `pictogram`, `psych_surreal`, `minimalist`, `handdrawn`, `story`, `anime`, `cinematic`) and layout helper**
- [ ] **Step 2: Update `director.js` to support bilingual `textEn`, film project rules/assets injection, and `split_media` scene types**
- [ ] **Step 3: Update `store.js` to accept all 8 valid kinds, `layoutMode`, `channelName`, `projectId`, `sceneNo`, `refs`, `targetDuration`, `predecessorId`, and `continuityOffset`**
- [ ] **Step 4: Run `node --test services/videoGenerator/*.test.js` to verify tests pass**

---

### Task 2: Remotion 3-Zone Split Psychology Template (`SplitPsychScene.tsx`) & Render Bridge

**Files:**
- Modify: `my-video-engine/src/types.ts`
- Create: `my-video-engine/src/templates/SplitPsychScene.tsx`
- Modify: `my-video-engine/src/VideoComposition.tsx`
- Modify: `services/videoGenerator/render.js`
- Modify: `services/videoGenerator/render.test.js`

- [ ] **Step 1: Add `split_media` scene type, `textEn`, `channelName`, and `layoutMode` to `my-video-engine/src/types.ts`**
- [ ] **Step 2: Create `my-video-engine/src/templates/SplitPsychScene.tsx` implementing the 3-zone layout (Top: Channel Badge + Gold Uppercase Header; Center: 16:9 framed video/image or Pictogram/Surreal fallback; Bottom: Vietnamese + English bilingual subtitles + narration audio)**
- [ ] **Step 3: Wire `split_media` and `meta.layoutMode === "split"` into `VideoComposition.tsx` and `services/videoGenerator/render.js`**
- [ ] **Step 4: Run tests to verify `render.test.js` passes**

---

### Task 3: Continuity Frame Extractor, Reference Uploads & Film Projects Service

**Files:**
- Create: `services/videoGenerator/continuity.js`
- Create: `services/videoGenerator/filmProjects.js`
- Create: `services/videoGenerator/filmProjects.test.js`
- Modify: `services/videoGenerator/mediaGen.js`

- [ ] **Step 1: Implement `continuity.js` to extract a frame at `secondsBeforeEnd` (`0.3`, `1`, `2`, `3`s) from any MP4 using `fluent-ffmpeg`**
- [ ] **Step 2: Implement `filmProjects.js` to manage Film Projects (`film_projects.json`), scene-scoped rules (`sceneRules`), character/scene/prop/style assets (`assets`), and scene reference resolution (up to 8 images + continuity frame)**
- [ ] **Step 3: Enhance `mediaGen.js` so that if a scene/task has reference images (`refs` or continuity frame), it uploads them into the Gemini prompt box before submitting `videoPrompt`**
- [ ] **Step 4: Run `node --test services/videoGenerator/filmProjects.test.js` to verify**

---

### Task 4: AI Prompt Writer (Single & Bulk + Curated Skills) & Multi-Account/Proxy Pool

**Files:**
- Create: `services/videoGenerator/promptWriter.js`
- Create: `services/videoGenerator/promptWriter.test.js`
- Create: `services/accountManager.js`
- Create: `services/accountManager.test.js`
- Create: `Extension_MuseAI/manifest.json`
- Create: `Extension_MuseAI/popup.html`
- Create: `Extension_MuseAI/popup.js`

- [ ] **Step 1: Implement `promptWriter.js` with 6 built-in Vietnamese skills (including Lành Tâm Psychology, Pixar Story, Hand-drawn 2D, Dan Koe Minimalist, KOL Review, Short Film 10s), AI profile management (Gemini Ultra Web CDP free mode + Gemini API / DeepSeek / OpenAI API), Single Prompt generation, and Bulk Prompt generation (Variations & Image Sets)**
- [ ] **Step 2: Implement `accountManager.js` supporting multi-account Chrome profiles, bulk proxy assignment (`ip:port:user:pass`, `http://`, `socks5://`), cookie JSON import/export, live/expired health checks, and 7/30-day task metrics**
- [ ] **Step 3: Copy & upgrade `Extension_MuseAI/` into workspace root so 1-click sync sends cookies to `http://127.0.0.1:3050/api/accounts/sync-extension`**
- [ ] **Step 4: Run unit tests for `promptWriter` and `accountManager`**

---

### Task 5: Unified Express Routes (`server.js`) & Modern Studio UI (`public/`)

**Files:**
- Modify: `server.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Mount all new endpoints in `server.js` (Batch Queue control, Reference Image upload, Film Projects CRUD, Prompt Writer Single/Bulk & Skills/Profiles, Account Pool & Bulk Proxy, Unified Library, and Extension Sync) while preserving all existing Douyin/Remake/MinIO/TikTok/Autopilot routes**
- [ ] **Step 2: Redesign `public/index.html`, `public/style.css`, and `public/app.js` with a clean, responsive 2-group sidebar (`AI VIDEO STUDIO PRO` & `DOUYIN / TIKTOK REUP`), visual style selector cards (including Lành Tâm 3-Zone Psychology), Batch Queue table, Film Workspace tabs, AI Prompt Writer (Single & Bulk), Account/Proxy Pool Manager, Unified Output Library, and full Douyin/Autopilot tabs**
- [ ] **Step 3: Run full test suite (`npm test`) and verify server startup and endpoints**
