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
app.use('/storage/video-gen', express.static(path.join(__dirname, 'storage', 'video-gen')));
app.use('/output', express.static(path.join(__dirname, 'my-video-engine', 'output')));
app.use('/media', express.static(path.join(__dirname, 'my-video-engine', 'public', 'media')));

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

const { execFileSync, spawn } = require('child_process');
const videoGenStore = require('./services/videoGenerator/store');
const { getDimensions, MARKET_PRESETS, getMarketPreset } = require('./services/videoGenerator/stylePresets');
const { connectToGeminiPage } = require('./services/videoGenerator/geminiChat');
const {
  DEFAULT_MUSE_URL,
  connectToMusePage,
  planScenesWithMuse,
  generateSceneMediaWithMuse,
  generateFullVideoWithMuse,
} = require('./services/videoGenerator/museChat');
const { planScenes, planScenesWithAgentGW, generateMarketScript } = require('./services/videoGenerator/director');
const { checkKeyUsage, getAgentGwConfig, AGENTGW_MODELS } = require('./services/videoGenerator/agentgwClient');
const { generateSceneMedia } = require('./services/videoGenerator/mediaGen');
const { generateSceneAudio } = require('./services/videoGenerator/ttsGenerator');
const { renderProject } = require('./services/videoGenerator/render');

const MEDIA_DIR = path.join(__dirname, 'my-video-engine', 'public', 'media');
const AUDIO_DIR = path.join(__dirname, 'my-video-engine', 'public', 'audio');

// Only one Playwright-driven generation job may run at a time — there is one
// shared Chrome tab talking to Gemini Ultra (see plan Global Constraints).
let generationBusy = false;
function withGenerationLock(handler) {
  return async (req, res) => {
    if (generationBusy) {
      return res.status(409).json({ error: 'Đang có 1 job tạo video khác chạy, vui lòng đợi.' });
    }
    generationBusy = true;
    try {
      await handler(req, res);
    } finally {
      generationBusy = false;
    }
  };
}

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

