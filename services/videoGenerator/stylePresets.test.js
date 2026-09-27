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
