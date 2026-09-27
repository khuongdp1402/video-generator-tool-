// services/videoGenerator/ttsGenerator.js
const fs = require('fs');
const path = require('path');
const { EdgeTTS } = require('@andresaya/edge-tts');
const { parseFile } = require('music-metadata');

const FPS = 30;
const PADDING_FRAMES = 15;

function framesFromDuration(durationSeconds) {
  return Math.round(durationSeconds * FPS) + PADDING_FRAMES;
}

async function generateSceneAudio(scene, voice, rate, audioDir) {
  fs.mkdirSync(audioDir, { recursive: true });

  const text = (scene.text || '').trim();
  if (!text) {
    return { ...scene, audioFile: '' };
  }

  const audioFileName = `scene_${scene.id}.mp3`;
  const audioPath = path.join(audioDir, audioFileName);

  let buffer = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tts = new EdgeTTS();
      await tts.synthesize(text, voice, {
        rate: rate || '+0%',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      });
      buffer = tts.toBuffer();
      if (buffer && buffer.length > 0) break;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!buffer || buffer.length === 0) {
    throw new Error(`Empty audio buffer for scene ${scene.id}`);
  }
  fs.writeFileSync(audioPath, buffer);

  const meta = await parseFile(audioPath);
  const durationFrames = framesFromDuration(meta.format.duration || 3);

  return {
    ...scene,
    audioFile: `audio/${audioFileName}`,
    durationInFrames: durationFrames,
  };
}

module.exports = { generateSceneAudio, framesFromDuration };