// 22a. Kiểm tra trạng thái kết nối AgentGW API + danh sách thị trường US/JP/VI
app.get('/api/agentgw/status', async (req, res) => {
  try {
    const cfg = getAgentGwConfig();
    const usage = await checkKeyUsage();
    res.json({
      success: true,
      hasKey: Boolean(cfg.apiKey),
      baseUrl: cfg.baseUrl,
      defaultModel: cfg.model,
      usage,
      models: AGENTGW_MODELS,
      markets: MARKET_PRESETS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 22b. Dùng AgentGW viết mới hoặc bản địa hoá kịch bản sang thị trường Mỹ (US) / Nhật Bản (JP) / Việt Nam (VI)
app.post('/api/agentgw/script', async (req, res) => {
  try {
    const { topic, kind = 'story', market = 'US', model } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập chủ đề hoặc kịch bản gốc cần bản địa hoá' });
    }
    const result = await generateMarketScript(topic.trim(), kind, market, { model });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Lỗi tạo kịch bản qua AgentGW:', err);
    res.status(500).json({ error: err.message });
  }
});

// 22c. Kiểm tra trạng thái kết nối Chrome CDP 9222 cho Muse.ai
app.get('/api/muse/status', async (req, res) => {
  try {
    const http = require('http');
    const cdpAlive = await new Promise((resolve) => {
      const request = http.get('http://127.0.0.1:9222/json/version', (resp) => {
        resolve(resp.statusCode === 200);
      });
      request.on('error', () => resolve(false));
      request.setTimeout(1500, () => {
        request.destroy();
        resolve(false);
      });
    });
    res.json({
      success: true,
      cdpAlive,
      defaultMuseUrl: DEFAULT_MUSE_URL,
    });
  } catch (err) {
    res.json({ success: true, cdpAlive: false, defaultMuseUrl: DEFAULT_MUSE_URL });
  }
});

// 22d. Mở trình duyệt Google Chrome với --remote-debugging-port=9222 trỏ tới Muse.ai
app.post('/api/muse/open-browser', async (req, res) => {
  try {
    const { museUrl = DEFAULT_MUSE_URL } = req.body || {};
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (!fs.existsSync(chromePath)) {
      return res.status(404).json({
        error: 'Không tìm thấy Google Chrome tại /Applications/Google Chrome.app',
      });
    }
    const profileDir = path.join(__dirname, 'storage', 'chrome-muse-profile');
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const child = spawn(
      chromePath,
      [
        '--remote-debugging-port=9222',
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        museUrl,
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    res.json({
      success: true,
      message: `Đã mở Google Chrome (CDP Port 9222) tới ${museUrl}!`,
      profileDir,
      museUrl,
    });
  } catch (err) {
    console.error('Lỗi mở Chrome Muse:', err);
    res.status(500).json({ error: err.message });
  }
});

// 22e. Tạo kịch bản + Video AI trọn gói trực tiếp từ Muse.ai (1-Click Full Video)
app.post('/api/video-gen/muse-full', withGenerationLock(async (req, res) => {
  let projectId = null;
  try {
    const {
      topic,
      rawScript,
      kind = 'story',
      aspectRatio = '16:9',
      market = 'US',
      title,
      lessonText,
      youtubeMeta,
      museUrl = DEFAULT_MUSE_URL,
      useAgentGwForMeta = true,
      model,
    } = req.body || {};

    const inputContent = (rawScript && rawScript.trim()) || (topic && topic.trim());
    if (!inputContent) {
      return res.status(400).json({
        error: 'Vui lòng nhập Chủ đề (Topic) hoặc Kịch bản để Muse.ai tạo video',
      });
    }

    try {
      getDimensions(aspectRatio);
    } catch (dimErr) {
      return res.status(400).json({ error: dimErr.message });
    }

    // Nếu người dùng mới chỉ nhập chủ đề ngắn và có AgentGW, tự động sinh thêm metadata chuẩn SEO US/JP + kịch bản hoàn chỉnh
    let finalTitle = title || '';
    let finalScript = rawScript && rawScript.trim() ? rawScript.trim() : inputContent;
    let finalLesson = lessonText || '';
    let finalYoutubeMeta = youtubeMeta || null;

    const cfg = getAgentGwConfig();
    if (useAgentGwForMeta && cfg.apiKey && (!rawScript || !rawScript.trim() || !finalTitle)) {
      try {
        const enriched = await generateMarketScript(inputContent, kind, market, { model });
        if (!finalTitle && enriched.title) finalTitle = enriched.title;
        if ((!rawScript || !rawScript.trim()) && enriched.rawScript) finalScript = enriched.rawScript;
        if (!finalLesson && enriched.lessonText) finalLesson = enriched.lessonText;
        if (!finalYoutubeMeta) {
          finalYoutubeMeta = {
            description: enriched.youtubeDescription || '',
            tags: enriched.youtubeTags || [],
          };
        }
      } catch (metaErr) {
        console.warn('[Muse Full] Bỏ qua bước làm giàu SEO qua AgentGW:', metaErr.message);
      }
    }

    const project = videoGenStore.createProject({
      kind,
      aspectRatio,
      rawScript: finalScript,
      lessonText: finalLesson,
      market,
      title: finalTitle || `Muse AI Video (${market})`,
      youtubeMeta: finalYoutubeMeta,
    });
    projectId = project.id;

    videoGenStore.updateProject(project.id, {
      status: 'generating_media',
      scenes: [
        {
          id: 1,
          text: finalScript,
          videoPrompt: `Full AI Video on Muse.ai (${market}, ${aspectRatio}): ${finalTitle || inputContent}`,
          mediaStatus: 'pending',
          mediaFile: null,
        },
      ],
    });

    const projectDir = videoGenStore.getProjectDir(project.id);
    const outputPath = path.join(projectDir, 'output.mp4');

    const { page } = await connectToMusePage({ museUrl });
    await generateFullVideoWithMuse(
      page,
      {
        topic: finalTitle || inputContent,
        rawScript: finalScript,
        kind,
        market,
        aspectRatio,
      },
      outputPath
    );

    const updated = videoGenStore.updateProject(project.id, {
      status: 'done',
      outputPath,
      scenes: [
        {
          id: 1,
          text: finalScript,
          videoPrompt: `Generated directly via Muse.ai (${market}, ${aspectRatio})`,
          mediaStatus: 'video',
          mediaFile: outputPath,
        },
      ],
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi tạo video trọn gói với Muse.ai:', err);
    if (projectId) {
      videoGenStore.updateProject(projectId, { status: 'failed' });
    }
    res.status(500).json({ error: err.message });
  }
}));

// 23. Tạo project mới + chia scene (hỗ trợ Muse.ai, AgentGW API cho US/JP/VI, hoặc Gemini Ultra Playwright)
app.post('/api/video-gen/plan', withGenerationLock(async (req, res) => {
  try {
    const {
      kind = 'story',
      aspectRatio = '16:9',
      rawScript,
      lessonText,
      title,
      market = 'US',
      voice,
      voiceRate,
      engine = 'agentgw',
      model,
      youtubeMeta,
      museUrl = DEFAULT_MUSE_URL,
    } = req.body;
    if (!rawScript || !rawScript.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập kịch bản' });
    }
    try {
      getDimensions(aspectRatio); // throws early with a clear message if aspectRatio is invalid
    } catch (dimErr) {
      return res.status(400).json({ error: dimErr.message });
    }

    const project = videoGenStore.createProject({
      kind,
      aspectRatio,
      rawScript,
      lessonText: lessonText || '',
      market,
      voice,
      voiceRate,
      title: title || '',
      youtubeMeta,
    });

    let scenes;
    let extraUpdates = {};
    const cfg = getAgentGwConfig();
    if (engine === 'muse') {
      const { page } = await connectToMusePage({ museUrl });
      const planRes = await planScenesWithMuse(page, rawScript, kind, market);
      scenes = Array.isArray(planRes) ? planRes : planRes.scenes;
      if (!title && planRes.title) extraUpdates.title = planRes.title;
      if (!lessonText && planRes.lessonText) extraUpdates.lessonText = planRes.lessonText;
      if (!youtubeMeta && planRes.youtubeMeta) extraUpdates.youtubeMeta = planRes.youtubeMeta;
    } else if (engine !== 'playwright' && cfg.apiKey) {
      const planRes = await planScenesWithAgentGW(rawScript, kind, market, { model });
      scenes = Array.isArray(planRes) ? planRes : planRes.scenes;
      if (!title && planRes.title) extraUpdates.title = planRes.title;
      if (!lessonText && planRes.lessonText) extraUpdates.lessonText = planRes.lessonText;
      if (!youtubeMeta && planRes.youtubeMeta) extraUpdates.youtubeMeta = planRes.youtubeMeta;
    } else {
      const { page } = await connectToGeminiPage();
      scenes = await planScenes(page, rawScript, kind, market);
    }

    const updated = videoGenStore.updateProject(project.id, {
      ...extraUpdates,
      status: 'planned',
      scenes,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi lập kế hoạch scene:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 24. Sinh media + audio cho toàn bộ scene rồi render (hỗ trợ Muse.ai, Direct TTS+Render hoặc Gemini Ultra Veo)
app.post('/api/video-gen/:id/generate', withGenerationLock(async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaMode = 'direct', voice, voiceRate, museUrl = DEFAULT_MUSE_URL } = req.body || {};
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });

    if (voice || voiceRate) {
      project.meta = {
        ...project.meta,
        ...(voice ? { voice } : {}),
        ...(voiceRate ? { voiceRate } : {}),
      };
      videoGenStore.updateProject(id, { meta: project.meta });
    }

    if (mediaMode === 'muse' || mediaMode === 'playwright') {
      videoGenStore.updateProject(id, { status: 'generating_media' });
      const { page } =
        mediaMode === 'muse'
          ? await connectToMusePage({ museUrl })
          : await connectToGeminiPage();

      for (const scene of project.scenes) {
        if (scene.mediaStatus === 'video') continue; // already generated (retry-safe)
        try {
          const result =
            mediaMode === 'muse'
              ? await generateSceneMediaWithMuse(page, scene, MEDIA_DIR)
              : await generateSceneMedia(page, scene, MEDIA_DIR);
          scene.mediaStatus = result.mediaStatus;
          scene.mediaFile = result.mediaFile;
          scene.error = null;
        } catch (sceneErr) {
          scene.mediaStatus = 'pending';
          scene.error = sceneErr.message;
        }
        videoGenStore.updateProject(id, { scenes: project.scenes });
      }

      const anyFailed = project.scenes.some((s) => s.mediaStatus !== 'video');
      if (anyFailed) {
        const updated = videoGenStore.updateProject(id, { status: 'media_failed' });
        return res.json({ success: true, data: updated });
      }
    }

    videoGenStore.updateProject(id, { status: 'generating_audio' });
    const marketPreset = getMarketPreset(project.market || project.meta?.market || 'US');
    const selectedVoice = project.meta?.voice || marketPreset.defaultVoice;
    const selectedRate = project.meta?.voiceRate || marketPreset.voiceRate;

    for (let i = 0; i < project.scenes.length; i++) {
      const audioResult = await generateSceneAudio(
        project.scenes[i],
        selectedVoice,
        selectedRate,
        AUDIO_DIR
      );
      project.scenes[i] = audioResult;
      videoGenStore.updateProject(id, { scenes: project.scenes });
    }

    videoGenStore.updateProject(id, { status: 'rendering' });
    const outputPath = renderProject(videoGenStore.getProject(id));

    const updated = videoGenStore.updateProject(id, { status: 'done', outputPath });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi generate video:', err);
    videoGenStore.updateProject(req.params.id, { status: 'failed' });
    res.status(500).json({ error: err.message });
  }
}));

// 25. Sinh lại media cho 1 scene bị lỗi (hỗ trợ cả Muse.ai và Gemini Ultra)
app.post('/api/video-gen/:id/retry-scene/:sceneId', withGenerationLock(async (req, res) => {
  try {
    const { id, sceneId } = req.params;
    const { mediaMode = 'muse', museUrl = DEFAULT_MUSE_URL } = req.body || {};
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
    const scene = project.scenes.find((s) => String(s.id) === sceneId);
    if (!scene) return res.status(404).json({ error: 'Không tìm thấy scene' });

    const { page } =
      mediaMode === 'muse'
        ? await connectToMusePage({ museUrl })
        : await connectToGeminiPage();
    const result =
      mediaMode === 'muse'
        ? await generateSceneMediaWithMuse(page, scene, MEDIA_DIR)
        : await generateSceneMedia(page, scene, MEDIA_DIR);
    scene.mediaStatus = result.mediaStatus;
    scene.mediaFile = result.mediaFile;
    scene.error = null;

    const updated = videoGenStore.updateProject(id, { scenes: project.scenes });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi retry scene:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 26. Lấy trạng thái 1 project
app.get('/api/video-gen/:id', (req, res) => {
  const project = videoGenStore.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
  res.json({ success: true, data: project });
});

// 27. Danh sách project đã tạo
app.get('/api/video-gen', (req, res) => {
  res.json({ success: true, data: videoGenStore.listProjects() });
});

// 28. Đăng video đã render lên TikTok
app.post('/api/video-gen/:id/publish/tiktok', async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
    if (!project.outputPath || !fs.existsSync(project.outputPath)) {
      return res.status(400).json({ error: 'Video chưa render xong' });
    }

    const finalCaption = caption && caption.trim() ? caption.trim() : (project.title || project.kind);
    const uploadResult = await TikTokUploader.uploadVideo(project.outputPath, finalCaption);

    const updated = videoGenStore.updateProject(id, {
      publishing: {
        ...(project.publishing || {}),
        tiktok: { posted: true, postedAt: new Date().toISOString(), url: uploadResult.url || null },
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Lỗi đăng TikTok:', err);
    res.status(500).json({ error: err.message });
  }
});

// 29. Đăng video đã render lên YouTube (hỗ trợ kênh US en-US / JP ja-JP / VI vi-VN)
app.post('/api/video-gen/:id/publish/youtube', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, market } = req.body || {};
    const project = videoGenStore.getProject(id);
    if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
    if (!project.outputPath || !fs.existsSync(project.outputPath)) {
      return res.status(400).json({ error: 'Video chưa render xong' });
    }

    const targetMarket = (market || project.market || 'US').toUpperCase();
    const finalTitle = (title && title.trim()) || project.title || `AI Video (${targetMarket})`;
    const finalDesc =
      (description && description.trim()) ||
      project.youtubeMeta?.description ||
      project.lessonText ||
      '';
    const finalTags = Array.isArray(tags) && tags.length > 0
      ? tags
      : (project.youtubeMeta?.tags || []);

    const engineDir = path.join(__dirname, 'my-video-engine');
    const venvPy = path.join(engineDir, '.venv', 'bin', 'python3');
    const pyBin = fs.existsSync(venvPy) ? venvPy : 'python3';

    const args = [
      'main.py',
      'upload',
      'youtube',
      project.outputPath,
      '--title',
      finalTitle,
      '--description',
      finalDesc,
      '--market',
      targetMarket,
    ];
    if (finalTags.length > 0) {
      args.push('--tags', ...finalTags);
    }

    const stdout = execFileSync(pyBin, args, {
      cwd: engineDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const videoUrl = stdout.trim().split('\n').pop() || null;

    const updated = videoGenStore.updateProject(id, {
      publishing: {
        ...(project.publishing || {}),
        youtube: {
          posted: true,
          market: targetMarket,
          postedAt: new Date().toISOString(),
          url: videoUrl,
        },
      },
    });
    res.json({ success: true, data: updated, url: videoUrl });
  } catch (err) {
    console.error('Lỗi đăng YouTube:', err);
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    res.status(500).json({ error: stderr });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Douyin Reup & Global YouTube AI Video Server đang chạy tại: http://localhost:${PORT}`);
});
