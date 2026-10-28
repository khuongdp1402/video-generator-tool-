const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_CDP_URL,
  DEFAULT_MUSE_URL,
  buildMuseFullVideoPrompt,
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
