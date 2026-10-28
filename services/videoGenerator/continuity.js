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

module.exports = { extractContinuityFrame, CONTINUITY_DIR };
