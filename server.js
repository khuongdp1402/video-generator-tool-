require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const DouyinScraper = require('./services/scraper');
const VideoRemaker = require('./services/remaker');
const MinioService = require('./services/minioClient');
const { PUBLISHER_STRATEGY, TIKTOK_PLAYWRIGHT_SNIPPET, YOUTUBE_API_SNIPPET } = require('./services/publisherPlan');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cho phép stream video MP4 hỗ trợ Range headers
app.use('/storage/raw', express.static(path.join(__dirname, 'storage', 'raw')));
app.use('/storage/remake', express.static(path.join(__dirname, 'storage', 'remake')));

// storage/ is gitignored (per-machine runtime state, see Task 1 of the
// unified-portal plan), so on a fresh clone it doesn't exist at all yet.
// Create the subdirectories the download/remake routes write into up front,
// so those routes don't ENOENT on first use.
['raw', 'remake'].forEach((sub) => {
  const dir = path.join(__dirname, 'storage', sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DATA_FILE = path.join(__dirname, 'storage', 'database.json');

function getDb() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      return { videos: [] };
    }
  }
  return { videos: [] };
}

function saveDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const minioService = new MinioService();

// 1. Phân giải link Douyin (Xem trước thông tin)
app.post('/api/scrape-info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Vui lòng cung cấp link video Douyin' });
    }
    const info = await DouyinScraper.getVideoInfo(url);
    res.json({ success: true, data: info });
  } catch (err) {
    console.error('Lỗi scrape-info:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Tải video Douyin về local
app.post('/api/download', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Vui lòng cung cấp link video Douyin' });
    }

    const info = await DouyinScraper.getVideoInfo(url);
    const videoId = info.id || Date.now().toString();
    const fileName = `douyin_${videoId}_${Date.now()}.mp4`;
    const destPath = path.join(__dirname, 'storage', 'raw', fileName);

    console.log(`[Server] Đang tải video ${videoId} về: ${destPath}`);
    await DouyinScraper.downloadVideo(info.videoUrl, destPath);

    const record = {
      id: videoId,
      title: info.title,
      author: info.author,
      cover: info.cover,
      duration: info.duration,
      rawFileName: fileName,
      rawUrl: `/storage/raw/${fileName}`,
      remakeFileName: null,
      remakeUrl: null,
      originalMd5: VideoRemaker.getFileMD5(destPath),
      remadeMd5: null,
      minioStatus: { uploaded: false, key: null, url: null, presignedUrl: null },
      status: 'downloaded',
      createdAt: new Date().toISOString()
    };

    const db = getDb();
    db.videos = db.videos.filter(v => v.id !== videoId);
    db.videos.unshift(record);
    saveDb(db);

    res.json({ success: true, data: record });
  } catch (err) {
    console.error('Lỗi download video:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Remake video bằng FFmpeg
app.post('/api/remake/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const options = req.body.options || {};
    const db = getDb();
    const item = db.videos.find(v => v.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy video trong hệ thống' });
    }

    const inputPath = path.join(__dirname, 'storage', 'raw', item.rawFileName);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'File video gốc không tồn tại trên ổ cứng' });
    }

    const remakeFileName = `remake_${item.rawFileName}`;
    const outputPath = path.join(__dirname, 'storage', 'remake', remakeFileName);

    console.log(`[Server] Bắt đầu remake video ID ${id}...`);
    const result = await VideoRemaker.processVideo(inputPath, outputPath, options);

    item.remakeFileName = remakeFileName;
    item.remakeUrl = `/storage/remake/${remakeFileName}`;
    item.remadeMd5 = result.remadeMd5;
    item.status = 'remade';
    saveDb(db);

    res.json({
      success: true,
      message: 'Remake video thành công!',
      data: {
        item,
        stats: result
      }
    });
  } catch (err) {
    console.error('Lỗi remake video:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Kiểm tra và cập nhật cấu hình MinIO
app.post('/api/minio/config', async (req, res) => {
  try {
    const { endpoint, accessKeyId, secretAccessKey, bucket } = req.body;
    minioService.updateConfig({ endpoint, accessKeyId, secretAccessKey, bucket });
    const testResult = await minioService.testConnection();
    res.json(testResult);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Upload video lên MinIO
app.post('/api/minio/upload/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { useRemake = true } = req.body;
    const db = getDb();
    const item = db.videos.find(v => v.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy video' });
    }

    const fileName = (useRemake && item.remakeFileName) ? item.remakeFileName : item.rawFileName;
    const folder = (useRemake && item.remakeFileName) ? 'remake' : 'raw';
    const filePath = path.join(__dirname, 'storage', folder, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File không tồn tại trên hệ thống' });
    }

    const s3Key = `douyin/${folder}/${fileName}`;
    console.log(`[MinIO] Đang upload file ${filePath} lên key: ${s3Key}`);
    const uploadResult = await minioService.uploadVideo(filePath, s3Key);

    item.minioStatus = {
      uploaded: true,
      bucket: uploadResult.bucket,
      key: uploadResult.key,
      url: uploadResult.url,
      presignedUrl: uploadResult.presignedUrl,
      uploadedAt: new Date().toISOString()
    };
    saveDb(db);

    res.json({ success: true, message: 'Upload MinIO thành công!', data: item.minioStatus });
  } catch (err) {
    console.error('Lỗi upload MinIO:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Lấy danh sách video
app.get('/api/videos', (req, res) => {
  const db = getDb();
  res.json({ success: true, videos: db.videos });
});

// 7. Xóa video
app.delete('/api/videos/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const index = db.videos.findIndex(v => v.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy video' });
  }

  const item = db.videos[index];
  if (item.rawFileName) {
    const rawPath = path.join(__dirname, 'storage', 'raw', item.rawFileName);
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
  }
  if (item.remakeFileName) {
    const remakePath = path.join(__dirname, 'storage', 'remake', item.remakeFileName);
    if (fs.existsSync(remakePath)) fs.unlinkSync(remakePath);
  }

  db.videos.splice(index, 1);
  saveDb(db);
  res.json({ success: true, message: 'Đã xóa video thành công' });
});

// 8. Lấy kế hoạch đăng bài và code snippets
app.get('/api/publisher/plan', (req, res) => {
  res.json({
    strategy: PUBLISHER_STRATEGY,
    tiktokSnippet: TIKTOK_PLAYWRIGHT_SNIPPET,
    youtubeSnippet: YOUTUBE_API_SNIPPET
  });
});

const TikTokUploader = require('./services/tiktokUploader');

// 9. Mở cửa sổ đăng nhập TikTok
app.post('/api/tiktok/login-window', async (req, res) => {
  try {
    const result = await TikTokUploader.openLoginWindow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Kiểm tra trạng thái đăng nhập TikTok
app.get('/api/tiktok/status', async (req, res) => {
  try {
    const result = await TikTokUploader.checkLoginStatus();
    res.json(result);
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

// 10b. Đóng cửa sổ đăng nhập và giải phóng profile lock
app.post('/api/tiktok/close-login', async (req, res) => {
  try {
    const result = await TikTokUploader.closeBrowserContext();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10c. Lưu cookie TikTok từ chuỗi dán trực tiếp
app.post('/api/tiktok/save-cookie', (req, res) => {
  try {
    const { cookie } = req.body;
    const result = TikTokUploader.saveSessionCookie(cookie);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Tự động upload video lên TikTok
app.post('/api/tiktok/upload/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;
    const db = getDb();
    const item = db.videos.find(v => v.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy video' });
    }

    const fileName = item.remakeFileName || item.rawFileName;
    const folder = item.remakeFileName ? 'remake' : 'raw';
    const filePath = path.join(__dirname, 'storage', folder, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File video không tồn tại trên ổ cứng' });
    }

    const defaultCaption = `${item.title.slice(0, 70)} #mukbang #asmr #doanvat #fyp #xuhuong`;
    const finalCaption = caption && caption.trim() ? caption.trim() : defaultCaption;

    const uploadResult = await TikTokUploader.uploadVideo(filePath, finalCaption);
    res.json(uploadResult);
  } catch (err) {
    console.error('Lỗi upload TikTok:', err);
    res.status(500).json({ error: err.message });
  }
});

const autopilot = require('./services/autopilotScheduler');
const { getTargets, saveTargets, scanAllTargets } = require('./services/channelWatcher');

// 12. Trạng thái Autopilot
app.get('/api/autopilot/status', (req, res) => {
  res.json(autopilot.getStatus());
});

// 13. Bật/Tắt Autopilot
app.post('/api/autopilot/toggle', (req, res) => {
  const { enabled } = req.body;
  if (enabled) {
    autopilot.start();
  } else {
    autopilot.stop();
  }
  res.json({ success: true, isRunning: autopilot.isRunning });
});

// 14. Kích hoạt quét toàn bộ kênh mục tiêu ngay lập tức
app.post('/api/autopilot/scan-channels', async (req, res) => {
  try {
    autopilot.logEvent('MANUAL_SCAN', 'Người dùng yêu cầu quét các kênh mục tiêu...');
    // Chạy bất đồng bộ
    scanAllTargets().then(results => {
      autopilot.logEvent('MANUAL_SCAN', 'Đã quét xong các kênh mục tiêu!');
    }).catch(e => {
      autopilot.logEvent('ERROR', `Lỗi quét kênh: ${e.message}`);
    });
    res.json({ success: true, message: 'Đã bắt đầu tiến trình quét kênh chạy ngầm!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Đăng ngay 1 video tiếp theo trong hàng đợi
app.post('/api/autopilot/post-now', async (req, res) => {
  try {
    const result = await autopilot.postNextVideoNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Lấy và cập nhật danh sách kênh mục tiêu
app.get('/api/targets', (req, res) => {
  res.json({ success: true, targets: getTargets() });
});

app.post('/api/targets', (req, res) => {
  const { targets } = req.body;
  if (Array.isArray(targets)) {
    saveTargets(targets);
    res.json({ success: true, targets });
  } else {
    res.status(400).json({ error: 'Dữ liệu kênh không hợp lệ' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Douyin Reup Pipeline Server đang chạy tại: http://localhost:${PORT}`);
});
