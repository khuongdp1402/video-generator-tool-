// services/videoGenerator/store.js
const fs = require('fs');
const path = require('path');

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

  function createProject({ kind, aspectRatio, rawScript, lessonText = '', title = '', meta = {}, scenes = [] }) {
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Unknown kind: ${kind}`);
    }
    const now = new Date().toISOString();
    const project = {
      id: `gp_${Date.now()}`,
      kind,
      aspectRatio,
      title: title || '',
      rawScript,
      lessonText,
      meta: {
        theme: kind === 'handdrawn' || kind === 'minimalist' ? 'warm-orange' : 'dark-cyan',
        voice: 'vi-VN-NamMinhNeural',
        voiceRate: '+0%',
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
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
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
