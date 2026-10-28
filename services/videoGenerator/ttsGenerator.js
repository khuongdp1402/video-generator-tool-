// services/videoGenerator/ttsGenerator.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FPS = 30;
const PADDING_FRAMES = 15;

function framesFromDuration(durationSeconds) {
  return Math.round(durationSeconds * FPS) + PADDING_FRAMES;
}

async function generateSceneAudio(scene, voice, rate, audioDir) {
  fs.mkdirSync(audioDir, { recursive: true });

  if (scene.type === 'lesson') {
    return { ...scene, audioFile: '' };
  }

  const text = (scene.text || '').trim();
  if (!text) {
    return { ...scene, audioFile: '' };
  }

  const audioFileName = `scene_${scene.id}.mp3`;
  const audioPath = path.join(audioDir, audioFileName);

  let synthesized = false;
  try {
    const { EdgeTTS } = require('@andresaya/edge-tts');
    let buffer = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tts = new EdgeTTS();
        await tts.synthesize(text, voice, {
          rate: rate || '+0%',
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        });
        buffer = tts.toBuffer();
        if (buffer && buffer.length > 0) break;
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (buffer && buffer.length > 0) {
      fs.writeFileSync(audioPath, buffer);
      synthesized = true;
    }
  } catch (_nodeTtsErr) {
    // Fallback to Google Translate TTS HTTPS stream (supports en-US, ja, vi)
    const prefix = String(voice || 'en-US').split('-')[0].toLowerCase();
    const tl = prefix === 'en' ? 'en-US' : prefix === 'ja' ? 'ja' : 'vi';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(text.slice(0, 200))}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const arrBuf = await res.arrayBuffer();
      fs.writeFileSync(audioPath, Buffer.from(arrBuf));
      synthesized = fs.existsSync(audioPath);
    }
  }

  if (!synthesized || !fs.existsSync(audioPath)) {
    throw new Error(`Failed to synthesize audio for scene ${scene.id}`);
  }

  let durationSeconds = 4;
  try {
    const { parseFile } = require('music-metadata');
    const meta = await parseFile(audioPath);
    durationSeconds = meta.format.duration || 4;
  } catch (_metaErr) {
    const stat = fs.statSync(audioPath);
    // 48kbps mono mp3 is ~6000 bytes/sec
    durationSeconds = Math.max(2, stat.size / 6000);
  }

  const durationFrames = framesFromDuration(durationSeconds);

  return {
    ...scene,
    audioFile: `audio/${audioFileName}`,
    durationInFrames: durationFrames,
  };
}

module.exports = { generateSceneAudio, framesFromDuration };

