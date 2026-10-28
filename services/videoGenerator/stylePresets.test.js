const test = require('node:test');
const assert = require('node:assert/strict');
const { getStylePreset, listStylePresets, getDimensions, getMarketPreset } = require('./stylePresets');

test('story preset has no hand-drawn keywords', () => {
  const preset = getStylePreset('story');
  assert.equal(/hand-drawn/i.test(preset.characterStyleBlock), false);
  assert.equal(/doodle/i.test(preset.characterStyleBlock), false);
});

test('handdrawn preset carries the requested keywords', () => {
  const preset = getStylePreset('handdrawn');
  assert.equal(/hand-drawn/i.test(preset.characterStyleBlock), true);
  assert.equal(/doodle/i.test(preset.characterStyleBlock), true);
  assert.equal(/no 3D render/i.test(preset.characterStyleBlock), true);
  assert.equal(/no photorealism/i.test(preset.characterStyleBlock), true);
});

test('psych_split, pictogram, psych_surreal, anime, cinematic presets are registered', () => {
  const list = listStylePresets();
  assert.ok(list.length >= 8);
  const ids = list.map((p) => p.id);
  assert.ok(ids.includes('psych_split'));
  assert.ok(ids.includes('pictogram'));
  assert.ok(ids.includes('psych_surreal'));
  assert.ok(ids.includes('minimalist'));
  assert.ok(ids.includes('anime'));
  assert.ok(ids.includes('cinematic'));
});

test('getStylePreset rejects an unknown kind', () => {
  assert.throws(() => getStylePreset('nonexistent'), /Unknown kind: nonexistent/);
});

test('getDimensions maps aspect ratios to the sizes Remotion renders at', () => {
  assert.deepEqual(getDimensions('16:9'), { width: 1920, height: 1080 });
  assert.deepEqual(getDimensions('9:16'), { width: 1080, height: 1920 });
});

test('getDimensions rejects an unknown ratio', () => {
  assert.throws(() => getDimensions('4:3'), /Unknown aspect ratio/);
});

test('getMarketPreset returns US and JP presets with native neural voices and locales', () => {
  const us = getMarketPreset('US');
  assert.equal(us.code, 'US');
  assert.equal(us.locale, 'en-US');
  assert.ok(us.voices.length >= 2);

  const jp = getMarketPreset('JP');
  assert.equal(jp.code, 'JP');
  assert.equal(jp.locale, 'ja-JP');
  assert.ok(jp.voices.length >= 2);

  assert.throws(() => getMarketPreset('INVALID'), /Unknown market: INVALID/);
});
