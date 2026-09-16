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
