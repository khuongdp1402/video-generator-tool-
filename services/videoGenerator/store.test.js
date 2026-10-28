const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createStore } = require('./store');

function tempDataFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-gen-store-'));
  return path.join(dir, 'projects.json');
}

test('createProject returns a project with the expected shape and defaults', () => {
  const store = createStore(tempDataFile());
  const project = store.createProject({
    kind: 'story',
    aspectRatio: '16:9',
    rawScript: 'Bắt đầu từ một ngày bình thường...',
  });

  assert.match(project.id, /^gp_\d+_[a-z0-9]+$/);
  assert.equal(project.kind, 'story');
  assert.equal(project.aspectRatio, '16:9');
  assert.equal(project.rawScript, 'Bắt đầu từ một ngày bình thường...');
  assert.equal(project.status, 'planning');
  assert.equal(project.meta.theme, 'dark-cyan');
  assert.equal(project.meta.voice, 'vi-VN-NamMinhNeural');
  assert.equal(project.meta.voiceRate, '+0%');
  assert.deepEqual(project.scenes, []);
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

test('createProject supports psych_split with split layoutMode and refs', () => {
  const store = createStore(tempDataFile());
  const project = store.createProject({
    kind: 'psych_split',
    aspectRatio: '9:16',
    title: 'TÍNH CÁCH PHẢN BÁC',
    channelName: 'LÀNH TÂM',
    rawScript: 'Thói quen cãi lại...',
    refs: ['ref1.png', 'ref2.png'],
  });
  assert.equal(project.layoutMode, 'split');
  assert.equal(project.channelName, 'LÀNH TÂM');
  assert.deepEqual(project.refs, ['ref1.png', 'ref2.png']);
});

test('createProject rejects an unknown kind', () => {
  const store = createStore(tempDataFile());
  assert.throws(() => {
    store.createProject({ kind: 'unknown_kind', aspectRatio: '16:9', rawScript: '...' });
  }, /Unknown kind: unknown_kind/);
});

test('getProject returns null for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.equal(store.getProject('does_not_exist'), null);
});

test('updateProject merges fields, bumps updatedAt, and persists across store instances', () => {
  const dataFile = tempDataFile();
  const store1 = createStore(dataFile);
  const project = store1.createProject({
    kind: 'handdrawn',
    aspectRatio: '9:16',
    rawScript: 'Kịch bản thử nghiệm',
  });

  const updated = store1.updateProject(project.id, {
    status: 'ready',
    scenes: [{ id: 1, type: 'media', text: 'Scene 1', durationSec: 5 }],
  });

  assert.equal(updated.status, 'ready');
  assert.equal(updated.scenes.length, 1);

  const store2 = createStore(dataFile);
  const reloaded = store2.getProject(project.id);
  assert.equal(reloaded.status, 'ready');
  assert.equal(reloaded.scenes.length, 1);
});

test('updateProject throws for an unknown id', () => {
  const store = createStore(tempDataFile());
  assert.throws(() => {
    store.updateProject('ghost_id', { status: 'ready' });
  }, /Không tìm thấy project ghost_id/);
});

test('listProjects returns newest first', () => {
  const store = createStore(tempDataFile());
  const p1 = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: '1' });
  const p2 = store.createProject({ kind: 'story', aspectRatio: '16:9', rawScript: '2' });
  const list = store.listProjects();
  assert.equal(list[0].id, p2.id);
  assert.equal(list[1].id, p1.id);
});
