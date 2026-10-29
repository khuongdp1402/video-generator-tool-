const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_CDP_URL,
  DEFAULT_MUSE_URL,
  buildMuseFullVideoPrompt,
  buildMuseSceneVideoPrompt,
  planScenesWithMuse,
} = require('./museChat');

test('DEFAULT_CDP_URL and DEFAULT_MUSE_URL have sensible defaults', () => {
  assert.equal(DEFAULT_CDP_URL, 'http://localhost:9222');
  assert.equal(DEFAULT_MUSE_URL, 'https://muse.ai');
});

test('buildMuseFullVideoPrompt includes market language, aspect ratio, and script/topic', () => {
  const promptUS = buildMuseFullVideoPrompt({
    topic: 'Atomic Habits 1% Rule',
    rawScript: 'Most people think discipline is willpower.',
    kind: 'story',
    market: 'US',
    aspectRatio: '16:9',
  });
  assert.match(promptUS, /en-US/);
  assert.match(promptUS, /16:9/);
  assert.match(promptUS, /Most people think discipline is willpower/);

  const promptJP = buildMuseFullVideoPrompt({
    topic: '1日1%の改善',
    kind: 'handdrawn',
    market: 'JP',
    aspectRatio: '9:16',
  });
  assert.match(promptJP, /ja-JP/);
  assert.match(promptJP, /9:16/);
  assert.match(promptJP, /1日1%の改善/);
});

test('planScenesWithMuse parses JSON scenes returned from Muse page', async () => {
  const replyPayload = JSON.stringify({
    title: '小さな習慣の力',
    lessonText: '1日1%の積み重ねが人生を変える',
    scenes: [
      {
        id: 1,
        text: '小さな習慣が人生を変える。',
        videoPrompt: 'Cinematic Tokyo sunrise timelapse, warm golden light, 4k',
        highlightWords: ['習慣', '人生'],
      },
    ],
  });

  const mockLocator = {
    first() {
      return this;
    },
    last() {
      return this;
    },
    async count() {
      return 1;
    },
    async isVisible() {
      return false;
    },
    async waitFor() {
      return true;
    },
    async click() {},
    async fill() {},
    async press() {},
    async innerText() {
      return replyPayload;
    },
  };

  const mockPage = {
    locator() {
      return mockLocator;
    },
    async waitForTimeout() {},
  };

  // Pass custom fast poll via sendMusePromptAndWaitForReply default behavior
  const planRes = await planScenesWithMuse(mockPage, '小さな習慣が人生を変える。', 'story', 'JP');
  assert.equal(planRes.title, '小さな習慣の力');
  assert.equal(planRes.scenes.length, 1);
  assert.equal(planRes.scenes[0].id, 1);
  assert.equal(planRes.scenes[0].text, '小さな習慣が人生を変える。');
  assert.equal(planRes.scenes[0].mediaStatus, 'pending');
  assert.match(planRes.scenes[0].videoPrompt, /Tokyo sunrise/);
});

test('buildMuseSceneVideoPrompt formats distinct prompts for image_to_video, text_to_video, video_to_video, and image_stitch', () => {
  const scene = {
    id: 1,
    text: 'Thói quen nhỏ tạo nên thay đổi lớn.',
    imagePrompt: 'Minimalist sunrise over mountain',
    videoPrompt: 'Camera slowly pans across mountain peak',
  };

  const i2v = buildMuseSceneVideoPrompt(scene, { generationMode: 'image_to_video', title: 'KỶ LUẬT TỰ GIÁC' });
  assert.match(i2v, /animate the attached reference keyframe image/i);
  assert.match(i2v, /KỶ LUẬT TỰ GIÁC/);

  const t2v = buildMuseSceneVideoPrompt(scene, { generationMode: 'text_to_video', title: 'KỶ LUẬT TỰ GIÁC' });
  assert.match(t2v, /animated MP4 video clip for this scene/i);

  const v2v = buildMuseSceneVideoPrompt(scene, { generationMode: 'video_to_video', title: 'KỶ LUẬT TỰ GIÁC' });
  assert.match(v2v, /video-to-video transformation/i);

  const stitch = buildMuseSceneVideoPrompt(scene, { generationMode: 'image_stitch', title: 'KỶ LUẬT TỰ GIÁC' });
  assert.match(stitch, /illustration image right now/i);
});

