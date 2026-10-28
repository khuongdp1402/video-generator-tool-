// services/videoGenerator/director.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDirectorPrompt, normalizeScenes } = require('./director');

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

test('psych_split prompt asks for bilingual textEn and normalizeScenes uses split_media when layoutMode=split', () => {
  const prompt = buildDirectorPrompt('Thói quen cãi lại là sự bào mòn cảm xúc.', 'psych_split');
  assert.match(prompt, /textEn/);
  assert.match(prompt, /Lành Tâm/);
  const scenes = normalizeScenes(
    [{ text: 'Có một kiểu người', textEn: 'Some people, no matter what', imagePrompt: 'a', videoPrompt: 'b' }],
    { layoutMode: 'split' }
  );
  assert.equal(scenes[0].type, 'split_media');
  assert.equal(scenes[0].textEn, 'Some people, no matter what');
});

test('rejects an empty script', () => {
  assert.throws(() => buildDirectorPrompt('   ', 'story'), /kịch bản/i);
});
