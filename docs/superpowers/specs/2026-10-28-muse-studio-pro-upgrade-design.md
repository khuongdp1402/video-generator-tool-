# Muse Studio Pro Upgrade + Lành Tâm Psychology Style — Design Spec

Date: 2026-10-28
Status: Approved by user ("ok triển khai")

## 1. Goal & Scope

Upgrade `video-generator-ai` so that it incorporates all core workflows of **Muse AI Studio Pro** (adapted to run on **Gemini Ultra Web** + **Remotion** + **FFmpeg**) alongside the existing **Douyin/TikTok Reup & Autopilot** pipeline, with a redesigned, easy-to-navigate studio UI and expanded visual styles including the **3-Zone Split Psychology ("Lành Tâm")** video format.

## 2. Core Subsystems

### 2.1 Expanded Style Presets & 3-Zone Split Layout (`SplitPsychScene.tsx`)
- **8 Style Presets** in `services/videoGenerator/stylePresets.js`:
  1. `psych_split` — **Tâm lý học Lành Tâm (Khung 3 tầng + Phụ đề Song ngữ Việt–Anh)**: Combines Pictogram black-on-white silhouettes for everyday behavioral examples and Moody Neon Blue/Purple Surreal Metaphors for deep psychological explanations. Uses `layoutMode: "split"`.
  2. `pictogram` — **Biểu tượng Pictogram Đen Trắng**: Clean 2D black stick-figure silhouettes on pure white background with expressive comic icons (`?!`, sound waves, arrows, thought bubbles).
  3. `psych_surreal` — **Ẩn dụ Tâm lý Siêu thực (Surreal Psychology)**: Moody blue/purple neon editorial illustration with glowing silhouettes and symbolic visual metaphors (threads, cracks, paper boats, giant hands, floating doors).
  4. `minimalist` — **Tối giản Đen-Trắng (Dan Koe style)**: Crisp white geometric vector line art on pure black background.
  5. `handdrawn` — **Vẽ tay 2D Explainer (Doodle/Sketch)**: Blue pencil/crayon line art on cream paper texture.
  6. `story` — **Hoạt hình 3D Pixar/Disney**: Warm cinematic 3D character storytelling.
  7. `anime` — **Anime Nhật Bản (Makoto Shinkai style)**: Vibrant 2D anime, dramatic sky lighting, expressive characters.
  8. `cinematic` — **Điện ảnh Thực tế 4K (Photorealistic Cinematic)**: Shallow depth of field, anamorphic lens lighting, realistic textures.
- **3-Zone Split Layout (`my-video-engine/src/templates/SplitPsychScene.tsx`)**:
  - Triggered when `scene.type === "split_media"` or `meta.layoutMode === "split"`:
  - **Top Zone (26% height)**: Pure dark background (`#07090e`), optional channel badge pill (`meta.channelName`, e.g. `🌓 LÀNH TÂM`), and bold uppercase gold/yellow topic header (`meta.title`, e.g. `TÍNH CÁCH PHẢN BÁC`).
  - **Middle Zone (38% height)**: `16:9` framed media viewport playing `OffthreadVideo` or Ken Burns `Img` (or expressive fallback card).
  - **Bottom Zone (36% height)**: Pure dark background (`#07090e`), centered bilingual subtitles:
    - Primary Vietnamese text (`scene.text`) in bold white (`fontSize: 34`, karaoke/active highlight).
    - Secondary English translation (`scene.textEn`) in soft muted slate (`#94a3b8`, `fontSize: 21`) below.
- **Director Bilingual Support (`services/videoGenerator/director.js`)**:
  - Director prompt instructs Gemini to return both `"text"` (Vietnamese narration) and `"textEn"` (concise English subtitle translation) for every scene, plus `"visualStyle"` (`"pictogram"` or `"surreal"` when `kind === "psych_split"`).

### 2.2 Batch Queue, Reference Images & Long Video Continuity (`services/videoGenerator/batchQueue.js` & `continuity.js`)
- **Batch Queue Manager**:
  - Users can add multiple prompts/scripts into a queue (`queued`, `planning`, `generating_media`, `generating_audio`, `rendering`, `done`, `failed`, `needs_review`, `cancelled`) before clicking **▶ Bắt đầu chạy**.
  - Supports multi-select actions: **Chạy đã chọn**, **Hủy đã chọn**, **Xóa đã chọn**, **Chạy lại task lỗi**, and **Khôi phục (Recover)** from Gemini chat URL.
  - Supports up to **8 Reference Images** per task (`refs: string[]`, uploaded via `POST /api/uploads` to `storage/uploads/`), attached to Gemini chat before sending the prompt.
  - Supports target duration (`10s`, `20s`, `30s`, `40s`, `50s`, `60s`) by controlling the number of scenes/segments and chaining continuity frames.
