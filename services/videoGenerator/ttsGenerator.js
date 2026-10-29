// services/videoGenerator/ttsGenerator.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FPS = 30;
const PADDING_FRAMES = 15;
const TIGHT_SCENE_PADDING_FRAMES = 4; // ~0.13s để chuyển cảnh nhanh, gãy gọn chuẩn TikTok/Shorts
const MY_VIDEO_ENGINE_DIR = path.join(__dirname, '..', '..', 'my-video-engine');

function framesFromDuration(durationSeconds, paddingFrames = PADDING_FRAMES) {
  return Math.round(durationSeconds * FPS) + paddingFrames;
}

function resolvePythonBin() {
  if (process.env.VIDEO_ENGINE_PYTHON) return process.env.VIDEO_ENGINE_PYTHON;
  const venvPython = path.join(MY_VIDEO_ENGINE_DIR, '.venv', 'bin', 'python3');
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

function resolveFfmpegBin() {
  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    if (installer && installer.path && fs.existsSync(installer.path)) {
      return installer.path;
    }
  } catch (_e) {}
  return 'ffmpeg';
}

/**
 * Làm sạch văn bản trước khi đưa vào bộ đọc TTS để giọng đọc trôi chảy,
 * gãy gọn, không bị khựng ở dấu ngoặc tiếng Anh hoặc nghỉ quá lâu ở dấu hai chấm.
 */
