// services/videoGenerator/continuity.js
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

const CONTINUITY_DIR = path.join(__dirname, '..', '..', 'storage', 'continuity');

/**
 * Extract a frame at `secondsBeforeEnd` (e.g. 0.3, 1, 2, 3) before the end of `videoPath`.
 * Returns the absolute path to the extracted JPEG frame.
 */
function extractContinuityFrame(videoPath, outputName, secondsBeforeEnd = 0.3) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Không tìm thấy file video nguồn để trích xuất khung nối: ${videoPath}`);
  }
  fs.mkdirSync(CONTINUITY_DIR, { recursive: true });
  const offset = Math.max(0.1, Math.min(9.5, Number(secondsBeforeEnd) || 0.3));
  const safeName = String(outputName || `frame_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const outPath = path.join(CONTINUITY_DIR, `${safeName}_${offset.toString().replace('.', 'p')}s.jpg`);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .inputOptions([`-sseof -${offset}`])
      .outputOptions(['-frames:v 1', '-q:v 2', '-y'])
      .output(outPath)
      .on('end', () => {
        if (fs.existsSync(outPath)) {
          resolve(outPath);
        } else {
          reject(new Error('FFmpeg không tạo được file ảnh khung nối cảnh'));
        }
      })
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Extract multiple motion reference frames (e.g. start, middle, end) from a source video
 * for Video-to-Video (V2V) conditioning and motion continuity.
 */
async function extractVideoMotionFrames(videoPath, outputPrefix, offsetsBeforeEnd = [2.5, 1.2, 0.3]) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Không tìm thấy file video nguồn để trích xuất chuỗi chuyển động V2V: ${videoPath}`);
  }
  const frames = [];
  for (let i = 0; i < offsetsBeforeEnd.length; i++) {
    try {
      const framePath = await extractContinuityFrame(
        videoPath,
        `${outputPrefix}_v2v_f${i + 1}`,
        offsetsBeforeEnd[i]
      );
      frames.push(framePath);
    } catch (_err) {
      // Fallback to 0.3s if video is shorter than offset
      if (frames.length === 0) {
        const fallbackFrame = await extractContinuityFrame(videoPath, `${outputPrefix}_v2v_fallback`, 0.2);
        frames.push(fallbackFrame);
      }
    }
  }
  return frames;
}

module.exports = { extractContinuityFrame, extractVideoMotionFrames, CONTINUITY_DIR };
