// services/videoGenerator/promptWriter.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPromptWriterStore } = require('./promptWriter');

function tempPwFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-pw-')), 'prompt_writer.json');
}

test('initializes with default Lành Tâm psychology skill and free Gemini Ultra Web profile', () => {
  const store = createPromptWriterStore(tempPwFile());
  const state = store.getState();
  assert.ok(state.skills.some((s) => s.id === 'skill_lanh_tam_psych'));
  assert.ok(state.profiles.some((p) => p.provider === 'gemini_web'));
});

test('generates single and bulk prompts using custom chatRunner or fallback', async () => {
  const store = createPromptWriterStore(tempPwFile());
  const single = await store.generateSingle(
    { brief: 'Tính cách phản bác trong giao tiếp', skillId: 'skill_lanh_tam_psych' },
    async (prompt) => `Kịch bản từ Gemini: ${prompt.slice(0, 20)}`
  );
  assert.match(single.prompt, /^Kịch bản từ Gemini:/);

  const bulk = await store.generateBulk(
    { submode: 'variations', brief: 'Thói quen trì hoãn', count: 2 },
    async () => 'Kịch bản biến thể hoàn chỉnh'
  );
  assert.equal(bulk.prompts.length, 2);
  assert.equal(bulk.prompts[0].set_name, 'Biến thể #1');
});