function cleanSpokenText(rawText, voice = 'vi-VN-NamMinhNeural') {
  let text = String(rawText || '').trim();
  if (!text) return '';

  const isVietnamese = String(voice || '').toLowerCase().startsWith('vi');
  if (isVietnamese) {
    // Loại bỏ phần chú thích tiếng Anh trong ngoặc đơn/vuông (VD: "(Habitual Contradiction)")
    // để giọng Việt không đánh vần tiếng Anh ngượng nghịu; phụ đề trên hình vẫn giữ nguyên.
    text = text.replace(/\s*\([A-Za-z0-9\s\-/,.'"]+\)/g, '');
    text = text.replace(/\s*\[[A-Za-z0-9\s\-/,.'"]+\]/g, '');
  }

  // Thay thế các dấu câu gây nghỉ dài bất thường bằng dấu phẩy nhịp ngắn
  text = text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*[:;]\s*/g, ', ')
    .replace(/\.{2,}|…/g, '.')
    .replace(/[""«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text || String(rawText || '').trim();
}

/**
 * Tự động tối ưu tốc độ đọc (Rate) và độ trầm/sáng (Pitch) để giọng nghe thật,
 * nhanh và gãy gọn chuẩn nhịp TikTok / YouTube Shorts.
 */
function resolveEffectiveProsody(voice = 'vi-VN-NamMinhNeural', rate = '+0%', pitch = null) {
  const v = String(voice || 'vi-VN-NamMinhNeural');
  const rawRate = String(rate || '').trim();

  // Nếu rate đang để mặc định chậm (+0% hoặc -5%), tự động đẩy lên nhịp nhanh gãy gọn
  let effectiveRate = rawRate;
  if (!effectiveRate || effectiveRate === '+0%' || effectiveRate === '0%' || effectiveRate === '-5%') {
    if (v.startsWith('vi-')) {
      effectiveRate = '+18%';
    } else if (v.startsWith('ja-')) {
      effectiveRate = '+12%';
    } else {
      effectiveRate = '+14%';
    }
  } else if (!effectiveRate.startsWith('+') && !effectiveRate.startsWith('-')) {
    effectiveRate = `+${effectiveRate}`;
  }

  let effectivePitch = pitch;
  if (!effectivePitch) {
    if (v.includes('NamMinh')) {
      effectivePitch = '-2Hz'; // Trầm ấm, dày giọng như thu âm podcast
    } else if (v.includes('HoaiMy')) {
      effectivePitch = '+1Hz'; // Sáng, rõ chữ, sắc sảo
    } else if (v.includes('Andrew')) {
      effectivePitch = '-1Hz';
    } else {
      effectivePitch = '+0Hz';
    }
  }

  return { voice: v, rate: effectiveRate, pitch: effectivePitch };
}

/**
 * Xử lý hậu kỳ âm thanh bằng FFmpeg:
 * 1. Cắt bỏ khoảng lặng đầu/cuối và rút ngắn các nhịp nghỉ giữa câu (>0.12s -> 0.12s) giúp câu văn gãy gọn, dứt khoát.
 * 2. Cân chỉnh EQ phòng thu (tăng độ ấm trầm 185Hz + độ sắc nét phát âm 3.6kHz) và Compressor giúp giọng thật và đầy đặn.
 */
function postProcessStudioVoice(audioPath) {
  if (!fs.existsSync(audioPath)) return;
  const ffmpegBin = resolveFfmpegBin();
  const tempOut = `${audioPath}.studio.mp3`;

  const filterChain = [
    'highpass=f=75',
    'equalizer=f=185:t=q:w=1.2:g=2.4',
    'equalizer=f=3600:t=q:w=1.4:g=2.2',
    'acompressor=threshold=-18dB:ratio=2.4:attack=8:release=85:makeup=2',
    'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.12:stop_threshold=-42dB',
    'apad=pad_dur=0.05',
  ].join(',');

  try {
    execFileSync(
      ffmpegBin,
      [
        '-y',
        '-i',
        audioPath,
        '-af',
        filterChain,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-b:a',
        '64k',
        tempOut,
      ],
      { stdio: 'ignore', timeout: 15000 }
    );

    if (fs.existsSync(tempOut) && fs.statSync(tempOut).size > 256) {
      fs.renameSync(tempOut, audioPath);
    } else if (fs.existsSync(tempOut)) {
      fs.unlinkSync(tempOut);
    }
  } catch (_err) {
    if (fs.existsSync(tempOut)) {
      try {
        fs.unlinkSync(tempOut);
      } catch (_e) {}
    }
  }
}

/**
 * Tạo file wordTimestamps thông minh dựa trên độ dài từ và dấu câu sau khi đã nén khoảng lặng,
 * giúp phụ đề Karaoke trên video chạy khớp nhịp nói nhanh.
 */
function writeSyncedWordTimestamps(displayText, durationSeconds, wordsPath, voice = 'vi-VN') {
  const cleanDisplay = String(displayText || '').trim();
  if (!cleanDisplay) return [];

  const isJa = String(voice || '').toLowerCase().startsWith('ja') && !cleanDisplay.includes(' ');
  const tokens = isJa
    ? Array.from({ length: Math.ceil(cleanDisplay.length / 3) }, (_, i) => cleanDisplay.slice(i * 3, i * 3 + 3))
    : cleanDisplay.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return [];

  const weights = tokens.map((tok) => {
    const baseLen = Math.max(2, tok.replace(/[.,!?;:()"'[\]]/g, '').length);
    const hasMajorPause = /[.!?。！？]$/.test(tok) ? 1.35 : /[,;:、]$/.test(tok) ? 1.18 : 1.0;
    return Math.pow(baseLen, 0.65) * hasMajorPause;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
  const usableDuration = Math.max(0.4, durationSeconds - 0.04);

  let cursor = 0;
  const words = tokens.map((tok, idx) => {
    const span = (weights[idx] / totalWeight) * usableDuration;
    const start = Number(cursor.toFixed(3));
    const end = Number(Math.min(durationSeconds, cursor + span).toFixed(3));
    cursor += span;
    return { word: tok, start, end };
  });

  if (wordsPath) {
    try {
      fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2), 'utf-8');
    } catch (_e) {}
  }
  return words;
}

/**
 * Ưu tiên 1: Sử dụng Python edge-tts >= 7.3.1 trong my-video-engine/.venv
 * (Đã có bản vá DRM Sec-MS-GEC v2 mới nhất của Microsoft Azure Neural Voice).
 * Tự động retry tối đa 4 lần để không bao giờ rơi nhầm xuống giọng Google Translate nữ.
 */
function synthesizeWithPythonEdgeTts(text, voice, rate, pitch, audioPath) {
  const pythonBin = resolvePythonBin();
  const pyScript = `
import asyncio, os, sys, edge_tts

async def main():
    text, voice, rate, pitch, out_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
    last_err = None
    for attempt in range(1, 5):
        try:
            use_pitch = pitch if attempt <= 2 else "+0Hz"
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=use_pitch)
            await comm.save(out_path)
            if os.path.exists(out_path) and os.path.getsize(out_path) > 256:
                return
        except Exception as e:
            last_err = e
            await asyncio.sleep(0.6 * attempt)
    if last_err:
        raise last_err

asyncio.run(main())
`.trim();

  execFileSync(pythonBin, ['-c', pyScript, text, voice, rate, pitch, audioPath], {
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 45000,
  });
  return fs.existsSync(audioPath) && fs.statSync(audioPath).size > 256;
}

async function generateSceneAudio(scene, voice, rate, audioDir, opts = {}) {
  fs.mkdirSync(audioDir, { recursive: true });

  const isLesson = scene.type === 'lesson';
  const rawText = isLesson
    ? scene.title && !String(scene.text || '').toLowerCase().startsWith(String(scene.title).toLowerCase())
      ? `${scene.title}. ${scene.text || ''}`
      : scene.text || ''
    : scene.text || '';

  const text = rawText.trim();
  if (!text) {
    return { ...scene, audioFile: '' };
  }

  const spokenText = cleanSpokenText(text, voice);
  const prosody = resolveEffectiveProsody(voice, rate, opts.pitch || scene.pitch);

  const filePrefix = opts.projectId ? `${opts.projectId}_scene_${scene.id}` : `scene_${scene.id}`;
  const audioFileName = `${filePrefix}.mp3`;
  const wordsFileName = `${filePrefix}_words.json`;
  const audioPath = path.join(audioDir, audioFileName);
  const wordsPath = path.join(audioDir, wordsFileName);

  let synthesized = false;

  // Tầng 1: Python edge-tts >= 7.3.1 (Giọng Neural Microsoft chuẩn phòng thu, ví dụ vi-VN-NamMinhNeural)
  try {
    synthesized = synthesizeWithPythonEdgeTts(
      spokenText,
      prosody.voice,
      prosody.rate,
      prosody.pitch,
      audioPath
    );
  } catch (pyErr) {
    console.warn(`[TTS] Python edge-tts (${prosody.voice}) gặp lỗi:`, pyErr.stderr ? pyErr.stderr.toString() : pyErr.message);
    synthesized = false;
  }

  // Tầng 2: Node @andresaya/edge-tts
  if (!synthesized) {
    try {
      const { EdgeTTS } = require('@andresaya/edge-tts');
      let buffer = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const tts = new EdgeTTS();
          await tts.synthesize(spokenText, prosody.voice, {
            rate: prosody.rate,
            pitch: prosody.pitch,
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          });
          buffer = tts.toBuffer();
          if (buffer && buffer.length > 0) break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (buffer && buffer.length > 0) {
        fs.writeFileSync(audioPath, buffer);
        synthesized = true;
      }
    } catch (_nodeTtsErr) {
      // Tầng 3: Fallback cuối cùng nếu mất kết nối tới Azure Edge TTS
      const prefix = String(prosody.voice || 'en-US').split('-')[0].toLowerCase();
      const tl = prefix === 'en' ? 'en-US' : prefix === 'ja' ? 'ja' : 'vi';
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(spokenText.slice(0, 200))}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        fs.writeFileSync(audioPath, Buffer.from(arrBuf));
        synthesized = fs.existsSync(audioPath);
      }
    }
  }

  if (!synthesized || !fs.existsSync(audioPath)) {
    throw new Error(`Failed to synthesize audio for scene ${scene.id}`);
  }

  // Hậu kỳ âm thanh Studio: cắt khoảng lặng thừa + làm ấm & rõ giọng
  postProcessStudioVoice(audioPath);

  let durationSeconds = 3.5;
  try {
    const { parseFile } = require('music-metadata');
    const meta = await parseFile(audioPath);
    durationSeconds = meta.format.duration || 3.5;
  } catch (_metaErr) {
    const stat = fs.statSync(audioPath);
    // 64kbps mono mp3 is ~8000 bytes/sec
    durationSeconds = Math.max(1.5, stat.size / 8000);
  }

  writeSyncedWordTimestamps(scene.text || text, durationSeconds, wordsPath, prosody.voice);

  const durationFrames = framesFromDuration(durationSeconds, TIGHT_SCENE_PADDING_FRAMES);

  return {
    ...scene,
    audioFile: `audio/${audioFileName}`,
    wordTimestamps: `audio/${wordsFileName}`,
    durationInFrames: durationFrames,
  };
}

module.exports = {
  generateSceneAudio,
  framesFromDuration,
  cleanSpokenText,
  resolveEffectiveProsody,
  postProcessStudioVoice,
};


