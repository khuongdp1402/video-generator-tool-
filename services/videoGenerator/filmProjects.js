// services/videoGenerator/filmProjects.js
const fs = require('fs');
const path = require('path');

const MAX_REFERENCE_IMAGES = 8;
const DEFAULT_RULES =
  'Giữ nhận diện khuôn mặt và đặc điểm nhân vật nhất quán. Trang phục, địa điểm, ánh sáng và đạo cụ theo mô tả của từng cảnh.';

function createFilmProjectStore(dataFile) {
  function getDb() {
    if (fs.existsSync(dataFile)) {
      try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      } catch (e) {
        return { projects: [], assets: [], sceneRules: [] };
      }
    }
    return { projects: [], assets: [], sceneRules: [] };
  }

  function saveDb(db) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
  }

  function listFilmProjects() {
    return getDb().projects;
  }

  function getFilmProject(id) {
    return getDb().projects.find((p) => p.id === id) || null;
  }

  function createFilmProject({ name, rules = DEFAULT_RULES, outputDir = '' }) {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Hãy nhập tên dự án phim');
    const now = new Date().toISOString();
    const project = {
      id: `fp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      rules: (rules || DEFAULT_RULES).trim(),
      outputDir: (outputDir || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    const db = getDb();
    db.projects.unshift(project);
    saveDb(db);
    return project;
  }

  function updateFilmProject(id, updates) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error(`Không tìm thấy dự án phim ${id}`);
    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim();
      if (!cleanName) throw new Error('Tên dự án không được để trống');
      project.name = cleanName;
    }
    if (updates.rules !== undefined) project.rules = String(updates.rules).trim();
    if (updates.outputDir !== undefined) project.outputDir = String(updates.outputDir).trim();
    project.updatedAt = new Date().toISOString();
    saveDb(db);
    return project;
  }

  function deleteFilmProject(id) {
    const db = getDb();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Không tìm thấy dự án phim ${id}`);
    db.projects.splice(idx, 1);
    db.assets = db.assets.filter((a) => a.projectId !== id);
    db.sceneRules = db.sceneRules.filter((r) => r.projectId !== id);
    saveDb(db);
    return { deleted: true };
  }

  function addSceneRule(projectId, { name, sceneStart, sceneEnd, rules }) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Không tìm thấy dự án phim');
    const start = Number(sceneStart);
    const end = Number(sceneEnd);
    if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) {
      throw new Error('Khoảng cảnh không hợp lệ');
    }
    const rule = {
      id: `fsr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      name: (name || `Cảnh ${start}–${end}`).trim(),
      sceneStart: start,
      sceneEnd: end,
      rules: (rules || '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.sceneRules.push(rule);
    saveDb(db);
    return rule;
  }

  function deleteSceneRule(ruleId) {
    const db = getDb();
    db.sceneRules = db.sceneRules.filter((r) => r.id !== ruleId);
    saveDb(db);
    return { deleted: true };
  }

  function addAssetsBulk(projectId, assetsList) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Không tìm thấy dự án phim');
    if (!Array.isArray(assetsList) || assetsList.length === 0) {
      throw new Error('Danh sách ảnh trống');
    }
    const created = [];
    for (const item of assetsList) {
      const start = item.sceneStart != null && item.sceneStart !== '' ? Number(item.sceneStart) : null;
      const end = item.sceneEnd != null && item.sceneEnd !== '' ? Number(item.sceneEnd) : null;
      const asset = {
        id: `fa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        name: (item.name || 'Ảnh dự án').trim(),
        role: ['character', 'scene', 'prop', 'style'].includes(item.role) ? item.role : 'character',
        description: (item.description || '').trim(),
        ref: item.ref,
        sceneStart: start,
        sceneEnd: end,
        createdAt: new Date().toISOString(),
      };
      db.assets.push(asset);
      created.push(asset);
    }
    saveDb(db);
    return created;
  }

  function updateCharacterAssets(projectId, { oldName, name, images = [] }) {
    const db = getDb();
    const targetName = (oldName || name || '').trim().toLowerCase();
    for (const img of images) {
      const asset = db.assets.find((a) => a.id === img.id && a.projectId === projectId);
      if (asset) {
        if (name) asset.name = name.trim();
        if (img.description !== undefined) asset.description = String(img.description).trim();
        asset.sceneStart = img.sceneStart != null && img.sceneStart !== '' ? Number(img.sceneStart) : null;
        asset.sceneEnd = img.sceneEnd != null && img.sceneEnd !== '' ? Number(img.sceneEnd) : null;
      }
    }
    if (name && targetName) {
      for (const a of db.assets) {
        if (a.projectId === projectId && a.role === 'character' && a.name.toLowerCase() === targetName) {
          a.name = name.trim();
        }
      }
    }
    saveDb(db);
    return db.assets.filter((a) => a.projectId === projectId);
  }

  function deleteAsset(assetId) {
    const db = getDb();
    db.assets = db.assets.filter((a) => a.id !== assetId);
    saveDb(db);
    return { deleted: true };
  }

  function listProjectAssets(projectId) {
    const db = getDb();
    return projectId ? db.assets.filter((a) => a.projectId === projectId) : db.assets;
  }

  function listProjectSceneRules(projectId) {
    const db = getDb();
    return projectId ? db.sceneRules.filter((r) => r.projectId === projectId) : db.sceneRules;
  }

  /**
   * Resolves all active rules, matching assets, and reference image paths (max 8)
   * for a given `projectId` and `sceneNo`.
   */
  function resolveSceneContext(projectId, sceneNo = 1, directRefs = [], continuityRef = null) {
    const db = getDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) {
      return {
        filmRules: '',
        sceneRules: [],
        filmAssets: [],
        resolvedRefs: [...(directRefs || []), ...(continuityRef ? [continuityRef] : [])].slice(0, MAX_REFERENCE_IMAGES),
      };
    }

    const num = Number(sceneNo) || 1;
    const activeSceneRules = db.sceneRules.filter(
      (r) => r.projectId === projectId && r.sceneStart <= num && num <= r.sceneEnd
    );
    const activeAssets = db.assets.filter(
      (a) =>
        a.projectId === projectId &&
        (a.sceneStart == null || (a.sceneStart <= num && num <= (a.sceneEnd || a.sceneStart)))
    );

    const refSet = new Set();
    const resolvedImages = [];

    if (continuityRef) {
      refSet.add(continuityRef);
      resolvedImages.push({ role: 'continuity', name: 'Khung nối cảnh trước', ref: continuityRef });
    }
    for (const a of activeAssets) {
      if (a.ref && !refSet.has(a.ref) && resolvedImages.length < MAX_REFERENCE_IMAGES) {
        refSet.add(a.ref);
        resolvedImages.push({ role: a.role, name: a.name, description: a.description, ref: a.ref });
      }
    }
    for (const r of directRefs || []) {
      if (r && !refSet.has(r) && resolvedImages.length < MAX_REFERENCE_IMAGES) {
        refSet.add(r);
        resolvedImages.push({ role: 'task', name: path.basename(r), ref: r });
      }
    }

    return {
      filmRules: project.rules || DEFAULT_RULES,
      sceneRules: activeSceneRules,
      filmAssets: activeAssets,
      resolvedImages,
      resolvedRefs: resolvedImages.map((img) => img.ref),
    };
  }

  return {
    getDb,
    listFilmProjects,
    getFilmProject,
    createFilmProject,
    updateFilmProject,
    deleteFilmProject,
    addSceneRule,
    deleteSceneRule,
    addAssetsBulk,
    updateCharacterAssets,
    deleteAsset,
    listProjectAssets,
    listProjectSceneRules,
    resolveSceneContext,
  };
}

const defaultFilmFile = path.join(__dirname, '..', '..', 'storage', 'film_projects.json');
const defaultFilmStore = createFilmProjectStore(defaultFilmFile);

module.exports = { createFilmProjectStore, MAX_REFERENCE_IMAGES, DEFAULT_RULES, ...defaultFilmStore };
