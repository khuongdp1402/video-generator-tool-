# Unified Video Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `E:\Project\douyin-reup-tool`'s Express+vanilla-JS portal into this repo, and add a new "Tạo Video AI" tab that drives the existing Remotion pipeline end-to-end (script → scene plan → media → TTS narration → render → optional TikTok publish) entirely through Playwright automation of the Gemini Ultra web chat — no paid Gemini/Veo API calls anywhere.

**Architecture:** One Express server (`server.js`, port 3050, relocated from douyin-reup-tool) serves a static vanilla-JS portal (`public/`) and exposes REST routes. A new `services/videoGenerator/` module drives a single shared Playwright-controlled Chrome (connected over CDP to the existing `.chrome_profile` Gemini Ultra session) to plan scenes, generate per-scene media, and generate Vietnamese TTS narration; a render step writes the result into `my-video-engine/src/data/video_data.json` and shells out to `npx remotion render`. The existing douyin-reup-tool functions (download/remake/MinIO/publisher/autopilot) are relocated unchanged. The old API-based `services/videoFactory/` (Gemini/Veo paid API) is deleted, not migrated.

**Tech Stack:** Node.js/Express (portal), Playwright (browser automation, CDP connect to `localhost:9222`), Remotion 4.0.525 (render, already in `my-video-engine/`), `@andresaya/edge-tts` (Vietnamese TTS, already fixed this session), `node:test` + `node:assert/strict` (unit tests, matching the existing `services/videoFactory/*.test.js` convention), vanilla JS + `fetch` (portal frontend, no framework, matching existing `public/app.js`).

**Spec:** `docs/superpowers/specs/2026-09-16-unified-video-portal-design.md`

## Global Constraints

