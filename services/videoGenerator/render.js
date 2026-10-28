// services/videoGenerator/render.js
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const MY_VIDEO_ENGINE_DIR = path.join(__dirname, '..', '..', 'my-video-engine');
const VIDEO_DATA_PATH = path.join(MY_VIDEO_ENGINE_DIR, 'src', 'data', 'video_data.json');
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'video-gen');

const LESSON_WORDS_PER_MINUTE = 140;

function estimateLessonDurationFrames(lessonText) {
  const wordCount = lessonText.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(3, (wordCount / LESSON_WORDS_PER_MINUTE) * 60 + 1.5);
  return Math.round(seconds * 30);
}

function buildVideoDataJson(project) {
  const layoutMode = project.layoutMode || (project.meta && project.meta.layoutMode) || (project.kind === 'psych_split' ? 'split' : 'fullscreen');
  const scenes = project.scenes.map((s) => ({
    ...s,
    type: layoutMode === 'split' && (!s.type || s.type === 'media') ? 'split_media' : (s.type || 'media'),
  }));

  if (project.lessonText && project.lessonText.trim()) {
    scenes.push({
      id: scenes.length + 1,
      type: 'lesson',
      title: 'Bài học rút ra',
      text: project.lessonText.trim(),
      audioFile: '',
      durationInFrames: estimateLessonDurationFrames(project.lessonText),
    });
  }

  return {
    meta: {
      title: project.title || project.kind,
      theme: (project.meta && project.meta.theme) || 'dark-cyan',
      bgMusic: (project.meta && project.meta.bgMusic) || '',
      musicVolume: 0.08,
      voice: (project.meta && project.meta.voice) || 'vi-VN-NamMinhNeural',
      voiceRate: (project.meta && project.meta.voiceRate) || '+0%',
      aspectRatio: project.aspectRatio || '9:16',
      layoutMode,
      channelName: project.channelName || (project.meta && project.meta.channelName) || 'LÀNH TÂM',
    },
    scenes,
  };
}

function renderProject(project) {
  const data = buildVideoDataJson(project);
  fs.writeFileSync(VIDEO_DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  const projectOutputDir = path.join(STORAGE_DIR, project.id);
  fs.mkdirSync(projectOutputDir, { recursive: true });
  const outputPath = path.join(projectOutputDir, 'output.mp4');

  execSync(
    `npx remotion render src/index.ts VideoComposition "${outputPath}" --concurrency=1`,
    { cwd: MY_VIDEO_ENGINE_DIR, stdio: 'inherit' }
  );

  return outputPath;
}

module.exports = { buildVideoDataJson, renderProject, VIDEO_DATA_PATH, estimateLessonDurationFrames };
