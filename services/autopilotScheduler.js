const fs = require('fs');
const path = require('path');
const TikTokUploader = require('./tiktokUploader');
const { scanAllTargets } = require('./channelWatcher');

const LOGS_FILE = path.join(__dirname, '../storage/autopilot_logs.json');
const DATA_FILE = path.join(__dirname, '../storage/database.json');
const CONFIG_FILE = path.join(__dirname, '../storage/autopilot_config.json');

class AutopilotScheduler {
  constructor() {
    this.timer = null;
    this.scanTimer = null;
    this.isRunning = false;
    this.config = this.loadConfig();
    this.lastPostedSlot = null;
  }

  loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
      try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
    }
    const defaultCfg = {
      enabled: false,
      slots: ['11:30', '17:30', '20:30', '22:30'],
      autoScanHours: 4,
      defaultHashtags: '#mukbang #asmr #doanvat #fyp #xuhuong #foodtok',
      autoRemake: true
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultCfg, null, 2));
    return defaultCfg;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  logEvent(type, message, details = {}) {
    let logs = [];
    if (fs.existsSync(LOGS_FILE)) {
      try { logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8')); } catch (e) {}
    }
    const entry = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('vi-VN'),
      type,
      message,
      details
    };
    logs.unshift(entry);
    if (logs.length > 50) logs = logs.slice(0, 50);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    console.log(`[Autopilot] [${type}] ${message}`);
  }

  getLogs() {
    if (fs.existsSync(LOGS_FILE)) {
      try { return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8')); } catch (e) {}
    }
    return [];
  }

  getQueue() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
      const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return db.videos.filter(v => v.remakeUrl && !v.postedToTikTok);
    } catch (e) {
      return [];
    }
  }

  /**
   * Đăng ngay 1 video tiếp theo trong hàng đợi
   */
  async postNextVideoNow() {
    const queue = this.getQueue();
    if (queue.length === 0) {
      this.logEvent('WARNING', 'Hàng đợi trống! Không có video nào sẵn sàng để đăng.');
      return { success: false, message: 'Hàng đợi trống! Bạn hãy tải thêm video hoặc bật quét kênh.' };
    }

    const video = queue[0];
    const fileName = video.remakeFileName || video.rawFileName;
    const folder = video.remakeFileName ? 'remake' : 'raw';
    const filePath = path.join(__dirname, '../storage', folder, fileName);

    const caption = `${video.title.slice(0, 75)} ${this.config.defaultHashtags}`;
    this.logEvent('INFO', `Bắt đầu đăng video: "${video.title}" lên TikTok...`);

    try {
      const result = await TikTokUploader.uploadVideo(filePath, caption);

      // Cập nhật database
      const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const item = db.videos.find(v => v.id === video.id);
      if (item) {
        item.postedToTikTok = true;
        item.postedAt = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
      }

      this.logEvent('SUCCESS', `Đăng thành công video: "${video.title}" lên TikTok!`);
      return { success: true, message: 'Đăng video thành công!', videoId: video.id };
    } catch (err) {
      this.logEvent('ERROR', `Lỗi đăng video: ${err.message}`);
      throw err;
    }
  }

  /**
   * Khởi động vòng lặp tự động hóa (Autopilot Loop)
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.saveConfig({ enabled: true });
    this.logEvent('SYSTEM', 'Đã BẬT cỗ máy tự động hóa Autopilot (Đăng 2-4 video/ngày).');

    // 1. Kiểm tra lịch đăng bài mỗi phút
    this.timer = setInterval(async () => {
      await this.checkScheduleAndPost();
    }, 60 * 1000);

    // 2. Định kỳ quét kênh mới mỗi 4 tiếng
    const scanIntervalMs = (this.config.autoScanHours || 4) * 60 * 60 * 1000;
    this.scanTimer = setInterval(async () => {
      this.logEvent('AUTOSCAN', 'Bắt đầu quét video mới từ các kênh mục tiêu...');
      try {
        await scanAllTargets();
        this.logEvent('AUTOSCAN', 'Quét và remake video mới hoàn tất!');
      } catch (e) {
        this.logEvent('ERROR', `Lỗi tự động quét kênh: ${e.message}`);
      }
    }, scanIntervalMs);
  }

  /**
   * Dừng cỗ máy tự động
   */
  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.saveConfig({ enabled: false });
    this.logEvent('SYSTEM', 'Đã TẮT cỗ máy tự động hóa Autopilot.');
  }

  /**
   * So khớp giờ hiện tại với các khung giờ vàng
   */
  async checkScheduleAndPost() {
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayDate = now.toISOString().slice(0, 10);

    for (const slot of this.config.slots) {
      const slotKey = `${todayDate}_${slot}`;
      if (currentHourMin === slot && this.lastPostedSlot !== slotKey) {
        this.lastPostedSlot = slotKey;
        this.logEvent('TRIGGER', `Đến khung giờ vàng ${slot}! Đang tự động kích hoạt đăng video...`);
        try {
          await this.postNextVideoNow();
        } catch (e) {
          console.error('[Autopilot] Lỗi slot đăng:', e.message);
        }
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      queueCount: this.getQueue().length,
      queue: this.getQueue().slice(0, 5),
      recentLogs: this.getLogs().slice(0, 15)
    };
  }
}

const autopilot = new AutopilotScheduler();
module.exports = autopilot;