- **No paid Gemini/Veo API calls anywhere in the new code** — scene planning, image generation, and video generation all go through Playwright driving the Gemini Ultra web chat at `gemini.google.com`, reusing the CDP session at `http://localhost:9222` and the `.chrome_profile` login (per spec §2).
- **Render workaround is mandatory, not optional:** every `remotion render` invocation from server code MUST include `--concurrency=1` (confirmed this session: default concurrency races the Windows compositor's `OffthreadVideo` frame cache and crashes with `No frame found at position X`; per spec §2 and §5.4).
- **Only one generation job (plan/media/render) may run at a time**, because only one Playwright-controlled Chrome tab drives Gemini Ultra (per spec §5.3). Enforced with a single in-memory busy flag in `server.js` — not a persisted queue, this is a single-operator local tool.
- **`MediaScene.tsx` must keep using `OffthreadVideo`, not `Video`** (fixed this session for the stutter bug — do not revert).
- **TTS must call `tts.synthesize(text, voice, options)`** with `voice` as the explicit second argument (fixed this session — the bug was a silently-dropped voice parameter falling back to `en-US-AnaNeural`; do not reintroduce the old `new EdgeTTS({voice, ...})` pattern).
- Follow existing code conventions exactly where they exist: Express route style and Vietnamese numbered-comment convention in `server.js`, `node:test`/`node:assert/strict` for unit tests, the flat single-file `public/app.js` module-by-numbered-comment convention, `?.addEventListener` for new button wiring.

---

## Resolved Open Items (from spec §7)

The spec deliberately left 3 items for this plan to decide:

1. **Lesson scene text**: a manual textarea in the portal UI ("Bài học rút ra (tuỳ chọn)"), not a second Gemini call. If left blank, no lesson scene is appended. Rationale: avoids a third fragile chat-JSON round-trip for a single sentence the user can type in 10 seconds.
2. **Failed scene retry**: manual per-scene retry button (mirrors the existing `vfRegenerateScene` UX pattern in the code being replaced) — no automatic retry loop, so a systematically failing prompt doesn't silently retry into a stuck job.
3. **TikTok caption for functions 1/2**: a single optional caption `<input>` next to the publish button on the new tab (not the full existing publisher-plan UI, which is about strategy documentation, not a per-video caption field).

---

## Task 1: Relocate the portal skeleton into this repo

**Files:**
- Create: `server.js` (root of `video-generator-ai`)
- Create: `public/index.html`, `public/app.js`, `public/style.css`
- Create: `services/scraper.js`, `services/remaker.js`, `services/minioClient.js`, `services/publisherPlan.js`, `services/tiktokUploader.js`, `services/autopilotScheduler.js`, `services/channelWatcher.js`
- Create: `storage/.gitkeep` (empty dir placeholder; `storage/raw/`, `storage/remake/`, `storage/video-gen/` created at runtime)
- Modify: `package.json` (root) — merge dependencies
- Modify: `.gitignore` — add `storage/`, `tiktok_browser_profile/` (renamed usage, see Task 1 step 5)
- Create: `.env.example` (root)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a running Express server on port 3050 with all of douyin-reup-tool's existing routes intact, for every later task to add routes/files onto.

- [ ] **Step 1: Copy the portal files verbatim**

```bash
cd "E:/Project/video-generator-ai"
cp "E:/Project/douyin-reup-tool/server.js" ./server.js
cp -r "E:/Project/douyin-reup-tool/public" ./public
mkdir -p services
cp "E:/Project/douyin-reup-tool/services/scraper.js" services/
cp "E:/Project/douyin-reup-tool/services/remaker.js" services/
cp "E:/Project/douyin-reup-tool/services/minioClient.js" services/
cp "E:/Project/douyin-reup-tool/services/publisherPlan.js" services/
cp "E:/Project/douyin-reup-tool/services/tiktokUploader.js" services/
cp "E:/Project/douyin-reup-tool/services/autopilotScheduler.js" services/
cp "E:/Project/douyin-reup-tool/services/channelWatcher.js" services/
cp "E:/Project/douyin-reup-tool/.env.example" ./.env.example
```

Do NOT copy `services/videoFactory/` — that's removed in Task 2, no point copying it first.
Do NOT copy `storage/` contents (any existing scraped/generated videos, `database.json`, `tiktok_cookie.json`, `video_projects.json`) — those are per-machine runtime state, not source. Do NOT copy `tiktok_browser_profile/` (a separate persistent Chrome profile from the reup tool's own TikTok login flow — distinct from this repo's `.chrome_profile/` which is for Gemini; it will be recreated on first TikTok login here).

- [ ] **Step 2: Merge root `package.json` dependencies**

Read the current root `package.json` (only has `{"dependencies": {"playwright": "^1.63.0"}}`) and douyin-reup-tool's dependency list, then write the merged file:

```json
{
  "name": "video-generator-ai-portal",
  "version": "1.0.0",
  "description": "Unified portal: AI video generation (Gemini Ultra + Remotion) and Douyin download/remake/auto-publish",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "test": "node --test services/**/*.test.js"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.758.0",
    "@aws-sdk/s3-request-presigner": "^3.758.0",
    "@ffmpeg-installer/ffmpeg": "^1.1.0",
    "@tobyg74/tiktok-api-dl": "^1.3.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "fluent-ffmpeg": "^2.1.3",
    "playwright": "^1.63.0"
  }
}
```

Note: `@google/genai` is deliberately dropped — it was only used by the API-based `videoFactory/` module being removed in Task 2.

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Run: `node -e "require('express'); require('playwright'); require('fluent-ffmpeg'); console.log('deps OK')"`
Expected: `deps OK`

- [ ] **Step 4: Add `.gitignore` entries**

Open `.gitignore` and add (after the existing `.chrome_profile/` line added earlier this session):

```
# Douyin reup runtime state (per-machine, not source)
storage/
tiktok_browser_profile/
```

- [ ] **Step 5: Boot the server and smoke-test existing tabs**

```bash
node server.js
```

Expected console output: `🚀 Douyin Reup Pipeline Server đang chạy tại: http://localhost:3050`

Manual verification (no Chrome/Gemini session needed for this — these routes don't touch Playwright):
- `curl http://localhost:3050/api/videos` → `{"success":true,"data":[]}` (empty library, fresh `storage/`)
- `curl http://localhost:3050/api/publisher/plan` → returns the static publisher strategy JSON
- Open `http://localhost:3050` in a browser → the 6 existing tabs (Cào Video, Remake, MinIO, Kế Hoạch Đăng Bài, Autopilot, AI Video Factory) render and are clickable. The AI Video Factory tab will error if used (its backend isn't copied yet) — that's expected, it's deleted in Task 2.

Stop the server (Ctrl+C) before continuing.

- [ ] **Step 6: Commit**

```bash
git add server.js public services package.json .env.example .gitignore package-lock.json
git commit -m "Relocate douyin-reup-tool portal skeleton into this repo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Remove the obsolete API-based AI Video Factory

**Files:**
- Modify: `server.js:1-17` (remove videoFactory requires), `server.js:379-586` (remove the 5 video-project routes)
- Modify: `public/index.html:49-52` (remove nav button), `public/index.html:439-464` (remove tab section)
- Modify: `public/app.js:19` (remove `tab-video-factory` entry from `headings`), `public/app.js:67-69` (remove 3 listener lines), `public/app.js:648-767` (remove whole module)

**Interfaces:**
- Consumes: nothing new
- Produces: a clean slot (empty nav position, no dead routes) for Task 12's new tab. No `services/videoFactory/` reference remains anywhere.

- [ ] **Step 1: Remove the videoFactory requires from `server.js`**

Delete lines 11-17 (the 7 `videoFactory`-related requires):
```js
const videoFactoryStore = require('./services/videoFactory/store');
const { estimateVeoCostUsd } = require('./services/videoFactory/costEstimate');
const { createGeminiClient } = require('./services/videoFactory/geminiClient');
const { generateScenePlan } = require('./services/videoFactory/director');
const { generateCharacterImage, generateSceneImage } = require('./services/videoFactory/imageGen');
const { startSceneVideo, pollSceneVideo, downloadSceneVideo } = require('./services/videoFactory/videoGen');
const { composeProjectVideo } = require('./services/videoFactory/compose');
```

Also delete the now-unused static mount at line 29:
```js
app.use('/storage/video-factory', express.static(path.join(__dirname, 'storage', 'video-factory')));
```

- [ ] **Step 2: Remove the 5 video-project routes from `server.js`**

Delete the entire block from the `VIDEO_RENDERABLE_SCENE_STATUSES` constant through the `/compose` route — i.e. everything between (and including) these two markers:

```js
// Scene ở các trạng thái này đã có ảnh nên đủ điều kiện chạy (hoặc chạy lại) Veo.
const VIDEO_RENDERABLE_SCENE_STATUSES = ['image_ready', 'video_ready', 'failed'];
```
... through ...
```js
// 22. Ghép video cuối cùng (FFmpeg + phụ đề)
app.post('/api/video-projects/:id/compose', async (req, res) => {
  ...
});
```

(everything up to, but not including, the final `app.listen(...)` block).

- [ ] **Step 3: Verify no dangling references**

Run: `grep -rn "videoFactory\|video-projects\|video-factory" server.js`
Expected: no output (empty).

- [ ] **Step 4: Remove the nav button from `public/index.html`**

Delete:
```html
<button class="nav-item" data-tab="tab-video-factory">
  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect><polygon points="23 7 16 12 23 17 23 7"></polygon></svg>
  <span>6. AI Video Factory</span>
</button>
```

- [ ] **Step 5: Remove the tab section from `public/index.html`**

Delete the whole `<!-- TAB 6: AI VIDEO FACTORY -->` section (lines 439-464 in the original, ending right before `</main>`):
```html
<!-- TAB 6: AI VIDEO FACTORY -->
<section id="tab-video-factory" class="tab-content">
  ...
</section>
```

- [ ] **Step 6: Remove references in `public/app.js`**

Delete the `'tab-video-factory': { title: ..., sub: ... }` line from the `headings` object in `initTabs()`.

Delete the 3 lines in `setupEventListeners()`:
```js
// AI Video Factory listeners
document.getElementById('vfGenerateStoryboardBtn')?.addEventListener('click', vfGenerateStoryboard);
document.getElementById('vfApproveBtn')?.addEventListener('click', vfApproveAndGenerateVideos);
document.getElementById('vfComposeBtn')?.addEventListener('click', vfComposeFinalVideo);
```

Delete the entire `// 8. AI VIDEO FACTORY MODULE FUNCTIONS` block (`vfCurrentProjectId` through the end of `vfComposeFinalVideo`), stopping right before the shared `escapeHtml` function at the end of the file. Keep `escapeHtml` — it's shared.

- [ ] **Step 7: Verify the server still boots and other tabs still work**

```bash
node server.js
```
Expected: same startup line as Task 1, no errors. Open `http://localhost:3050`, confirm 5 nav buttons remain (Cào Video, Remake, MinIO, Kế Hoạch Đăng Bài, Autopilot) and each still switches tabs correctly (click through all 5). Stop the server.

- [ ] **Step 8: Annotate the now-unused `GEMINI_API_KEY` in `.env.example`**

`GEMINI_API_KEY` becomes unused after this task (it only existed for the removed `videoFactory/` module, per spec §6 — "note in `.env.example` rather than silently deleting the var"). In `.env.example`, change:
```
# Google Gemini API (AI Studio) - dùng cho AI Video Factory (text director, Nano Banana image, Veo 3.1 video)
GEMINI_API_KEY=
```
to:
```
# Google Gemini API (AI Studio) - KHÔNG dùng nữa kể từ khi AI Video Factory
# chuyển sang chạy 100% qua Playwright/Gemini Ultra web (không tốn phí API).
# Giữ lại biến này phòng khi sau này cần quay lại dùng API; để trống là an toàn.
GEMINI_API_KEY=
```

- [ ] **Step 9: Commit**

```bash
git add server.js public/index.html public/app.js .env.example
git commit -m "Remove obsolete API-based AI Video Factory (Gemini/Veo paid API)

Superseded by services/videoGenerator/ (Playwright-based, no paid API
calls), built in the following tasks.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Project store (`services/videoGenerator/store.js`)

**Files:**
- Create: `services/videoGenerator/store.js`
- Create: `services/videoGenerator/store.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `createStore(dataFile)` returning `{ createProject(input), getProject(id), updateProject(id, updates), listProjects() }`, plus a default-exported store bound to `storage/generated_projects.json`. `createProject(input)` takes `{ kind: 'story'|'handdrawn', aspectRatio: '16:9'|'9:16', rawScript: string, lessonText?: string }` and returns a full project object matching spec §3's schema (with empty `scenes: []`, `status: 'planning'`). All later tasks (director, mediaGen, ttsGenerator, render, server routes) call these exact function names.

- [ ] **Step 1: Write the failing test**

```js
// services/videoGenerator/store.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('./store');

function tempDataFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-store-')), 'generated_projects.json');
}

test('createProject returns a project with the expected shape and defaults', () => {
  const store = createStore(tempDataFile());
  const project = store.createProject({
    kind: 'story',
    aspectRatio: '16:9',
    rawScript: 'Ngày xửa ngày xưa...',
  });

  assert.match(project.id, /^gp_\d+$/);
  assert.equal(project.kind, 'story');
  assert.equal(project.aspectRatio, '16:9');
  assert.equal(project.rawScript, 'Ngày xửa ngày xưa...');
  assert.equal(project.status, 'planning');
  assert.deepEqual(project.scenes, []);
  assert.equal(project.outputPath, null);
  assert.deepEqual(project.publishing, { tiktok: { posted: false, postedAt: null, url: null } });
  assert.ok(project.createdAt);
  assert.equal(project.createdAt, project.updatedAt);
});

test('createProject rejects an unknown kind', () => {
  const store = createStore(tempDataFile());
  assert.throws(
    () => store.createProject({ kind: 'nope', aspectRatio: '16:9', rawScript: 'x' }),
    /Unknown kind/
  );
});

test('getProject returns null for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.equal(store.getProject('gp_does_not_exist'), null);
});

test('updateProject merges fields, bumps updatedAt, and persists across store instances', () => {
  const dataFile = tempDataFile();
  const store = createStore(dataFile);
  const project = store.createProject({ kind: 'handdrawn', aspectRatio: '9:16', rawScript: 'x' });

  const updated = store.updateProject(project.id, { status: 'rendering', scenes: [{ id: 1 }] });
  assert.equal(updated.status, 'rendering');
  assert.deepEqual(updated.scenes, [{ id: 1 }]);
  assert.notEqual(updated.updatedAt, project.createdAt);

  const reopened = createStore(dataFile);
  assert.equal(reopened.getProject(project.id).status, 'rendering');
});

test('updateProject throws for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.throws(() => store.updateProject('gp_missing', { status: 'done' }), /Không tìm thấy project/);
});

test('listProjects returns newest first', () => {
  const store = createStore(tempDataFile());
  const first = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: 'a' });
  const second = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: 'b' });
  const all = store.listProjects();
  assert.deepEqual(all.map((p) => p.id), [second.id, first.id]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test services/videoGenerator/store.test.js`
Expected: FAIL — `Cannot find module './store'`

- [ ] **Step 3: Implement `store.js`**

```js
// services/videoGenerator/store.js
const fs = require('fs');
const path = require('path');

const VALID_KINDS = ['story', 'handdrawn'];

function createStore(dataFile) {
  function getDb() {
    if (fs.existsSync(dataFile)) {
      try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      } catch (e) {
        return { projects: [] };
      }
    }
    return { projects: [] };
  }

  function saveDb(db) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
  }

  function createProject({ kind, aspectRatio, rawScript, lessonText = '' }) {
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Unknown kind: ${kind}`);
    }
    const now = new Date().toISOString();
    const project = {
      id: `gp_${Date.now()}`,
      kind,
      aspectRatio,
      title: '',
      rawScript,
      lessonText,
      meta: {
        theme: kind === 'handdrawn' ? 'warm-orange' : 'dark-cyan',
        voice: 'vi-VN-NamMinhNeural',
        voiceRate: '+0%',
        bgMusic: '',
      },
      scenes: [],
      status: 'planning',
      outputPath: null,
      publishing: { tiktok: { posted: false, postedAt: null, url: null } },
      createdAt: now,
      updatedAt: now,
    };
    const db = getDb();
    db.projects.unshift(project);
    saveDb(db);
    return project;
  }

  function getProject(id) {
    const db = getDb();
    return db.projects.find((p) => p.id === id) || null;
  }

  function updateProject(id, updates) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      throw new Error(`Không tìm thấy project ${id}`);
    }
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
    saveDb(db);
    return project;
  }

  function listProjects() {
    return getDb().projects;
  }

  return { getDb, saveDb, createProject, getProject, updateProject, listProjects };
}

const defaultDataFile = path.join(__dirname, '..', '..', 'storage', 'generated_projects.json');
const defaultStore = createStore(defaultDataFile);

