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