- **Continuity Frame Extractor (`services/videoGenerator/continuity.js`)**:
  - Extracts a frame near the end of a completed video clip (`secondsBeforeEnd`: `0.3`, `1`, `2`, or `3` seconds) using `fluent-ffmpeg` into `storage/continuity/frame_<taskId>_<sceneId>.jpg`.
  - Used both for chaining scenes inside a Film Project and for multi-segment long videos.

### 2.3 Film Projects & Scene-Range Assets (`services/videoGenerator/filmProjects.js`)
- **Film Workspace (`storage/film_projects.json`)**:
  - Each film project has:
    - `id`, `name`, `rules` (global consistency rules), `sceneRules[]` (`{ id, name, sceneStart, sceneEnd, rules }`), `outputDir`.
    - `assets[]`: `{ id, name, role: 'character' | 'scene' | 'prop' | 'style', description, ref, sceneStart, sceneEnd }`.
    - `chainMode`: `'none' | 'all' | 'selected'`, `continuityOffset`: `0.3 | 1 | 2 | 3`.
  - When a scene `sceneNo` is planned or generated inside a Film Project:
    - Active global rules + matching `sceneRules` (`sceneStart <= sceneNo <= sceneEnd`) + matching character/scene/prop/style asset descriptions are automatically injected into the prompt.
    - Matching reference images (up to 8, including the predecessor scene's continuity frame if chained) are attached to the task.

### 2.4 AI Prompt Writer — Single & Bulk (`services/videoGenerator/promptWriter.js`)
- **Profiles & Skills (`storage/prompt_writer.json`)**:
  - Supports **Gemini Ultra Web (Free via CDP)** as the default zero-cost provider, plus optional API Key profiles for **Google Gemini API**, **DeepSeek**, and **OpenAI**.
  - Pre-loaded with curated **Prompt Skills**:
    1. *Tâm lý học Lành Tâm (Pictogram + Ẩn dụ + Song ngữ)*
    2. *Kể chuyện 3D Pixar & Bài học cuộc sống*
    3. *Giải thích kiến thức 2D Hand-drawn Doodle*
    4. *Triết lý tối giản Dan Koe (Minimalist Đen Trắng)*
    5. *Review Sản phẩm / Thời trang KOL*
    6. *Phim ngắn Điện ảnh nối cảnh (10s/cảnh)*
- **Single & Bulk Modes**:
  - **Single Mode**: Idea brief + up to 8 reference images → generates a structured script/prompt ready to send to Video Queue or Film Project in 1 click.
  - **Bulk Mode**:
    - *Submode 1 (1 Yêu cầu → N kịch bản biến thể)*: Generates 1–20 distinct scripts/prompts from one topic.
    - *Submode 2 (Tạo theo nhiều bộ ảnh)*: Each image set represents a product/character/topic; generates tailored prompts for each set.

### 2.5 Multi-Account Pool, Proxy Assignment, Browser Extension & Unified Library (`services/accountManager.js`)
- **Account Pool (`storage/accounts.json`)**:
  - Manages multiple Gemini Ultra / Chrome profiles (`id`, `name`, `profilePath`, `cdpPort`, `proxy`, `enabled`, `authStatus`, `balance`, `dailyStats`).
  - Supports **Bulk Proxy Assignment** (`ip:port:user:pass`, `http://...`, `socks5://...`), opening Chrome with the account's dedicated `--user-data-dir` and `--proxy-server`, importing/exporting cookies JSON, checking account health (`valid` / `expired` / `error`), and viewing 7/30-day success/error statistics.
- **Browser Extension (`Extension_MuseAI/` upgraded for Unified Portal)**:
  - Syncs cookies & account status directly to `http://127.0.0.1:3050/api/accounts/sync-extension` (while keeping port `18610`/`8000` fallback compatibility).
- **Unified Output Library (`GET /api/library`)**:
  - Aggregates all generated AI videos (`storage/video-gen/`), Film project outputs, and Douyin downloaded/remade videos (`storage/raw/`, `storage/remake/`).
  - Supports preview, bulk download, filter by source/project, **1-click Send to FFmpeg Remake**, and **1-click Publish to TikTok**.
