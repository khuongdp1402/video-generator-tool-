// services/videoGenerator/store.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('./store');

function tempDataFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-store-')), 'generated_projects.json');
}

test('createProject returns a project with the expected shape and defaults', () => {
  const store = createStore(tempDataFile());
  const project = store.createProject({
    kind: 'story',
    aspectRatio: '16:9',
    rawScript: 'Ngày xửa ngày xưa...',
  });

  assert.match(project.id, /^gp_\d+$/);
  assert.equal(project.kind, 'story');
  assert.equal(project.aspectRatio, '16:9');
  assert.equal(project.rawScript, 'Ngày xửa ngày xưa...');
  assert.equal(project.status, 'planning');
  assert.deepEqual(project.scenes, []);
  assert.equal(project.outputPath, null);
  assert.deepEqual(project.publishing, { tiktok: { posted: false, postedAt: null, url: null } });
  assert.ok(project.createdAt);
  assert.equal(project.createdAt, project.updatedAt);
});

test('createProject configures US and JP market defaults', () => {
  const store = createStore(tempDataFile());
  const jpProject = store.createProject({
    kind: 'story',
    aspectRatio: '16:9',
    rawScript: '毎日の習慣が未来を作る。',
    market: 'JP',
  });
  assert.equal(jpProject.market, 'JP');
  assert.equal(jpProject.meta.locale, 'ja-JP');
  assert.equal(jpProject.meta.voice, 'ja-JP-KeitaNeural');
});

test('createProject rejects an unknown kind', () => {
  const store = createStore(tempDataFile());
  assert.throws(
    () => store.createProject({ kind: 'nope', aspectRatio: '16:9', rawScript: 'x' }),
    /Unknown kind/
  );
});

test('getProject returns null for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.equal(store.getProject('gp_does_not_exist'), null);
});

test('updateProject merges fields, bumps updatedAt, and persists across store instances', () => {
  const dataFile = tempDataFile();
  const store = createStore(dataFile);
  const project = store.createProject({ kind: 'handdrawn', aspectRatio: '9:16', rawScript: 'x' });

  const updated = store.updateProject(project.id, { status: 'rendering', scenes: [{ id: 1 }] });
  assert.equal(updated.status, 'rendering');
  assert.deepEqual(updated.scenes, [{ id: 1 }]);
  assert.notEqual(updated.updatedAt, project.createdAt);

  const reopened = createStore(dataFile);
  assert.equal(reopened.getProject(project.id).status, 'rendering');
});

test('updateProject throws for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.throws(() => store.updateProject('gp_missing', { status: 'done' }), /Không tìm thấy project/);
});

test('listProjects returns newest first', () => {
  const store = createStore(tempDataFile());
  const first = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: 'a' });
  const second = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: 'b' });
  const all = store.listProjects();
  assert.deepEqual(all.map((p) => p.id), [second.id, first.id]);
});
