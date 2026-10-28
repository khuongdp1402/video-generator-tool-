// services/videoGenerator/store.js
const fs = require('fs');
const path = require('path');
const { VALID_KINDS, getStylePreset } = require('./stylePresets');

function createStore(dataFile) {
  function getDb() {
    if (fs.existsSync(dataFile)) {
      try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      } catch (e) {
        return { projects: [] };
      }
    }
    return { projects: [] };
  }

  function saveDb(db) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
  }

  function createProject({
    kind,
    aspectRatio,
    rawScript,
    lessonText = '',
    title = '',
    channelName = 'LÀNH TÂM',
    layoutMode = null,
    targetDuration = 30,
    projectId = null,
    sceneNo = null,
    predecessorId = null,
    continuityOffset = 0.3,
    refs = [],
    accountId = null,
    meta = {},
    scenes = [],
    status = 'planning',
  }) {
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Unknown kind: ${kind}`);
    }
    const preset = getStylePreset(kind);
    const resolvedLayout = layoutMode || preset.defaultLayout || 'fullscreen';
    const now = new Date().toISOString();
    const project = {
      id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      aspectRatio: aspectRatio || preset.defaultAspectRatio || '9:16',
      title: title || '',
      channelName: channelName || 'LÀNH TÂM',
      layoutMode: resolvedLayout,
      targetDuration: Number(targetDuration) || 30,
      projectId: projectId || null,
      sceneNo: sceneNo != null ? Number(sceneNo) : null,
      predecessorId: predecessorId || null,
      continuityOffset: Number(continuityOffset) || 0.3,
      refs: Array.isArray(refs) ? refs.slice(0, 8) : [],
      accountId: accountId || null,
      threadUrl: null,
      error: null,
      rawScript,
      lessonText,
      meta: {
        theme: kind === 'handdrawn' || kind === 'minimalist' ? 'warm-orange' : kind === 'psych_split' || kind === 'psych_surreal' ? 'dark-purple' : 'dark-cyan',
        voice: 'vi-VN-NamMinhNeural',
        voiceRate: '+0%',
        bgMusic: '',
        layoutMode: resolvedLayout,
        channelName: channelName || 'LÀNH TÂM',
        ...meta,
      },
      scenes: scenes || [],
      status,
      outputPath: null,
      publishing: { tiktok: { posted: false, postedAt: null, url: null } },
      createdAt: now,
      updatedAt: now,
    };
    const db = getDb();
    db.projects.unshift(project);
    saveDb(db);
    return project;
  }

  function getProject(id) {
    const db = getDb();
    return db.projects.find((p) => p.id === id) || null;
  }

  function updateProject(id, updates) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      throw new Error(`Không tìm thấy project ${id}`);
    }
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
    saveDb(db);
    return project;
  }

  function deleteProject(id) {
    const db = getDb();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    db.projects.splice(idx, 1);
    saveDb(db);
    return true;
  }

  function listProjects() {
    return getDb().projects;
  }

  return { getDb, saveDb, createProject, getProject, updateProject, deleteProject, listProjects };
}

const defaultDataFile = path.join(__dirname, '..', '..', 'storage', 'generated_projects.json');
const defaultStore = createStore(defaultDataFile);

module.exports = { createStore, ...defaultStore };