module.exports = { createStore, ...defaultStore };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test services/videoGenerator/store.test.js`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/videoGenerator/store.js services/videoGenerator/store.test.js
git commit -m "Add generated-video project store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Style presets (`services/videoGenerator/stylePresets.js`)

**Files:**
- Create: `services/videoGenerator/stylePresets.js`
- Create: `services/videoGenerator/stylePresets.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `getStylePreset(kind)` → `{ characterStyleBlock: string, directorGuidance: string }`; `getDimensions(aspectRatio)` → `{ width, height }`. `director.js` (Task 7) calls `getStylePreset`; the `/api/video-gen/plan` route (Task 12) calls `getDimensions` to validate the incoming `aspectRatio` early. `Root.tsx` (Task 9) duplicates the same `16:9`→`1280x720` / `9:16`→`720x1280` mapping locally rather than importing it — `my-video-engine` is a separate npm project/workspace from the root `services/`, so it can't `require()` across that boundary without a shared package; keep both maps in sync by hand if this ratio list ever changes.

- [ ] **Step 1: Write the failing test**

```js
// services/videoGenerator/stylePresets.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getStylePreset, getDimensions } = require('./stylePresets');

test('story preset has no hand-drawn keywords', () => {
  const preset = getStylePreset('story');
  assert.match(preset.characterStyleBlock, /3D|Pixar|cinematic/i);
  assert.doesNotMatch(preset.characterStyleBlock, /pencil|crayon|hand-drawn/i);
});

test('handdrawn preset carries the requested keywords', () => {
  const preset = getStylePreset('handdrawn');
  assert.match(preset.characterStyleBlock, /hand-drawn/i);
  assert.match(preset.characterStyleBlock, /blue pencil|crayon/i);
  assert.match(preset.characterStyleBlock, /paper texture/i);
  assert.match(preset.characterStyleBlock, /doodle|sketch/i);
});

test('getStylePreset rejects an unknown kind', () => {
  assert.throws(() => getStylePreset('nope'), /Unknown kind/);
});

test('getDimensions maps aspect ratios to the sizes Remotion renders at', () => {
  assert.deepEqual(getDimensions('16:9'), { width: 1280, height: 720 });
  assert.deepEqual(getDimensions('9:16'), { width: 720, height: 1280 });
});

test('getDimensions rejects an unknown ratio', () => {
  assert.throws(() => getDimensions('1:1'), /Unknown aspectRatio/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test services/videoGenerator/stylePresets.test.js`
Expected: FAIL — `Cannot find module './stylePresets'`

- [ ] **Step 3: Implement `stylePresets.js`**

```js
// services/videoGenerator/stylePresets.js

const STYLE_PRESETS = {
  story: {
    characterStyleBlock:
      'Cute 3D Pixar/Disney animation style, cinematic lighting, warm colorful ' +
      'palette, expressive characters, high quality 3D render, 16:9 or 9:16 as specified.',
    directorGuidance:
      'Mỗi scene mô tả một khoảnh khắc rõ ràng trong câu chuyện, nhân vật nhất quán xuyên suốt.',
  },
  handdrawn: {
    characterStyleBlock:
      'Minimalist hand-drawn 2D explainer animation, doodle animation, sketch animation ' +
      'style, blue pencil/crayon line art, loose sketchy outlines, cream paper texture ' +
      'background, simple flat cartoon characters, no shading, subtle wobble linework, ' +
      'no 3D render, no photorealism, gentle motion only (blinking, slow pan/zoom).',
    directorGuidance:
      'Mỗi scene mô tả một ý đơn giản, phù hợp video giải thích (explainer), nhân vật ' +
      'và phong cách nét vẽ phải nhất quán xuyên suốt tất cả các scene.',
  },
};

const DIMENSIONS_BY_ASPECT_RATIO = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

function getStylePreset(kind) {
  const preset = STYLE_PRESETS[kind];
  if (!preset) {
    throw new Error(`Unknown kind: ${kind}`);
  }
  return preset;
}

function getDimensions(aspectRatio) {
  const dims = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
  if (!dims) {
    throw new Error(`Unknown aspectRatio: ${aspectRatio}`);
  }
  return dims;
}

module.exports = { getStylePreset, getDimensions };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test services/videoGenerator/stylePresets.test.js`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/videoGenerator/stylePresets.js services/videoGenerator/stylePresets.test.js
git commit -m "Add style presets for story vs hand-drawn video generation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Chat-JSON extraction (`services/videoGenerator/chatJson.js`)

This is the pure, testable core of the director's biggest risk (spec §5.1): Gemini's chat reply is free text that may wrap JSON in a markdown fence, add commentary, or use smart quotes. Isolate the parsing logic so it's covered by fast unit tests, independent of the live browser call.

**Files:**
- Create: `services/videoGenerator/chatJson.js`
- Create: `services/videoGenerator/chatJson.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `extractJson(replyText)` → parsed JS object, throws a `JsonExtractionError` (with a `.message` describing why) if no valid JSON object can be found. `director.js` (Task 7) calls this and catches `JsonExtractionError` to trigger its one retry.

- [ ] **Step 1: Write the failing test**

```js
// services/videoGenerator/chatJson.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJson, JsonExtractionError } = require('./chatJson');

test('parses a raw JSON reply with no wrapping', () => {
  const result = extractJson('{"scenes": [{"id": 1}]}');
  assert.deepEqual(result, { scenes: [{ id: 1 }] });
});

test('parses JSON inside a ```json fenced code block', () => {
  const reply = 'Đây là kế hoạch scene của bạn:\n\n```json\n{"scenes": [{"id": 1}]}\n```\n\nBạn thấy sao?';
  assert.deepEqual(extractJson(reply), { scenes: [{ id: 1 }] });
});

test('parses JSON inside a plain ``` fenced code block (no language tag)', () => {
  const reply = '```\n{"scenes": []}\n```';
  assert.deepEqual(extractJson(reply), { scenes: [] });
});

test('parses the first {...} block when there is leading/trailing prose and no fence', () => {
  const reply = 'Chắc chắn rồi! {"scenes": [{"id": 1}]} Hy vọng giúp ích cho bạn.';
  assert.deepEqual(extractJson(reply), { scenes: [{ id: 1 }] });
});

test('throws JsonExtractionError when there is no JSON at all', () => {
  assert.throws(() => extractJson('Xin lỗi, tôi không thể tạo nội dung này.'), JsonExtractionError);
});

