// services/videoGenerator/filmProjects.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFilmProjectStore } = require('./filmProjects');

function tempFilmFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-film-')), 'film_projects.json');
}

test('creates film project, adds scene rules and scoped character/scene assets, and resolves by sceneNo', () => {
  const store = createFilmProjectStore(tempFilmFile());
  const project = store.createFilmProject({
    name: 'Phim ngắn Mùa Hè',
    rules: 'Nhân vật giữ đúng khuôn mặt.',
  });
  assert.match(project.id, /^fp_/);

  store.addSceneRule(project.id, {
    name: 'Trang phục cảnh 3-5',
    sceneStart: 3,
    sceneEnd: 5,
    rules: 'Mặc áo khoác đỏ.',
  });

  store.addAssetsBulk(project.id, [
    { name: 'An', role: 'character', description: 'Nữ chính tóc ngắn', ref: 'uploads/an.png', sceneStart: null, sceneEnd: null },
    { name: 'Quán Cafe', role: 'scene', description: 'Bối cảnh quán gỗ', ref: 'uploads/cafe.png', sceneStart: 3, sceneEnd: 5 },
  ]);

  const ctxScene1 = store.resolveSceneContext(project.id, 1, [], null);
  assert.equal(ctxScene1.sceneRules.length, 0);
  assert.deepEqual(ctxScene1.resolvedRefs, ['uploads/an.png']);

  const ctxScene4 = store.resolveSceneContext(project.id, 4, ['uploads/extra.png'], 'continuity/frame_3.jpg');
  assert.equal(ctxScene4.sceneRules.length, 1);
  assert.equal(ctxScene4.sceneRules[0].rules, 'Mặc áo khoác đỏ.');
  assert.deepEqual(ctxScene4.resolvedRefs, [
    'continuity/frame_3.jpg',
    'uploads/an.png',
    'uploads/cafe.png',
    'uploads/extra.png',
  ]);
});
