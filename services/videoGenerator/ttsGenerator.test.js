// services/videoGenerator/ttsGenerator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { framesFromDuration } = require('./ttsGenerator');

test('framesFromDuration rounds seconds to frames at 30fps and adds 15-frame padding', () => {
  assert.equal(framesFromDuration(6.48), Math.round(6.48 * 30) + 15);
  assert.equal(framesFromDuration(0), 15);
});
