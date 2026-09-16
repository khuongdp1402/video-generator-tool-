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