test('throws JsonExtractionError when the extracted block is malformed JSON', () => {
  assert.throws(() => extractJson('{"scenes": [id: 1]}'), JsonExtractionError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test services/videoGenerator/chatJson.test.js`
Expected: FAIL — `Cannot find module './chatJson'`

- [ ] **Step 3: Implement `chatJson.js`**

```js
// services/videoGenerator/chatJson.js

class JsonExtractionError extends Error {}

function extractJson(replyText) {
  const fenced = replyText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : findBracedSubstring(replyText);

  if (!candidate) {
    throw new JsonExtractionError('No JSON object found in reply text');
  }

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new JsonExtractionError(`Found a candidate block but it did not parse as JSON: ${err.message}`);
  }
}

function findBracedSubstring(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return text.slice(start, end + 1);
}

module.exports = { extractJson, JsonExtractionError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test services/videoGenerator/chatJson.test.js`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/videoGenerator/chatJson.js services/videoGenerator/chatJson.test.js
git commit -m "Add JSON extraction helper for parsing Gemini chat replies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Shared Gemini chat helper (`services/videoGenerator/geminiChat.js`)

Both the director (text reply) and media generation (image/video reply) need to connect to the same CDP session and find the Gemini tab. Factor that out once instead of duplicating it 3 times like the old root scripts did.

**Files:**
- Create: `services/videoGenerator/geminiChat.js`

**Interfaces:**
- Consumes: `playwright`'s `chromium.connectOverCDP`
- Produces: `connectToGeminiPage(cdpUrl?)` → `Promise<{ browser, page }>` (throws if no `gemini.google.com` tab is found — callers surface this as "mở Chrome với --remote-debugging-port=9222 và đăng nhập Gemini trước"); `sendPromptAndWaitForStableReply(page, promptText, opts?)` → `Promise<string>` (the final reply text, using a stability-polling heuristic: polls the last response bubble's `innerText` every `pollMs`, considers it done once unchanged for `stableChecks` consecutive polls, up to `timeoutMs`).

- [ ] **Step 1: Implement `geminiChat.js`**

No unit test for this file — it requires a live Chrome+Gemini session, same as the pre-existing `gemini_automator.js` it's adapted from (which also has no test). Verified manually in Task 6 Step 2 and again end-to-end in Task 16.

```js
// services/videoGenerator/geminiChat.js
const { chromium } = require('playwright');

const DEFAULT_CDP_URL = 'http://localhost:9222';
const GEMINI_URL = 'https://gemini.google.com/app';

async function connectToGeminiPage(cdpUrl = DEFAULT_CDP_URL) {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('Không tìm thấy Chrome context nào. Hãy mở Chrome với --remote-debugging-port=9222.');
  }
  let page = context.pages().find((p) => p.url().includes('gemini.google.com'));
  if (!page) {
    page = await context.newPage();
    await page.goto(GEMINI_URL, { waitUntil: 'networkidle' });
  }
  return { browser, page };
}

async function sendPromptAndWaitForStableReply(page, promptText, opts = {}) {
  const { timeoutMs = 180000, pollMs = 2000, stableChecks = 2 } = opts;

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await promptInput.first().fill(promptText);
  await promptInput.first().press('Enter');

  const replySelector = 'message-content, .model-response-text, .markdown';
  const reply = page.locator(replySelector).last();
  await reply.waitFor({ state: 'visible', timeout: timeoutMs });

  const start = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    const currentText = (await reply.innerText().catch(() => '')).trim();
    if (currentText && currentText === lastText) {
      stableCount += 1;
      if (stableCount >= stableChecks) {
        return currentText;
      }
    } else {
      stableCount = 0;
    }
    lastText = currentText;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for a stable reply from Gemini`);
}

module.exports = { connectToGeminiPage, sendPromptAndWaitForStableReply, GEMINI_URL, DEFAULT_CDP_URL };
```

- [ ] **Step 2: Manual verification**

Prerequisite: start Chrome with `--remote-debugging-port=9222`, log into Gemini Ultra manually once (same setup this repo already relies on for `gemini_automator.js`).

```bash
node -e "
const { connectToGeminiPage, sendPromptAndWaitForStableReply } = require('./services/videoGenerator/geminiChat');
(async () => {
  const { page } = await connectToGeminiPage();
  const reply = await sendPromptAndWaitForStableReply(page, 'Trả lời chính xác: {\"ok\": true}', { timeoutMs: 60000 });
  console.log('REPLY:', reply);
})();
"
```
Expected: prints a reply containing `{"ok": true}` (possibly with surrounding prose — that's fine, Task 5's `extractJson` handles that). If the selector `message-content, .model-response-text, .markdown` doesn't match Gemini's current DOM, this will time out — in that case, inspect the live page (`page.pause()` via `PWDEBUG=1`) to find the actual response container class/tag and update the `replySelector` constant before moving on. Do not proceed to Task 7 until this manual check prints a reply.

- [ ] **Step 3: Commit**

```bash
git add services/videoGenerator/geminiChat.js
git commit -m "Add shared Gemini Ultra chat helper (connect + send + wait for stable reply)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Director (`services/videoGenerator/director.js`)

**Files:**
- Create: `services/videoGenerator/director.js`
- Create: `services/videoGenerator/director.test.js`

**Interfaces:**
- Consumes: `getStylePreset(kind)` (Task 4), `extractJson`/`JsonExtractionError` (Task 5), `connectToGeminiPage`/`sendPromptAndWaitForStableReply` (Task 6)
- Produces: `buildDirectorPrompt(rawScript, kind)` → prompt string (pure, tested); `planScenes(page, rawScript, kind)` → `Promise<Array<{id, text, imagePrompt, videoPrompt, durationSec}>>` (live, manually verified). Task 11 (server routes) calls `planScenes`.

- [ ] **Step 1: Write the failing test (for the pure prompt-builder only)**

```js
// services/videoGenerator/director.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDirectorPrompt } = require('./director');

test('story prompt embeds the raw script and asks for JSON only', () => {
  const prompt = buildDirectorPrompt('Ngày xửa ngày xưa có một chú thỏ.', 'story');
  assert.match(prompt, /Ngày xửa ngày xưa có một chú thỏ\./);
  assert.match(prompt, /DUY NHẤT.*JSON/is);
  assert.doesNotMatch(prompt, /pencil|crayon/i);
});

test('handdrawn prompt embeds the hand-drawn style block', () => {
  const prompt = buildDirectorPrompt('Giải thích quang hợp.', 'handdrawn');
  assert.match(prompt, /blue pencil|crayon/i);
  assert.match(prompt, /Giải thích quang hợp\./);
});

test('rejects an empty script', () => {
  assert.throws(() => buildDirectorPrompt('   ', 'story'), /kịch bản/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test services/videoGenerator/director.test.js`
Expected: FAIL — `Cannot find module './director'`

- [ ] **Step 3: Implement `director.js`**

```js
// services/videoGenerator/director.js
const { getStylePreset } = require('./stylePresets');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { sendPromptAndWaitForStableReply } = require('./geminiChat');

function buildDirectorPrompt(rawScript, kind) {
  const script = (rawScript || '').trim();
  if (!script) {
    throw new Error('Thiếu kịch bản — không thể chia scene từ kịch bản rỗng.');
  }
  const preset = getStylePreset(kind);

  return `Bạn là đạo diễn AI cho video ngắn.
${preset.directorGuidance}

Kịch bản:
"""
${script}
"""

Style hình ảnh/video áp dụng cho MỌI scene (giữ nguyên các từ khoá này trong mỗi videoPrompt/imagePrompt):
"""
${preset.characterStyleBlock}
"""

Chia kịch bản trên thành 3-8 scene. Trả lời DUY NHẤT một JSON object theo đúng schema sau,
không thêm bất kỳ text nào khác trước hoặc sau JSON:
{
  "scenes": [
    {
      "text": "đoạn lời thoại/nội dung kịch bản mà scene này thể hiện",
      "imagePrompt": "prompt mô tả chi tiết hình ảnh tĩnh của scene này, bao gồm style ở trên",
      "videoPrompt": "prompt mô tả chuyển động camera/nhân vật để biến ảnh thành video, bao gồm style ở trên",
      "durationSec": 6
    }
  ]
}`;
}

async function planScenes(page, rawScript, kind) {
  const prompt = buildDirectorPrompt(rawScript, kind);

  let reply;
  try {
    reply = await sendPromptAndWaitForStableReply(page, prompt);
    return normalizeScenes(extractJson(reply).scenes);
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) {
      throw err;
    }
    // One retry: ask Gemini to reformat as strict JSON, reusing the same chat context.
    const retryReply = await sendPromptAndWaitForStableReply(
      page,
      'Câu trả lời trước không phải JSON hợp lệ. Trả lời lại DUY NHẤT một JSON object hợp lệ theo đúng schema đã yêu cầu, không thêm text nào khác.'
    );
    return normalizeScenes(extractJson(retryReply).scenes);
  }
}

function normalizeScenes(rawScenes) {
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('Director trả về danh sách scene rỗng hoặc không hợp lệ.');
  }
  return rawScenes.map((s, i) => ({
    id: i + 1,
    type: 'media',
    text: s.text || '',
    imagePrompt: s.imagePrompt || '',
    videoPrompt: s.videoPrompt || '',
    durationSec: s.durationSec || 6,
    audioFile: '',
    durationInFrames: Math.round((s.durationSec || 6) * 30),
    mediaStatus: 'pending',
    mediaFile: null,
  }));
}

module.exports = { buildDirectorPrompt, planScenes, normalizeScenes };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test services/videoGenerator/director.test.js`
Expected: all 3 tests PASS

- [ ] **Step 5: Manual verification of `planScenes` (live)**

Prerequisite: Chrome with CDP + Gemini login (same as Task 6 Step 2).

```bash
node -e "
const { connectToGeminiPage } = require('./services/videoGenerator/geminiChat');
const { planScenes } = require('./services/videoGenerator/director');
(async () => {
  const { page } = await connectToGeminiPage();
  const scenes = await planScenes(page, 'Một chú rùa và một chú thỏ thi chạy đua, rùa thắng nhờ kiên trì.', 'story');
  console.log(JSON.stringify(scenes, null, 2));
})();
"
```
Expected: an array of 3-8 objects each with non-empty `text`, `imagePrompt`, `videoPrompt`, and `durationInFrames` a positive multiple-of-30-ish number. If Gemini's reply repeatedly fails `extractJson` even after the retry, tighten the prompt's JSON instructions in `buildDirectorPrompt` before proceeding.

- [ ] **Step 6: Commit**

```bash
git add services/videoGenerator/director.js services/videoGenerator/director.test.js
git commit -m "Add Playwright-based scene director (chat-JSON scene planning)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Media generation (`services/videoGenerator/mediaGen.js`)

Adapts the existing, already-proven `gemini_automator.js` (image download) and `wait_and_download_video.js` (video download) into one parameterized module operating on a project's scenes.

**Files:**
- Create: `services/videoGenerator/mediaGen.js`

**Interfaces:**
- Consumes: `page` (a connected Gemini tab from Task 6)
- Produces: `generateSceneMedia(page, scene, mediaDir)` → `Promise<{ mediaStatus: 'video', mediaFile: string }>` — sends `scene.videoPrompt`, waits for the resulting video, saves it to `<mediaDir>/scene_<id>.mp4`. Task 11 calls this once per scene, in order (never in parallel — single shared browser).

- [ ] **Step 1: Implement `mediaGen.js`**

No unit test — this is inherently a live-browser side effect, same category as `geminiChat.js`. Verified manually in Step 2.

```js
// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');

async function generateSceneMedia(page, scene, mediaDir) {
  fs.mkdirSync(mediaDir, { recursive: true });

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await promptInput.first().fill(scene.videoPrompt);
  await promptInput.first().press('Enter');

  const videoLocator = page.locator('video').last();
  await videoLocator.waitFor({ state: 'visible', timeout: 300000 }); // Veo generations can take minutes

  const outputPath = path.join(mediaDir, `scene_${scene.id}.mp4`);
  const videoSrc = await videoLocator.getAttribute('src');

  if (videoSrc && videoSrc.startsWith('http')) {
    const buffer = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      const ab = await blob.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    }, videoSrc);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  } else {
    const downloadBtn = page
      .locator('button[aria-label*="Tải"], button[aria-label*="Download"], [data-test-id*="download"]')
      .last();
    await downloadBtn.waitFor({ state: 'visible', timeout: 15000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      downloadBtn.click(),
    ]);
    await download.saveAs(outputPath);
  }

  return { mediaStatus: 'video', mediaFile: `media/scene_${scene.id}.mp4` };
}

module.exports = { generateSceneMedia };
```

- [ ] **Step 2: Manual verification (live)**

```bash
node -e "
const { connectToGeminiPage } = require('./services/videoGenerator/geminiChat');
const { generateSceneMedia } = require('./services/videoGenerator/mediaGen');
(async () => {
  const { page } = await connectToGeminiPage();
  const scene = { id: 999, videoPrompt: 'Cute 3D Pixar style white rabbit waving hello, cinematic lighting' };
  const result = await generateSceneMedia(page, scene, './my-video-engine/public/media');
  console.log(result);
})();
"
```
Expected: prints `{ mediaStatus: 'video', mediaFile: 'media/scene_999.mp4' }` and `my-video-engine/public/media/scene_999.mp4` exists and plays. Delete this test file afterward (`rm my-video-engine/public/media/scene_999.mp4`).

- [ ] **Step 3: Commit**

```bash
git add services/videoGenerator/mediaGen.js
git commit -m "Add per-scene media generation (Playwright, adapted from gemini_automator.js)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Remotion changes — lesson scene, aspect ratio

**Files:**
- Modify: `my-video-engine/src/types.ts:16` (add `"lesson"` to `SceneType`), `:7-14` (add `aspectRatio` to `VideoMeta`)
- Modify: `my-video-engine/src/templates/OutroScene.tsx` (make the CTA text/button configurable instead of hardcoded)
- Modify: `my-video-engine/src/VideoComposition.tsx:89-109` (`renderScene` switch — route `"lesson"` to `OutroScene`)
- Modify: `my-video-engine/src/Root.tsx` (use `calculateMetadata` for dynamic width/height)
- Test: `my-video-engine/src/templates/OutroScene.test.tsx` — **skip**, this codebase has no existing component test setup (no test runner configured in `my-video-engine/package.json`); verified by render in Step 5 instead, consistent with how the rest of this Remotion project is validated (visual/render checks, not component unit tests).

**Interfaces:**
- Consumes: `services/videoGenerator/stylePresets.js`'s `getDimensions` mapping (Task 4) — must stay in sync with the width/height values used here.
- Produces: a `"lesson"` scene type that any `Scene` with `type: "lesson"` renders through, and a `video_data.json` whose `meta.aspectRatio` controls the composition's render size. Task 10 (`render.js`) writes both fields.

- [ ] **Step 1: Add `"lesson"` to `SceneType` and `aspectRatio` to `VideoMeta`**

In `my-video-engine/src/types.ts`, change:
```ts
export type SceneType = "headline" | "bullet_points" | "tip" | "outro" | "dialogue" | "story" | "whiteboard" | "media";
```
to:
```ts
export type SceneType = "headline" | "bullet_points" | "tip" | "outro" | "dialogue" | "story" | "whiteboard" | "media" | "lesson";
```

And change:
```ts
export interface VideoMeta {
  title: string;
  theme: ThemeName;
  bgMusic: string;
  musicVolume: number;
  voice?: string;
  voiceRate?: string;
}
```
to:
```ts
export interface VideoMeta {
  title: string;
  theme: ThemeName;
  bgMusic: string;
  musicVolume: number;
  voice?: string;
  voiceRate?: string;
  /** "16:9" (1280x720) or "9:16" (720x1280). Defaults to "16:9" if absent. */
  aspectRatio?: "16:9" | "9:16";
}
```

- [ ] **Step 2: Make `OutroScene.tsx`'s CTA configurable**

Read the current file (already read this session — the hardcoded parts are the rocket SVG icon at lines 99-120 and the `"FOLLOW NGAY ▶"` button text at lines 143-164). Replace the hardcoded button text with `scene.title || "FOLLOW NGAY ▶"` so a lesson scene can pass a different label (e.g. "Bài học rút ra") while a plain outro scene keeps today's default with no data change needed:

Change:
```tsx
            <span
              style={{
                fontSize: 28,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 700,
                color: theme.bg1,
                letterSpacing: "1px",
              }}
            >
              FOLLOW NGAY ▶
            </span>
```
to:
```tsx
            <span
              style={{
                fontSize: 28,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 700,
                color: theme.bg1,
                letterSpacing: "1px",
              }}
            >
              {scene.title || "FOLLOW NGAY ▶"}
            </span>
```

Also change the rocket icon to only render for the default (non-lesson) CTA case, since a book/lightbulb reads better for a moral than a rocket — swap the `<path>` data for a simple lightbulb outline when `scene.type === "lesson"`. Replace the icon block:
```tsx
          <div
            style={{
              transform: `scale(${textSpring}) translateY(${interpolate(frame % 60, [0, 30, 60], [0, -8, 0])}px)`,
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.accent}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>
```
with:
```tsx
          <div
            style={{
              transform: `scale(${textSpring}) translateY(${interpolate(frame % 60, [0, 30, 60], [0, -8, 0])}px)`,
            }}
          >
            {scene.type === "lesson" ? (
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
              </svg>
            ) : (
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
            )}
          </div>
```

- [ ] **Step 3: Route `"lesson"` scenes to `OutroScene` in `VideoComposition.tsx`**

In `renderScene`, change:
```tsx
    case "outro":
      return <OutroScene scene={scene} theme={themeColors} />;
```
to:
```tsx
    case "outro":
    case "lesson":
      return <OutroScene scene={scene} theme={themeColors} />;
```

- [ ] **Step 4: Parameterize `Root.tsx` with `calculateMetadata`**

Replace the whole file:
```tsx
import "./index.css";
import { Composition } from "remotion";
import { VideoComposition, getVideoDuration } from "./VideoComposition";
import videoData from "./data/video_data.json";
import { VideoData } from "./types";

const DIMENSIONS_BY_ASPECT_RATIO: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition}
        durationInFrames={getVideoDuration()}
        fps={30}
        width={1280}
        height={720}
        calculateMetadata={async () => {
          const data = videoData as VideoData;
          const dims = DIMENSIONS_BY_ASPECT_RATIO[data.meta.aspectRatio || "16:9"];
          return { width: dims.width, height: dims.height };
        }}
      />
    </>
  );
};
```

(The `width`/`height` props stay as the Remotion Studio preview defaults; `calculateMetadata` overrides them at render/bundle time from whatever `video_data.json` currently contains — the same file-swap-before-render bridge the rest of this pipeline already relies on.)

- [ ] **Step 5: Verify with Remotion Studio**

```bash
cd my-video-engine
npx remotion studio
```
In the opened browser: confirm the composition preview still loads at 1280x720 for the current `video_data.json` (still has no `aspectRatio` field yet → defaults to 16:9, matches `rua_va_tho_fixed.mp4`). Temporarily edit `video_data.json`'s `meta` to add `"aspectRatio": "9:16"`, save, confirm the Studio preview switches to a 720x1280 portrait frame. Revert that temporary edit (`git checkout -- src/data/video_data.json` or manually remove the field) before continuing — Task 10 will manage this file going forward, not manual edits.

- [ ] **Step 6: Commit**

```bash
cd ..
git add my-video-engine/src/types.ts my-video-engine/src/templates/OutroScene.tsx my-video-engine/src/VideoComposition.tsx my-video-engine/src/Root.tsx
git commit -m "Add lesson scene type and aspect-ratio-aware composition sizing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: TTS module (`services/videoGenerator/ttsGenerator.js`)

Ports the already-fixed `my-video-engine/scripts/tts_generator.js` logic into an importable function operating on a project record instead of the single static `video_data.json`.

**Files:**
- Create: `services/videoGenerator/ttsGenerator.js`
- Create: `services/videoGenerator/ttsGenerator.test.js`

**Interfaces:**
- Consumes: `@andresaya/edge-tts`'s `EdgeTTS` (already a dependency of `my-video-engine`, needs adding to root `package.json` too — Step 1), `music-metadata`'s `parseFile`
- Produces: `generateSceneAudio(scene, voice, rate, audioDir)` → `Promise<Scene>` (mutates-and-returns a copy with `audioFile`/`durationInFrames` set, same contract as the existing fixed script's per-scene function, just parameterized on `audioDir` instead of a hardcoded path). Task 11 calls this once per scene after media generation.

- [ ] **Step 1: Add TTS dependencies to root `package.json`**

```bash
npm install @andresaya/edge-tts music-metadata
```

- [ ] **Step 2: Write the failing test (duration math, not the live TTS call)**

```js
// services/videoGenerator/ttsGenerator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { framesFromDuration } = require('./ttsGenerator');

test('framesFromDuration rounds seconds to frames at 30fps and adds 15-frame padding', () => {
  assert.equal(framesFromDuration(6.48), Math.round(6.48 * 30) + 15);
  assert.equal(framesFromDuration(0), 15);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test services/videoGenerator/ttsGenerator.test.js`
Expected: FAIL — `Cannot find module './ttsGenerator'`

- [ ] **Step 4: Implement `ttsGenerator.js`**

```js
// services/videoGenerator/ttsGenerator.js
const fs = require('fs');
const path = require('path');
const { EdgeTTS } = require('@andresaya/edge-tts');
const { parseFile } = require('music-metadata');

const FPS = 30;
const PADDING_FRAMES = 15;

function framesFromDuration(durationSeconds) {
  return Math.round(durationSeconds * FPS) + PADDING_FRAMES;
}

async function generateSceneAudio(scene, voice, rate, audioDir) {
  fs.mkdirSync(audioDir, { recursive: true });

  const text = (scene.text || '').trim();
  if (!text) {
    return { ...scene, audioFile: '' };
  }

  const audioFileName = `scene_${scene.id}.mp3`;
  const audioPath = path.join(audioDir, audioFileName);

  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, {
    rate: rate || '+0%',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  });
  const buffer = tts.toBuffer();
  if (!buffer || buffer.length === 0) {
    throw new Error(`Empty audio buffer for scene ${scene.id}`);
  }
  fs.writeFileSync(audioPath, buffer);

  const meta = await parseFile(audioPath);
  const durationFrames = framesFromDuration(meta.format.duration || 3);

  return {
    ...scene,
    audioFile: `audio/${audioFileName}`,
    durationInFrames: durationFrames,
  };
}

module.exports = { generateSceneAudio, framesFromDuration };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test services/videoGenerator/ttsGenerator.test.js`
Expected: 2 tests PASS

- [ ] **Step 6: Manual verification (live TTS call)**

```bash
node -e "
const { generateSceneAudio } = require('./services/videoGenerator/ttsGenerator');
(async () => {
  const scene = { id: 998, text: 'Xin chào, đây là bài kiểm tra giọng nói tiếng Việt.' };
  const result = await generateSceneAudio(scene, 'vi-VN-NamMinhNeural', '+0%', './my-video-engine/public/audio');
  console.log(result);
})();
"
```
Expected: prints a scene object with `audioFile: 'audio/scene_998.mp3'` and a `durationInFrames` around 100-140. Confirm `my-video-engine/public/audio/scene_998.mp3` exists and, when played, is a Vietnamese male voice (not English) — this is the exact bug fixed earlier this session, so this check specifically guards against regressing it. Delete the test file afterward (`rm my-video-engine/public/audio/scene_998.mp3`).

- [ ] **Step 7: Commit**

```bash
git add services/videoGenerator/ttsGenerator.js services/videoGenerator/ttsGenerator.test.js package.json package-lock.json
git commit -m "Add TTS module for the video generator pipeline (ported from the fixed tts_generator.js)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Render bridge (`services/videoGenerator/render.js`)

**Files:**
- Create: `services/videoGenerator/render.js`
- Create: `services/videoGenerator/render.test.js`

**Interfaces:**
- Consumes: `getDimensions` is NOT called directly here (Root.tsx's `calculateMetadata` handles sizing from the written `video_data.json`) — this module just needs to know the target `video_data.json` path and the render command.
- Produces: `buildVideoDataJson(project)` → the exact JSON object to write (pure, tested); `renderProject(project)` → `Promise<string>` (absolute path to the rendered file), which writes `video_data.json`, spawns Remotion, and copies the output into `storage/video-gen/<id>/output.mp4`. Task 12 (server routes) calls `renderProject`.

- [ ] **Step 1: Write the failing test (for the pure JSON-builder only)**

```js
// services/videoGenerator/render.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVideoDataJson } = require('./render');

test('builds a video_data.json shape from a project, appending a lesson scene when lessonText is set', () => {
  const project = {
    kind: 'story',
    aspectRatio: '9:16',
    title: 'Rùa và Thỏ',
    lessonText: 'Kiên trì sẽ chiến thắng.',
    meta: { theme: 'dark-cyan', voice: 'vi-VN-NamMinhNeural', voiceRate: '+0%', bgMusic: '' },
    scenes: [
      { id: 1, type: 'media', text: 'Ngày xửa ngày xưa...', audioFile: 'audio/scene_1.mp3', durationInFrames: 300, mediaFile: 'media/scene_1.mp4', mediaStatus: 'video' },
    ],
  };

  const data = buildVideoDataJson(project);

  assert.equal(data.meta.title, 'Rùa và Thỏ');
  assert.equal(data.meta.aspectRatio, '9:16');
  assert.equal(data.scenes.length, 2);
  assert.equal(data.scenes[0].id, 1);
  assert.equal(data.scenes[1].type, 'lesson');
  assert.equal(data.scenes[1].text, 'Kiên trì sẽ chiến thắng.');
  assert.equal(data.scenes[1].title, 'Bài học rút ra');
  assert.ok(data.scenes[1].durationInFrames > 0);
});

test('does not append a lesson scene when lessonText is empty', () => {
  const project = {
    kind: 'handdrawn', aspectRatio: '16:9', title: 'x', lessonText: '',
    meta: { theme: 'warm-orange', voice: 'vi-VN-NamMinhNeural', voiceRate: '+0%', bgMusic: '' },
    scenes: [{ id: 1, type: 'media', text: 'a', audioFile: '', durationInFrames: 100 }],
  };
  const data = buildVideoDataJson(project);
  assert.equal(data.scenes.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test services/videoGenerator/render.test.js`
Expected: FAIL — `Cannot find module './render'`

- [ ] **Step 3: Implement `render.js`**

```js
// services/videoGenerator/render.js
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const MY_VIDEO_ENGINE_DIR = path.join(__dirname, '..', '..', 'my-video-engine');
const VIDEO_DATA_PATH = path.join(MY_VIDEO_ENGINE_DIR, 'src', 'data', 'video_data.json');
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'video-gen');

const LESSON_WORDS_PER_MINUTE = 140;

function estimateLessonDurationFrames(lessonText) {
  const wordCount = lessonText.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(3, (wordCount / LESSON_WORDS_PER_MINUTE) * 60 + 1.5);
  return Math.round(seconds * 30);
}

function buildVideoDataJson(project) {
  const scenes = project.scenes.map((s) => ({ ...s }));

  if (project.lessonText && project.lessonText.trim()) {
    scenes.push({
      id: scenes.length + 1,
      type: 'lesson',
      title: 'Bài học rút ra',
      text: project.lessonText.trim(),
      audioFile: '',
      durationInFrames: estimateLessonDurationFrames(project.lessonText),
    });
  }

  return {
    meta: {
      title: project.title || project.kind,
      theme: project.meta.theme,
      bgMusic: project.meta.bgMusic || '',
      musicVolume: 0.08,
      voice: project.meta.voice,
      voiceRate: project.meta.voiceRate,
      aspectRatio: project.aspectRatio,
    },
    scenes,
  };
}

function renderProject(project) {
  const data = buildVideoDataJson(project);
  fs.writeFileSync(VIDEO_DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  const projectOutputDir = path.join(STORAGE_DIR, project.id);
  fs.mkdirSync(projectOutputDir, { recursive: true });
  const outputPath = path.join(projectOutputDir, 'output.mp4');

  execSync(
    `npx remotion render src/index.ts VideoComposition "${outputPath}" --concurrency=1`,
    { cwd: MY_VIDEO_ENGINE_DIR, stdio: 'inherit' }
  );

  return outputPath;
}

module.exports = { buildVideoDataJson, renderProject, VIDEO_DATA_PATH, estimateLessonDurationFrames };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test services/videoGenerator/render.test.js`
Expected: both tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/videoGenerator/render.js services/videoGenerator/render.test.js
git commit -m "Add render bridge: project record to video_data.json to Remotion render

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Server routes for the new pipeline

**Files:**
- Modify: `server.js` — add requires, a busy-lock, and new routes after the (now-removed) old video-project routes' location, before `app.listen`.

**Interfaces:**
- Consumes: `store.js` (Task 3), `director.js` (Task 7), `mediaGen.js` + `geminiChat.js` (Task 8/6), `ttsGenerator.js` (Task 10), `render.js` (Task 11), `tiktokUploader.js` (already relocated in Task 1)
- Produces: the 6 REST routes the new portal tab (Task 13) calls: `POST /api/video-gen/plan`, `POST /api/video-gen/:id/generate`, `POST /api/video-gen/:id/retry-scene/:sceneId`, `GET /api/video-gen/:id`, `GET /api/video-gen`, `POST /api/video-gen/:id/publish/tiktok`.

- [ ] **Step 1: Add requires and the busy-lock near the top of `server.js`**

After the existing `const minioService = new MinioService();` line, add:

```js
const videoGenStore = require('./services/videoGenerator/store');
const { getDimensions } = require('./services/videoGenerator/stylePresets');
const { connectToGeminiPage } = require('./services/videoGenerator/geminiChat');
const { planScenes } = require('./services/videoGenerator/director');
const { generateSceneMedia } = require('./services/videoGenerator/mediaGen');
const { generateSceneAudio } = require('./services/videoGenerator/ttsGenerator');
const { renderProject } = require('./services/videoGenerator/render');

const MEDIA_DIR = path.join(__dirname, 'my-video-engine', 'public', 'media');
const AUDIO_DIR = path.join(__dirname, 'my-video-engine', 'public', 'audio');

// Only one Playwright-driven generation job may run at a time — there is one
// shared Chrome tab talking to Gemini Ultra (see plan Global Constraints).
let generationBusy = false;
function withGenerationLock(handler) {
  return async (req, res) => {
    if (generationBusy) {
      return res.status(409).json({ error: 'Đang có 1 job tạo video khác chạy, vui lòng đợi.' });
    }
    generationBusy = true;
    try {
      await handler(req, res);
    } finally {
      generationBusy = false;
    }
  };
}
```

Also add the static mount for generated output, alongside the other `storage/*` mounts:
```js
app.use('/storage/video-gen', express.static(path.join(__dirname, 'storage', 'video-gen')));
```

- [ ] **Step 2: Add the routes**

Insert before `app.listen(...)`:

```js
// 23. Tạo project mới + chia scene (Gemini Ultra chat, không tốn phí API)
app.post('/api/video-gen/plan', withGenerationLock(async (req, res) => {
  try {
    const { kind, aspectRatio, rawScript, lessonText, title } = req.body;
    if (!rawScript || !rawScript.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập kịch bản' });
    }
    try {
      getDimensions(aspectRatio); // throws early with a clear message if aspectRatio is invalid
    } catch (dimErr) {
      return res.status(400).json({ error: dimErr.message });
    }
    const project = videoGenStore.createProject({ kind, aspectRatio, rawScript, lessonText: lessonText || '' });
    if (title) videoGenStore.updateProject(project.id, { title });

    const { page } = await connectToGeminiPage();
    const scenes = await planScenes(page, rawScript, kind);

    const updated = videoGenStore.updateProject(project.id, {
      status: 'planned',
      scenes,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi lập kế hoạch scene:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 24. Sinh media + audio cho toàn bộ scene rồi render
app.post('/api/video-gen/:id/generate', withGenerationLock(async (req, res) => {
  try {
    const { id } = req.params;
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });

    videoGenStore.updateProject(id, { status: 'generating_media' });
    const { page } = await connectToGeminiPage();

    for (const scene of project.scenes) {
      if (scene.mediaStatus === 'video') continue; // already generated (retry-safe)
      try {
        const result = await generateSceneMedia(page, scene, MEDIA_DIR);
        scene.mediaStatus = result.mediaStatus;
        scene.mediaFile = result.mediaFile;
        scene.error = null;
      } catch (sceneErr) {
        scene.mediaStatus = 'pending';
        scene.error = sceneErr.message;
      }
      videoGenStore.updateProject(id, { scenes: project.scenes });
    }

    const anyFailed = project.scenes.some((s) => s.mediaStatus !== 'video');
    if (anyFailed) {
      const updated = videoGenStore.updateProject(id, { status: 'media_failed' });
      return res.json({ success: true, data: updated });
    }

    videoGenStore.updateProject(id, { status: 'generating_audio' });
    for (let i = 0; i < project.scenes.length; i++) {
      const audioResult = await generateSceneAudio(
        project.scenes[i],
        project.meta.voice,
        project.meta.voiceRate,
        AUDIO_DIR
      );
      project.scenes[i] = audioResult;
      videoGenStore.updateProject(id, { scenes: project.scenes });
    }

    videoGenStore.updateProject(id, { status: 'rendering' });
    const outputPath = renderProject(videoGenStore.getProject(id));

    const updated = videoGenStore.updateProject(id, { status: 'done', outputPath });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi generate video:', err);
    videoGenStore.updateProject(req.params.id, { status: 'failed' });
    res.status(500).json({ error: err.message });
  }
}));

// 25. Sinh lại media cho 1 scene bị lỗi
app.post('/api/video-gen/:id/retry-scene/:sceneId', withGenerationLock(async (req, res) => {
  try {
    const { id, sceneId } = req.params;
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
    const scene = project.scenes.find((s) => String(s.id) === sceneId);
    if (!scene) return res.status(404).json({ error: 'Không tìm thấy scene' });

    const { page } = await connectToGeminiPage();
    const result = await generateSceneMedia(page, scene, MEDIA_DIR);
    scene.mediaStatus = result.mediaStatus;
    scene.mediaFile = result.mediaFile;
    scene.error = null;

    const updated = videoGenStore.updateProject(id, { scenes: project.scenes });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi retry scene:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 26. Lấy trạng thái 1 project
app.get('/api/video-gen/:id', (req, res) => {
  const project = videoGenStore.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
  res.json({ success: true, data: project });
});

// 27. Danh sách project đã tạo
app.get('/api/video-gen', (req, res) => {
  res.json({ success: true, data: videoGenStore.listProjects() });
});

// 28. Đăng video đã render lên TikTok
app.post('/api/video-gen/:id/publish/tiktok', async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
    if (!project.outputPath || !fs.existsSync(project.outputPath)) {
      return res.status(400).json({ error: 'Video chưa render xong' });
    }

    const finalCaption = caption && caption.trim() ? caption.trim() : (project.title || project.kind);
    const uploadResult = await TikTokUploader.uploadVideo(project.outputPath, finalCaption);

    const updated = videoGenStore.updateProject(id, {
      publishing: { tiktok: { posted: true, postedAt: new Date().toISOString(), url: uploadResult.url || null } },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi đăng TikTok:', err);
    res.status(500).json({ error: err.message });
  }
});
```

Note: `TikTokUploader` is already required at line 243 (per Task 1's relocation) — this new route reuses that same variable, don't re-require it.

- [ ] **Step 3: Verify the server still boots**

```bash
node server.js
```
Expected: same startup line, no errors. `curl http://localhost:3050/api/video-gen` → `{"success":true,"data":[]}`.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "Add server routes for the Playwright-based video generation pipeline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Portal UI — new "Tạo Video AI" tab

**Files:**
- Modify: `public/index.html` — add nav button (in the slot vacated in Task 2) + new tab section
- Modify: `public/app.js` — add `headings` entry, button listeners, and a new module block

**Interfaces:**
- Consumes: the 6 routes from Task 12
- Produces: a working UI. No later task depends on this one's internals.

- [ ] **Step 1: Add the nav button to `public/index.html`**

After the `tab-autopilot` button (in the slot the old `tab-video-factory` button occupied before Task 2 removed it), add:

```html
<button class="nav-item" data-tab="tab-video-gen">
  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect><polygon points="23 7 16 12 23 17 23 7"></polygon></svg>
  <span>6. Tạo Video AI</span>
</button>
```

- [ ] **Step 2: Add the tab section to `public/index.html`**

Before `</main>` (where the old `tab-video-factory` section used to be), add:

```html
<!-- TAB 6: TẠO VIDEO AI (Gemini Ultra + Remotion) -->
<section id="tab-video-gen" class="tab-content">
  <div class="card">
    <div class="card-header">
      <h3>Tạo Video Bằng AI (Kịch bản → Scene → Render)</h3>
      <span class="badge badge-accent">Gemini Ultra + Remotion</span>
    </div>
    <div class="card-body">
      <div class="form-group">
        <label>Loại video:</label>
        <select id="vgKind" class="form-select">
          <option value="story">Kịch bản (3D Pixar style)</option>
          <option value="handdrawn">Hand-drawn 2D explainer</option>
        </select>
      </div>
      <div class="form-group">
        <label>Khung hình:</label>
        <select id="vgAspectRatio" class="form-select">
          <option value="16:9">Ngang 16:9</option>
          <option value="9:16">Dọc 9:16</option>
        </select>
      </div>
      <div class="form-group">
        <label>Tiêu đề:</label>
        <input type="text" id="vgTitle" placeholder="Vd: Rùa và Thỏ" />
      </div>
      <div class="form-group">
        <label>Kịch bản:</label>
        <textarea id="vgScriptInput" rows="6" placeholder="Nhập kịch bản..."></textarea>
      </div>
      <div class="form-group">
        <label>Bài học rút ra (tuỳ chọn, thêm 1 scene cuối video):</label>
        <input type="text" id="vgLessonText" placeholder="Vd: Kiên trì sẽ chiến thắng" />
      </div>
      <button class="btn btn-primary btn-block" id="vgPlanBtn">🎬 Chia Scene</button>

      <div id="vgProjectView" class="vf-project-view" hidden>
        <div id="vgSceneGrid" class="vf-scene-grid"></div>
        <div class="button-row">
          <button class="btn btn-primary" id="vgGenerateBtn" hidden>🎨 Sinh Media + Render</button>
        </div>
        <video id="vgFinalVideo" controls hidden></video>
        <div class="form-group" id="vgPublishBox" hidden>
          <input type="text" id="vgCaption" placeholder="Caption TikTok (tuỳ chọn)" />
          <button class="btn btn-secondary" id="vgPublishBtn">📤 Đăng TikTok</button>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Wire up `public/app.js`**

Add to the `headings` object in `initTabs()` (after `tab-autopilot`'s entry):
```js
'tab-video-gen': { title: 'Tạo Video AI', sub: 'Nhập kịch bản, chọn style, để Gemini Ultra chia scene, sinh media và render qua Remotion' }
```

Add to `setupEventListeners()` (after the autopilot listeners):
```js
// Video Generator listeners
document.getElementById('vgPlanBtn')?.addEventListener('click', vgPlanScenes);
document.getElementById('vgGenerateBtn')?.addEventListener('click', vgGenerateAndRender);
document.getElementById('vgPublishBtn')?.addEventListener('click', vgPublishToTikTok);
```

Add a new module block at the end of the file (after `escapeHtml`):
```js
// 9. VIDEO GENERATOR MODULE FUNCTIONS
let vgCurrentProjectId = null;

async function vgPlanScenes() {
  const rawScript = document.getElementById('vgScriptInput').value.trim();
  if (!rawScript) return alert('Vui lòng nhập kịch bản');

  const btn = document.getElementById('vgPlanBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang chia scene (Gemini Ultra)...';

  try {
    const res = await fetch('/api/video-gen/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: document.getElementById('vgKind').value,
        aspectRatio: document.getElementById('vgAspectRatio').value,
        title: document.getElementById('vgTitle').value.trim(),
        rawScript,
        lessonText: document.getElementById('vgLessonText').value.trim(),
      }),
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);

    vgCurrentProjectId = json.data.id;
    document.getElementById('vgProjectView').hidden = false;
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🎬 Chia Scene';
  }
}

function vgRenderProject(project) {
  const grid = document.getElementById('vgSceneGrid');
  grid.innerHTML = project.scenes.map((scene) => `
    <div class="vf-scene-card">
      <div class="vf-scene-status">${escapeHtml(scene.mediaStatus || 'pending')}</div>
      ${scene.mediaFile ? `<video src="/media/${escapeHtml(scene.mediaFile.split('/').pop())}" muted></video>` : ''}
      <p>${escapeHtml(scene.text)}</p>
      ${scene.mediaStatus !== 'video' ? `<button class="btn btn-secondary" onclick="vgRetryScene('${scene.id}')">Tạo lại media</button>` : ''}
    </div>
  `).join('');

  document.getElementById('vgGenerateBtn').hidden = false;

  if (project.status === 'done' && project.outputPath) {
    const video = document.getElementById('vgFinalVideo');
    video.src = `/storage/video-gen/${project.id}/output.mp4`;
    video.hidden = false;
    document.getElementById('vgPublishBox').hidden = false;
  }
}

async function vgRetryScene(sceneId) {
  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/retry-scene/${sceneId}`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function vgGenerateAndRender() {
  const btn = document.getElementById('vgGenerateBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang sinh media + render (có thể mất vài phút)...';

  // The /generate call blocks server-side until every scene is done (same
  // pattern the old AI Video Factory used) — poll GET /api/video-gen/:id
  // in the background so the scene grid shows live per-scene status
  // instead of staying frozen for the whole duration.
  const pollInterval = setInterval(async () => {
    try {
      const statusRes = await fetch(`/api/video-gen/${vgCurrentProjectId}`);
      const statusJson = await statusRes.json();
      if (statusJson.success) vgRenderProject(statusJson.data);
    } catch (_err) {
      // Ignore transient poll failures — the final fetch below is authoritative.
    }
  }, 4000);

  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/generate`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    clearInterval(pollInterval);
    btn.disabled = false;
    btn.innerText = '🎨 Sinh Media + Render';
  }
}

async function vgPublishToTikTok() {
  const btn = document.getElementById('vgPublishBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang đăng...';
  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/publish/tiktok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: document.getElementById('vgCaption').value.trim() }),
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    alert('Đã đăng TikTok thành công!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '📤 Đăng TikTok';
  }
}
```

Also add a static mount so the scene-preview `<video src="/media/...">` tags in `vgRenderProject` resolve (this serves `my-video-engine/public/media` at the `/media` URL prefix — add alongside the other `app.use('/storage/...')` lines in `server.js` from Task 12 Step 1):
```js
app.use('/media', express.static(path.join(__dirname, 'my-video-engine', 'public', 'media')));
```

- [ ] **Step 4: Manual verification**

```bash
node server.js
```
Open `http://localhost:3050`, click "6. Tạo Video AI". Confirm the form renders (kind/aspect-ratio dropdowns, title, script textarea, lesson input, "Chia Scene" button). Do not run a full generation yet (that's Task 16's end-to-end check) — just confirm the tab renders without console errors (open browser devtools, check no red errors on load or on switching to this tab).

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js server.js
git commit -m "Add Tạo Video AI tab to the portal UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Cleanup — remove superseded root scripts

**Files:**
- Delete: `scripts/send_prompt.js`, `scripts/download_video_direct.js`, `scripts/wait_and_download_video.js`
- Delete: `my-video-engine/scripts/gemini_automator.js` (superseded by `services/videoGenerator/geminiChat.js` + `mediaGen.js`)

**Interfaces:**
- Consumes: nothing
- Produces: nothing later depends on the deleted files (confirmed by the grep in Step 1).

- [ ] **Step 1: Verify nothing still references these files**

Run: `grep -rln "send_prompt\|download_video_direct\|wait_and_download_video\|gemini_automator" --include="*.js" --include="*.json" . -- ':!node_modules'`
Expected: no output (empty), confirming these were manual/ad-hoc entry points, not imported by anything else.

- [ ] **Step 2: Delete the files**

```bash
rm scripts/send_prompt.js scripts/download_video_direct.js scripts/wait_and_download_video.js
rm my-video-engine/scripts/gemini_automator.js
rmdir scripts 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add -A scripts my-video-engine/scripts
git commit -m "Remove one-off Gemini automation scripts superseded by services/videoGenerator/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: Fix `mcp-server` `save_scenario` audio-reset bug

Diagnosed this session: `save_scenario` unconditionally writes `audioFile: ""` on every call, silently wiping out narration that TTS had already generated if the tool is called again on an existing scenario. Low-risk, small, worth fixing now that it's understood, since `mcp-server` is being kept as a secondary interface (spec §6).

**Files:**
- Modify: `mcp-server/src/index.js:114-135` (the `save_scenario` handler)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing else depends on this — it's an isolated bugfix.

- [ ] **Step 1: Read current state and merge instead of overwrite**

In the `save_scenario` handler, change the scene-mapping block from:
```js
      scenes: scenes.map((s) => ({
        id: s.id,
        type: s.type,
        text: s.text,
        audioFile: "",
        durationInFrames: estimateDurationFrames(s.text),
        ...(s.highlightWords ? { highlightWords: s.highlightWords } : {}),
        ...(s.imagePrompt ? { imagePrompt: s.imagePrompt } : {}),
        ...(s.videoPrompt ? { videoPrompt: s.videoPrompt } : {}),
        mediaStatus: "pending",
      })),
```
to:
```js
      scenes: scenes.map((s) => {
        const existing = existingScenesById.get(s.id);
        const textUnchanged = existing && existing.text === s.text;
        return {
          id: s.id,
          type: s.type,
          text: s.text,
          // Only carry forward audio/media from a prior save if this scene's
          // text is unchanged — otherwise stale narration would no longer
          // match what's on screen. New/edited scenes always start blank.
          audioFile: textUnchanged ? existing.audioFile || "" : "",
          durationInFrames: textUnchanged ? existing.durationInFrames : estimateDurationFrames(s.text),
          ...(s.highlightWords ? { highlightWords: s.highlightWords } : {}),
          ...(s.imagePrompt ? { imagePrompt: s.imagePrompt } : {}),
          ...(s.videoPrompt ? { videoPrompt: s.videoPrompt } : {}),
          mediaStatus: textUnchanged && existing.mediaStatus ? existing.mediaStatus : "pending",
          ...(textUnchanged && existing.mediaFile ? { mediaFile: existing.mediaFile } : {}),
        };
      }),
```

And immediately before the `const data = {` assignment in the same handler, add:
```js
    let existingScenesById = new Map();
    try {
      const prior = await readScenario();
      existingScenesById = new Map(prior.scenes.map((s) => [s.id, s]));
    } catch {
      // No prior scenario on disk yet — every scene is new, nothing to carry forward.
    }
```

(`readScenario()` already exists in this file — confirm its exact name/signature by reading `mcp-server/src/index.js` before this step; it's used elsewhere in the file, e.g. by `import_media`.)

- [ ] **Step 2: Manual verification**

```bash
cd mcp-server
node -e "
const fs = require('fs');
// Simulate: existing video_data.json already has audioFile set for scene 1.
fs.writeFileSync('../my-video-engine/src/data/video_data.json', JSON.stringify({
  meta: { title: 'x', theme: 'dark-cyan', bgMusic: '', musicVolume: 0.08 },
  scenes: [{ id: 1, type: 'media', text: 'Same text', audioFile: 'audio/scene_1.mp3', durationInFrames: 200, mediaStatus: 'video', mediaFile: 'media/scene_1.mp4' }]
}, null, 2));
console.log('Seeded fixture. Now call save_scenario via MCP inspector or a manual require of the handler with the same scene id+text and confirm audioFile/mediaFile survive.');
"
```
Since this tool is exposed over MCP (not a plain importable function), the practical check is: run the MCP server, call `save_scenario` with `scenes: [{id: 1, type: 'media', text: 'Same text', ...}]` (text identical to the fixture above), and confirm the resulting `video_data.json` still has `audioFile: "audio/scene_1.mp3"` and `mediaFile: "media/scene_1.mp4"` — not wiped to `""`/absent. Then call it again with `text: 'Different text'` for id 1 and confirm `audioFile` IS reset to `""` (the intentional case — edited text invalidates old narration).

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.js
git commit -m "Fix save_scenario silently wiping audioFile/mediaFile on re-save

Only resets audio/media for scenes whose text actually changed; unchanged
scenes keep their previously-generated narration and media.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: End-to-end verification

Not a code task — a documented manual run confirming the whole merged pipeline works, per the quality bar already approved this session (`rua_va_tho_fixed.mp4`).

**Files:** none

- [ ] **Step 1: Start prerequisites**

```bash
# Terminal 1: Chrome with remote debugging, logged into Gemini Ultra
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="./.chrome_profile"
# (log in manually if the session isn't already active)

# Terminal 2
node server.js
```

- [ ] **Step 2: Run one full "story" project through the portal UI**

Open `http://localhost:3050` → "6. Tạo Video AI" tab. Fill: kind = Kịch bản, aspect ratio = 16:9, title = "Rùa và Thỏ (portal test)", script = a short 3-4 sentence version of the Rùa-và-Thỏ story, lesson = "Kiên trì sẽ chiến thắng.". Click "Chia Scene" → confirm scenes appear with text/status. Click "Sinh Media + Render" and wait (this is the slow step — minutes, per-scene Veo generation time observed earlier this session).

- [ ] **Step 3: Verify the output**

Once done, the tab shows a playable video and a "Đăng TikTok" box appears. Verify with ffprobe (bundled in `my-video-engine/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe`, same tool used earlier this session):

```bash
"my-video-engine/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe" -i storage/video-gen/<project-id>/output.mp4
```
Expected: one video stream (h264, 1280x720, 30fps) and one audio stream (aac, matching the video's duration) — same shape as the already-approved `rua_va_tho_fixed.mp4`, plus one extra scene at the end (the lesson scene) if `lessonText` was provided.

- [ ] **Step 4: Verify a hand-drawn 9:16 project**

Repeat Steps 2-3 with kind = Hand-drawn, aspect ratio = 9:16, a short explainer script (e.g. "giải thích vì sao bầu trời có màu xanh"), no lesson text. Confirm the output video is 720x1280 and the generated scene media visually looks like sketchy line-art rather than 3D Pixar style (spot-check by opening `my-video-engine/public/media/scene_1.mp4` from this run).

- [ ] **Step 5: No commit** — this task only validates prior commits; if any step fails, go back to the relevant task, fix, and re-verify from Step 1.
