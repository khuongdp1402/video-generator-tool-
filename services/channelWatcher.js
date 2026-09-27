const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const VideoRemaker = require('./remaker');

const TARGETS_FILE = path.join(__dirname, '../storage/targets.json');
const DATA_FILE = path.join(__dirname, '../storage/database.json');
const YTDLP_PATH = fs.existsSync(path.join(__dirname, '../bin/yt-dlp.exe'))
  ? path.join(__dirname, '../bin/yt-dlp.exe')
  : 'C:\\Users\\ShueiHCM\\.gemini\\antigravity-ide\\scratch\\douyin-reup-pipeline\\bin\\yt-dlp.exe';

// Khởi tạo file targets nếu chưa có
function getTargets() {
  if (fs.existsSync(TARGETS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  const defaultTargets = [
    { id: 't1', username: '@mukbang12112', url: 'https://www.tiktok.com/@mukbang12112', name: 'Mukbang Viral Compilation', active: true },
    { id: 't2', username: '@munchies_mukbang', url: 'https://www.tiktok.com/@munchies_mukbang', name: 'Munchies Mukbang ASMR', active: true },
    { id: 't3', username: '@_tiembeain_', url: 'https://www.tiktok.com/@_tiembeain_', name: 'Ăn Cùng Bé Ain (Mukbang VN)', active: true }
  ];
  fs.writeFileSync(TARGETS_FILE, JSON.stringify(defaultTargets, null, 2));
  return defaultTargets;
}

function saveTargets(targets) {
  fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2));
}

function getDatabase() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      return { videos: [] };
    }
  }
  return { videos: [] };
}

function saveDatabase(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/**
 * Quét video mới từ kênh mục tiêu và tự động tải về + remake
 */
async function scanAndProcessChannel(targetUrl, maxVideos = 3) {
  console.log(`[ChannelWatcher] Đang quét kênh: ${targetUrl}...`);
  const rawDir = path.join(__dirname, '../storage/raw');
  const remakeDir = path.join(__dirname, '../storage/remake');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
  if (!fs.existsSync(remakeDir)) fs.mkdirSync(remakeDir, { recursive: true });

  const db = getDatabase();
  const existingIds = new Set(db.videos.map(v => v.id));

  try {
    // Lấy metadata các video gần nhất của kênh
    const cmd = `"${YTDLP_PATH}" "${targetUrl}" --playlist-end ${maxVideos} --dump-json --no-warnings`;
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lines = output.trim().split('\n').filter(Boolean);

    const newVideos = [];
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const vidId = `tiktok-${item.id}`;
        if (existingIds.has(vidId)) {
          console.log(`[ChannelWatcher] Video ${vidId} đã có trong thư viện, bỏ qua.`);
          continue;
        }

        console.log(`[ChannelWatcher] Tìm thấy video mới: ${item.title} (ID: ${item.id})`);
        const rawFileName = `tiktok_${item.id}.mp4`;
        const rawPath = path.join(rawDir, rawFileName);

        // Tải video
        execSync(`"${YTDLP_PATH}" "${item.webpage_url}" -o "${rawPath}" --force-overwrites`, { stdio: 'ignore' });
        console.log(`[ChannelWatcher] Đã tải video về: ${rawPath}`);

        // Tự động Remake lách thuật toán
        const remakeFileName = `remake_tiktok_${item.id}.mp4`;
        const remakePath = path.join(remakeDir, remakeFileName);
        const remakeRes = await VideoRemaker.processVideo(rawPath, remakePath, {
          flipHorizontal: true,
          removeChineseSub: true,
          zoomCrop: true,
          colorGrade: true,
          speedAdjust: 1.02,
          pitchShift: true
        });

        const record = {
          id: vidId,
          title: item.title || 'Mukbang ASMR Food Video',
          author: item.uploader || item.channel || 'TikTok Creator',
          cover: item.thumbnail || '',
          duration: Math.round(item.duration || 30),
          rawFileName,
          rawUrl: `/storage/raw/${rawFileName}`,
          remakeFileName,
          remakeUrl: `/storage/remake/${remakeFileName}`,
          originalMd5: remakeRes.originalMd5,
          remadeMd5: remakeRes.remadeMd5,
          minioStatus: { uploaded: false, key: null, url: null, presignedUrl: null },
          status: 'ready_to_publish',
          postedToTikTok: false,
          postedAt: null,
          createdAt: new Date().toISOString()
        };

        db.videos.unshift(record);
        newVideos.push(record);
        existingIds.add(vidId);
      } catch (err) {
        console.warn('[ChannelWatcher] Lỗi xử lý 1 video:', err.message);
      }
    }

    saveDatabase(db);
    return { success: true, addedCount: newVideos.length, newVideos };
  } catch (err) {
    console.error(`[ChannelWatcher] Lỗi quét kênh ${targetUrl}:`, err.message);
    return { success: false, error: err.message, addedCount: 0 };
  }
}

/**
 * Quét toàn bộ các kênh trong danh sách mục tiêu
 */
async function scanAllTargets() {
  const targets = getTargets().filter(t => t.active);
  console.log(`[ChannelWatcher] Bắt đầu quét ${targets.length} kênh mục tiêu...`);
  const results = [];
  for (const t of targets) {
    const res = await scanAndProcessChannel(t.url, 2);
    results.push({ channel: t.name, ...res });
  }
  return results;
}

module.exports = {
  getTargets,
  saveTargets,
  scanAndProcessChannel,
  scanAllTargets
};
