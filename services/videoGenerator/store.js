// services/videoGenerator/store.js
const fs = require('fs');
const path = require('path');
const { getMarketPreset } = require('./stylePresets');

const VALID_KINDS = ['story', 'handdrawn', 'minimalist'];

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

  let seq = 0;
  function createProject({
    kind,
    aspectRatio,
    rawScript,
    market = 'VI',
    voice,
    voiceRate,
    lessonText = '',
    title = '',
    youtubeMeta = null,
    meta = {},
    scenes = [],
  }) {
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Unknown kind: ${kind}`);
    }
    const marketPreset = getMarketPreset(market);
    const now = new Date().toISOString();
    seq += 1;
    const project = {
      id: `gp_${Date.now()}${seq > 1 ? String(seq) : ''}`,
      kind,
      market: marketPreset.code,
      aspectRatio,
      title: title || '',
      rawScript,
      lessonText,
      youtubeMeta: youtubeMeta || null,
      meta: {
        theme: kind === 'handdrawn' || kind === 'minimalist' ? 'warm-orange' : 'dark-cyan',
        language: marketPreset.language,
        locale: marketPreset.locale,
        voice: voice || marketPreset.defaultVoice,
        voiceRate: voiceRate || marketPreset.defaultVoiceRate || '+0%',
        bgMusic: '',
        ...meta,
      },
      scenes: scenes || [],
      status: 'planning',
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
    let nextTime = new Date().toISOString();
    if (nextTime === project.updatedAt) {
      nextTime = new Date(Date.now() + 1).toISOString();
    }
    Object.assign(project, updates, { updatedAt: nextTime });
    saveDb(db);
    return project;
  }

  function listProjects() {
    return getDb().projects;
  }

  return { getDb, saveDb, createProject, getProject, updateProject, listProjects };
}

const defaultDataFile = path.join(__dirname, '..', '..', 'storage', 'generated_projects.json');
const defaultStore = createStore(defaultDataFile);

module.exports = { createStore, ...defaultStore };
