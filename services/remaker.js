const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

class VideoRemaker {
  /**
   * Tính mã MD5 của file
   */
  static getFileMD5(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Xử lý Remake Video với các bộ lọc lách thuật toán
   * @param {string} inputPath - Đường dẫn file video gốc
   * @param {string} outputPath - Đường dẫn file video xuất ra
   * @param {object} options - Cấu hình bộ lọc
   */
  static async processVideo(inputPath, outputPath, options = {}) {
    const {
      flipHorizontal = true,
      zoomCrop = true,         // Zoom nhẹ 4% và crop
      colorGrade = true,       // Chỉnh màu nhẹ
      speedAdjust = 1.02,      // Đổi tốc độ 1.02x
      pitchShift = true,       // Đổi tần số âm thanh
      stripMetadata = true,
      removeChineseSub = true, // Tự động cắt bỏ phụ đề tiếng Trung đáy
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      const videoFilters = [];
      const audioFilters = [];

      // 1. Lật gương ngang
      if (flipHorizontal) {
        videoFilters.push('hflip');
      }

      // 2. Cắt bỏ phụ đề tiếng Trung ở đáy hoặc Zoom & Crop nhẹ
      if (removeChineseSub) {
        // Cắt bỏ 13% viền dưới chứa phụ đề tiếng Trung, sau đó phóng to đều lại kích thước chuẩn
        videoFilters.push('crop=in_w:in_h*0.87:0:0,scale=in_w:in_h:flags=lanczos');
      } else if (zoomCrop) {
        videoFilters.push('scale=1.04*iw:-1,crop=iw/1.04:ih/1.04');
      }

      // 3. Tinh chỉnh màu sắc (tương phản +3%, bão hòa màu +4%, độ sáng nhẹ)
      if (colorGrade) {
        videoFilters.push('eq=contrast=1.03:brightness=0.01:saturation=1.04');
      }

      // 4. Đổi tốc độ video & âm thanh
      if (speedAdjust && speedAdjust !== 1.0) {
        // Tăng/giảm tốc độ khung hình
        videoFilters.push(`setpts=${(1 / speedAdjust).toFixed(4)}*PTS`);
        audioFilters.push(`atempo=${speedAdjust}`);
      }

      // 5. Đổi tần số âm thanh (Tránh thuật toán audio fingerprint)
      if (pitchShift) {
        audioFilters.push('asetrate=44100*1.015,aresample=44100');
      }

      if (videoFilters.length > 0) {
        command.videoFilters(videoFilters);
      }

      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters);
      }

      // Xóa metadata cũ, thêm metadata ngẫu nhiên để đổi hash MD5
      if (stripMetadata) {
        command.outputOptions([
          '-map_metadata', '-1',
          '-metadata', `title=remake_${Date.now()}`,
          '-metadata', `comment=uuid_${crypto.randomUUID()}`
        ]);
      }

      // Codec chuẩn H264 + AAC tương thích tốt nhất với TikTok & YouTube Shorts
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions(['-preset', 'fast', '-crf', '22', '-movflags', '+faststart'])
        .on('start', (cmdLine) => {
          console.log('[Remaker] Lệnh FFmpeg:', cmdLine);
        })
        .on('progress', (progress) => {
          if (options.onProgress) {
            options.onProgress(Math.round(progress.percent || 0));
          }
        })
        .on('error', (err) => {
          console.error('[Remaker] Lỗi xử lý:', err);
          reject(err);
        })
        .on('end', () => {
          const originalMd5 = fs.existsSync(inputPath) ? VideoRemaker.getFileMD5(inputPath) : '';
          const remadeMd5 = fs.existsSync(outputPath) ? VideoRemaker.getFileMD5(outputPath) : '';
          const originalSize = fs.statSync(inputPath).size;
          const remadeSize = fs.statSync(outputPath).size;

          resolve({
            success: true,
            outputPath,
            originalMd5,
            remadeMd5,
            originalSize,
            remadeSize,
            appliedFilters: {
              flipHorizontal,
              zoomCrop,
              colorGrade,
              speedAdjust,
              pitchShift,
              stripMetadata
            }
          });
        })
        .save(outputPath);
    });
  }
}

module.exports = VideoRemaker;
