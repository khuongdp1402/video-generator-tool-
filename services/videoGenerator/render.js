// services/videoGenerator/render.js
const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');
const { getMarketPreset } = require('./stylePresets');

const MY_VIDEO_ENGINE_DIR = path.join(__dirname, '..', '..', 'my-video-engine');
const VIDEO_DATA_PATH = path.join(MY_VIDEO_ENGINE_DIR, 'src', 'data', 'video_data.json');
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'video-gen');

const LESSON_WORDS_PER_MINUTE = 140;

function resolvePythonBin() {
  if (process.env.VIDEO_ENGINE_PYTHON) return process.env.VIDEO_ENGINE_PYTHON;
  const venvPython = path.join(MY_VIDEO_ENGINE_DIR, '.venv', 'bin', 'python3');
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

function estimateLessonDurationFrames(lessonText) {
  const trimmed = (lessonText || '').trim();
  const spaceWords = trimmed.split(/\s+/).filter(Boolean).length;
  // Japanese text has no spaces between words; approximate 3.5 chars per word
  const cjkChars = (trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const effectiveWords = cjkChars > 5 ? Math.max(spaceWords, Math.ceil(cjkChars / 3.5)) : spaceWords;
  const seconds = Math.max(3, (effectiveWords / LESSON_WORDS_PER_MINUTE) * 60 + 1.5);
  return Math.round(seconds * 30);
}

function buildVideoDataJson(project) {
  const marketPreset = getMarketPreset(project.market || 'VI');
  const scenes = project.scenes.map((s) => ({ ...s }));

  if (project.lessonText && project.lessonText.trim()) {
    scenes.push({
      id: scenes.length + 1,
      type: 'lesson',
      title: marketPreset.lessonTitle,
      text: project.lessonText.trim(),
      audioFile: '',
      durationInFrames: estimateLessonDurationFrames(project.lessonText),
    });
  }

  return {
    meta: {
      title: project.title || project.kind,
      market: marketPreset.code,
      language: project.meta?.language || marketPreset.language,
      locale: project.meta?.locale || marketPreset.locale,
      theme: project.meta.theme,
      bgMusic: project.meta.bgMusic || '',
      musicVolume: 0.08,
      voice: project.meta.voice || marketPreset.defaultVoice,
      voiceRate: project.meta.voiceRate || marketPreset.defaultVoiceRate || '+0%',
      aspectRatio: project.aspectRatio,
    },
    scenes,
  };
}

function renderProject(project) {
  const data = buildVideoDataJson(project);
  fs.mkdirSync(path.dirname(VIDEO_DATA_PATH), { recursive: true });
  fs.writeFileSync(VIDEO_DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  const projectOutputDir = path.join(STORAGE_DIR, project.id);
  fs.mkdirSync(projectOutputDir, { recursive: true });
  const outputPath = path.join(projectOutputDir, 'output.mp4');

  const remotionEntry = path.join(MY_VIDEO_ENGINE_DIR, 'src', 'index.ts');
  if (fs.existsSync(remotionEntry)) {
    execSync(
      `npx remotion render src/index.ts VideoComposition "${outputPath}" --concurrency=1`,
      { cwd: MY_VIDEO_ENGINE_DIR, stdio: 'inherit' }
    );
  } else {
    const pythonBin = resolvePythonBin();
    execFileSync(
      pythonBin,
      ['render_engine.py', '--data', VIDEO_DATA_PATH, '--output', outputPath],
      { cwd: MY_VIDEO_ENGINE_DIR, stdio: 'inherit' }
    );
  }

  return outputPath;
}

module.exports = {
  buildVideoDataJson,
  renderProject,
  VIDEO_DATA_PATH,
  estimateLessonDurationFrames,
  resolvePythonBin,
};
