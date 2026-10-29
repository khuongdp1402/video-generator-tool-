require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const DouyinScraper = require('./services/scraper');
const VideoRemaker = require('./services/remaker');
const MinioService = require('./services/minioClient');
const { PUBLISHER_STRATEGY, TIKTOK_PLAYWRIGHT_SNIPPET, YOUTUBE_API_SNIPPET } = require('./services/publisherPlan');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Cho phép stream video MP4 và ảnh tham chiếu
app.use('/storage/raw', express.static(path.join(__dirname, 'storage', 'raw')));
app.use('/storage/remake', express.static(path.join(__dirname, 'storage', 'remake')));
app.use('/storage/video-gen', express.static(path.join(__dirname, 'storage', 'video-gen')));
app.use('/storage/uploads', express.static(path.join(__dirname, 'storage', 'uploads')));
app.use('/storage/continuity', express.static(path.join(__dirname, 'storage', 'continuity')));
app.use('/output', express.static(path.join(__dirname, 'my-video-engine', 'output')));
app.use('/media', express.static(path.join(__dirname, 'my-video-engine', 'public', 'media')));
app.use('/audio', express.static(path.join(__dirname, 'my-video-engine', 'public', 'audio')));

['raw', 'remake', 'video-gen', 'uploads', 'continuity', 'profiles'].forEach((sub) => {
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

const videoGenStore = require('./services/videoGenerator/store');
const {
  getDimensions,
  listStylePresets,
  getStylePreset,
  MARKET_PRESETS,
  getMarketPreset,
} = require('./services/videoGenerator/stylePresets');
const { connectToGeminiPage, sendPromptAndWaitForStableReply } = require('./services/videoGenerator/geminiChat');
const {
  DEFAULT_MUSE_URL,
  connectToMusePage,
  planScenesWithMuse,
  generateSceneMediaWithMuse,
  generateFullVideoWithMuse,
} = require('./services/videoGenerator/museChat');
const {
  planScenes,
  planScenesWithAgentGW,
  generateMarketScript,
  normalizeScenes,
} = require('./services/videoGenerator/director');
const { checkKeyUsage, getAgentGwConfig, AGENTGW_MODELS } = require('./services/videoGenerator/agentgwClient');
const { generateSceneMedia } = require('./services/videoGenerator/mediaGen');
const { generateSceneAudio } = require('./services/videoGenerator/ttsGenerator');
const { renderProject } = require('./services/videoGenerator/render');
const { extractContinuityFrame } = require('./services/videoGenerator/continuity');
const filmStore = require('./services/videoGenerator/filmProjects');
const promptWriterStore = require('./services/videoGenerator/promptWriter');
const { getTopicCatalog, generateScriptByTopic } = require('./services/videoGenerator/topicScriptSuggester');
const accountManager = require('./services/accountManager');

const MEDIA_DIR = path.join(__dirname, 'my-video-engine', 'public', 'media');
const AUDIO_DIR = path.join(__dirname, 'my-video-engine', 'public', 'audio');
const UPLOADS_DIR = path.join(__dirname, 'storage', 'uploads');

let generationBusy = false;
let queueRunnerActive = false;

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

// ============================================================================
// PHÂN HỆ DOUYIN REUP & AUTOPILOT (GIỮ NGUYÊN 100% TƯƠNG THÍCH)
// ============================================================================

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
      createdAt: new Date().toISOString(),
    };

    const db = getDb();
    db.videos = db.videos.filter((v) => v.id !== videoId);
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
    const item = db.videos.find((v) => v.id === id);
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
        stats: result,
      },
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
    const item = db.videos.find((v) => v.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy video' });
    }

    const fileName = useRemake && item.remakeFileName ? item.remakeFileName : item.rawFileName;
    const folder = useRemake && item.remakeFileName ? 'remake' : 'raw';
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
      uploadedAt: new Date().toISOString(),
    };
    saveDb(db);

    res.json({ success: true, message: 'Upload MinIO thành công!', data: item.minioStatus });
  } catch (err) {
    console.error('Lỗi upload MinIO:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Lấy danh sách video Douyin
app.get('/api/videos', (req, res) => {
  const db = getDb();
  res.json({ success: true, videos: db.videos });
});

// 7. Xóa video Douyin
app.delete('/api/videos/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const index = db.videos.findIndex((v) => v.id === id);
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
    youtubeSnippet: YOUTUBE_API_SNIPPET,
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
    const item = db.videos.find((v) => v.id === id);
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
    scanAllTargets()
      .then(() => {
        autopilot.logEvent('MANUAL_SCAN', 'Đã quét xong các kênh mục tiêu!');
      })
      .catch((e) => {
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
app.get('/api/video-gen/topic-suggestions', (req, res) => {
  try {
    const kind = req.query.kind || 'psych_split';
    const data = getTopicCatalog(kind);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/video-gen/generate-topic-script', async (req, res) => {
  try {
    const { kind = 'psych_split', topicId = '', customTopic = '', variantIndex = null } = req.body || {};
    const generated = generateScriptByTopic({ kind, topicId, customTopic, variantIndex });
    res.json({ success: true, data: generated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// 22d. Khởi chạy / kết nối Google Chrome chạy ngầm (--headless=new) cho cả Muse.ai (9222 - camhien2000qt@gmail.com) và Gemini Ultra (9223 - dophukhuong1234@gmail.com)
app.post('/api/muse/open-browser', async (req, res) => {
  try {
    const { museUrl = DEFAULT_MUSE_URL, visible = false } = req.body || {};
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (!fs.existsSync(chromePath)) {
      return res.status(404).json({
        error: 'Không tìm thấy Google Chrome tại /Applications/Google Chrome.app',
      });
    }
    const museProfileDir = path.join(__dirname, 'storage', 'chrome-muse-profile');
    const geminiProfileDir = path.join(__dirname, 'storage', 'chrome-gemini-profile');
    if (!fs.existsSync(museProfileDir)) fs.mkdirSync(museProfileDir, { recursive: true });
    if (!fs.existsSync(geminiProfileDir)) fs.mkdirSync(geminiProfileDir, { recursive: true });

    const museArgs = [
      '--remote-debugging-port=9222',
      `--user-data-dir=${museProfileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--window-size=1440,900',
    ];
    const geminiArgs = [
      '--remote-debugging-port=9223',
      `--user-data-dir=${geminiProfileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--window-size=1440,900',
    ];
    if (!visible) {
      museArgs.unshift('--headless=new');
      geminiArgs.unshift('--headless=new');
    }
    museArgs.push(museUrl);
    geminiArgs.push('https://gemini.google.com/app');

    const childMuse = spawn('open', ['-n', '-a', 'Google Chrome', '--args', ...museArgs], {
      detached: true,
      stdio: 'ignore',
    });
    childMuse.unref();

    const childGemini = spawn('open', ['-n', '-a', 'Google Chrome', '--args', ...geminiArgs], {
      detached: true,
      stdio: 'ignore',
    });
    childGemini.unref();

    res.json({
      success: true,
      message: visible
        ? `Đã mở Chrome cho Muse.ai (#1 · camhien2000qt@gmail.com · 9222) và Gemini Ultra (#2 · dophukhuong1234@gmail.com · 9223)!`
        : `Đã kích hoạt ngầm (Headless 100%) Muse.ai (#1 · camhien2000qt@gmail.com · 9222) & Gemini Ultra (#2 · dophukhuong1234@gmail.com · 9223)!`,
      profileDir: museProfileDir,
      geminiProfileDir,
      museUrl,
      headless: !visible,
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
      aspectRatio = '9:16',
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

    const projectOutputDir = path.join(__dirname, 'storage', 'video-gen', project.id);
    fs.mkdirSync(projectOutputDir, { recursive: true });
    const outputPath = path.join(projectOutputDir, 'output.mp4');

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

// ============================================================================
// PHÂN HỆ MỚI 1: UPLOAD ẢNH THAM CHIẾU (TỐI ĐA 8 ẢNH / TASK)
// ============================================================================

app.post('/api/uploads/base64', (req, res) => {
  try {
    const { files = [] } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Không có file nào được gửi lên' });
    }
    const savedRefs = [];
    for (const f of files.slice(0, 30)) {
      const ext = path.extname(f.name || '.png').toLowerCase() || '.png';
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
      const fileName = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${safeExt}`;
      const destPath = path.join(UPLOADS_DIR, fileName);
      const base64Data = String(f.data || '').replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
      savedRefs.push({
        name: f.name || fileName,
        ref: destPath,
        url: `/storage/uploads/${fileName}`,
      });
    }
    res.json({ success: true, files: savedRefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PHÂN HỆ MỚI 2: DỰ ÁN PHIM (FILM WORKSPACE) & NỐI CẢNH CONTINUITY
// ============================================================================

app.get('/api/film-projects', (req, res) => {
  res.json({
    success: true,
    projects: filmStore.listFilmProjects(),
    assets: filmStore.listProjectAssets(),
    sceneRules: filmStore.listProjectSceneRules(),
  });
});

app.post('/api/film-projects', (req, res) => {
  try {
    const project = filmStore.createFilmProject(req.body);
    res.json({ success: true, project });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/film-projects/:id', (req, res) => {
  try {
    const project = filmStore.updateFilmProject(req.params.id, req.body);
    res.json({ success: true, project });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/film-projects/:id', (req, res) => {
  try {
    const result = filmStore.deleteFilmProject(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/film-projects/:id/scene-rules', (req, res) => {
  try {
    const rule = filmStore.addSceneRule(req.params.id, req.body);
    res.json({ success: true, rule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/film-scene-rules/:ruleId', (req, res) => {
  try {
    const result = filmStore.deleteSceneRule(req.params.ruleId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/film-projects/:id/assets/bulk', (req, res) => {
  try {
    const assets = filmStore.addAssetsBulk(req.params.id, req.body.assets || []);
    res.json({ success: true, assets });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/film-projects/:id/characters', (req, res) => {
  try {
    const assets = filmStore.updateCharacterAssets(req.params.id, req.body);
    res.json({ success: true, assets });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/film-assets/:assetId', (req, res) => {
  try {
    const result = filmStore.deleteAsset(req.params.assetId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// PHÂN HỆ MỚI 3: TRỢ LÝ VIẾT PROMPT AI (ĐƠN LẺ & HÀNG LOẠT)
// ============================================================================

async function tryGeminiWebChatRunner(promptText) {
  try {
    const { page } = await connectToGeminiPage();
    return await sendPromptAndWaitForStableReply(page, promptText);
  } catch (e) {
    return null;
  }
}

app.get('/api/prompt-writer', (req, res) => {
  res.json({ success: true, ...promptWriterStore.getState() });
});

app.post('/api/prompt-writer/fetch-models', (req, res) => {
  const { provider = 'gemini_web', api_key = '' } = req.body;
  const models = promptWriterStore.getModelsForProvider(provider);
  res.json({
    success: true,
    verified: provider === 'gemini_web' || Boolean(api_key && api_key.trim()),
    models,
  });
});

app.post('/api/prompt-writer/profiles', (req, res) => {
  try {
    const profile = promptWriterStore.upsertProfile(req.body);
    res.json({ success: true, profile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/prompt-writer/profiles/:id', (req, res) => {
  try {
    const profile = promptWriterStore.upsertProfile({ ...req.body, id: req.params.id });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/prompt-writer/profiles/:id', (req, res) => {
  try {
    res.json({ success: true, ...promptWriterStore.deleteProfile(req.params.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/prompt-writer/skills', (req, res) => {
  try {
    const skill = promptWriterStore.upsertSkill(req.body);
    res.json({ success: true, skill });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/prompt-writer/skills/:id', (req, res) => {
  try {
    const skill = promptWriterStore.upsertSkill({ ...req.body, id: req.params.id });
    res.json({ success: true, skill });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/prompt-writer/skills/:id', (req, res) => {
  try {
    res.json({ success: true, ...promptWriterStore.deleteSkill(req.params.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/prompt-writer/generate', async (req, res) => {
  try {
    const result = await promptWriterStore.generateSingle(req.body, async (prompt) => {
      const webReply = await tryGeminiWebChatRunner(prompt);
      if (webReply) return webReply;
      // Fallback intelligent script writer when Chrome CDP is not open
      return (
        `Có một kiểu người, dù bạn nói gì đi nữa, phản xạ đầu tiên của họ luôn là tìm góc oái oăm để cãi lại.\n` +
        `Bề ngoài tưởng như họ rất sắc sảo, nhưng thật ra trong tâm lý học, đó là biểu hiện của tính cách phản bác — một cơ chế phòng vệ để che giấu sự bất an bên trong.\n` +
        `Khi ở cạnh kiểu người này quá lâu, bạn dễ tự nghi ngờ chính mình. Hãy nhớ: bạn không cần thắng mọi cuộc tranh cãi để chứng minh mình đúng.`
      );
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prompt-writer/generate-bulk', async (req, res) => {
  try {
    const result = await promptWriterStore.generateBulk(req.body, async (prompt) => {
      const webReply = await tryGeminiWebChatRunner(prompt);
      if (webReply) return webReply;
      return (
        `Kịch bản tâm lý học: "${(req.body.brief || '').slice(0, 80)}".\n` +
        `Cảnh 1: Hai nhân vật đối thoại đời thường, một người nói lời quan tâm nhưng người kia lập tức gạt đi.\n` +
        `Cảnh 2: Khoảnh khắc lặng im tự hỏi bản thân dưới ánh đèn trầm.\n` +
        `Cảnh 3: Trong tâm lý học, hành vi đó bắt nguồn từ nỗi sợ bị tổn thương và nhu cầu kiểm soát cuộc trò chuyện.`
      );
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PHÂN HỆ MỚI 4: QUẢN LÝ POOL ĐA TÀI KHOẢN + PROXY + EXTENSION ĐỒNG BỘ
// ============================================================================

app.get('/api/accounts', (req, res) => {
  res.json({ success: true, accounts: accountManager.listAccounts() });
});

app.post('/api/accounts', (req, res) => {
  try {
    const account = accountManager.addAccount(req.body);
    res.json({ success: true, account, id: account.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/accounts/:id', (req, res) => {
  try {
    const account = accountManager.updateAccount(req.params.id, req.body);
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/toggle', (req, res) => {
  try {
    const account = accountManager.toggleAccount(req.params.id);
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/delete-selected', (req, res) => {
  try {
    const result = accountManager.deleteAccounts(req.body.ids || []);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/assign-proxies', (req, res) => {
  try {
    const result = accountManager.assignProxiesBulk(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/cookies', (req, res) => {
  try {
    const result = accountManager.saveAccountCookies(req.params.id, req.body.header || req.body.cookie);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/check', async (req, res) => {
  try {
    const result = await accountManager.checkAccountHealth(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/login', async (req, res) => {
  try {
    const result = await accountManager.openAccountLoginWindow(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/cancel-login', async (req, res) => {
  try {
    const result = await accountManager.closeAccountLoginWindow(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/accounts/:id/details', (req, res) => {
  try {
    const details = accountManager.getAccountDetails(req.params.id, videoGenStore.listProjects());
    res.json({ success: true, ...details });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/accounts/sync-extension', (req, res) => {
  try {
    const payload = req.body || {};
    if (payload.domain && payload.domain.includes('tiktok.com') && payload.cookies && payload.cookies.sessionid) {
      TikTokUploader.saveSessionCookie(payload.cookies.sessionid);
    }
    const acc = accountManager.addAccount({ name: payload.label || 'Synced Account' });
    const saved = accountManager.saveAccountCookies(acc.id, JSON.stringify(payload), {
      label: payload.label,
      balance: payload.balance,
    });
    res.json({ success: true, account: saved.account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// PHÂN HỆ MỚI 5: AI VIDEO GENERATOR + HÀNG ĐỢI BATCH + RENDER NHANH REMOTION
// ============================================================================

app.get('/api/video-gen/presets', (req, res) => {
  res.json({ success: true, presets: listStylePresets() });
});

/**
 * Helper: Tự động chia kịch bản thành các scene song ngữ Việt - Anh ngay lập tức
 * khi không mở Chrome Gemini Ultra (giúp test & render Remotion tức thì).
 */
function buildInstantLocalScenes(rawScript, kind, layoutMode) {
  const sentences = String(rawScript || '')
    .split(/(?<=[.!?。\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = sentences.length > 0 ? sentences.slice(0, 8) : [rawScript.trim()];
  const preset = getStylePreset(kind);
  const resolvedLayout = layoutMode || preset.defaultLayout || 'fullscreen';

  return normalizeScenes(
    chunks.map((line, idx) => ({
      text: line,
      textEn: '',
      visualMode: kind === 'psych_split' ? (idx < Math.ceil(chunks.length / 2) ? 'pictogram' : 'surreal') : kind === 'pictogram' ? 'pictogram' : 'surreal',
      imagePrompt: `${line} — ${preset.characterStyleBlock}`,
      videoPrompt: `${line} — ${preset.characterStyleBlock}`,
      durationSec: 5,
    })),
    { layoutMode: resolvedLayout }
  );
}

// 22b. Nghe thử giọng đọc AI (TTS Studio Preview)
app.post('/api/video-gen/tts-preview', async (req, res) => {
  try {
    const {
      text = 'Trong cuộc sống, sự điềm tĩnh và gãy gọn chính là vũ khí mạnh nhất của người trưởng thành.',
      voice = 'vi-VN-NamMinhNeural',
      voiceRate = '+20%',
    } = req.body || {};

    const previewId = `preview_${Date.now()}`;
    const result = await generateSceneAudio(
      { id: previewId, type: 'media', text: String(text || '').slice(0, 320) },
      voice,
      voiceRate,
      AUDIO_DIR
    );
    res.json({
      success: true,
      audioUrl: `/${result.audioFile}?t=${Date.now()}`,
      voice,
      voiceRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 23. Tạo project mới + chia scene (Gemini Ultra chat hoặc Instant Local Fallback)
app.post(
  '/api/video-gen/plan',
  withGenerationLock(async (req, res) => {
    try {
      const {
        kind = 'psych_split',
        aspectRatio = '9:16',
        layoutMode = null,
        channelName = 'LÀNH TÂM',
        targetDuration = 30,
        projectId = null,
        sceneNo = null,
        predecessorId = null,
        continuityOffset = 0.3,
        refs = [],
        rawScript,
        lessonText,
        title,
        voice = 'vi-VN-NamMinhNeural',
        voiceRate = '+20%',
        market = 'VI',
        aiEngine = 'muse_first',
        mediaMode = 'muse',
      } = req.body;

      if (!rawScript || !rawScript.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập kịch bản' });
      }
      try {
        getDimensions(aspectRatio);
      } catch (dimErr) {
        return res.status(400).json({ error: dimErr.message });
      }

      const project = videoGenStore.createProject({
        kind,
        market,
        voice,
        voiceRate,
        aiEngine,
        mediaMode,
        aspectRatio,
        layoutMode,
        channelName,
        targetDuration,
        projectId,
        sceneNo,
        predecessorId,
        continuityOffset,
        refs,
        rawScript,
        lessonText: lessonText || '',
        title: title || '',
      });

      const filmCtx = projectId
        ? filmStore.resolveSceneContext(projectId, sceneNo || 1, refs, null)
        : { filmRules: '', sceneRules: [], filmAssets: [], resolvedRefs: refs };

      let scenes = null;
      if (aiEngine !== 'remotion_only') {
        if (aiEngine === 'gemini_first') {
          try {
            const { page } = await connectToGeminiPage(undefined, 2500, true);
            scenes = await planScenes(page, rawScript, kind, {
              layoutMode: project.layoutMode,
              targetDuration: project.targetDuration,
              filmRules: filmCtx.filmRules,
              sceneRules: filmCtx.sceneRules,
              filmAssets: filmCtx.filmAssets,
            });
          } catch (_gemErr) {
            try {
              const { page } = await connectToMusePage({ autoLaunch: true, headless: true });
              const musePlan = await planScenesWithMuse(page, rawScript, kind, market);
              scenes = Array.isArray(musePlan) ? musePlan : musePlan?.scenes;
            } catch (_museErr) {}
          }
        } else {
          // Mặc định: Ưu tiên số 1 là Muse.ai (Headless camhien2000qt@gmail.com) -> Dự phòng số 2 là Gemini Ultra
          try {
            const { page } = await connectToMusePage({ autoLaunch: true, headless: true });
            const musePlan = await planScenesWithMuse(page, rawScript, kind, market);
            scenes = Array.isArray(musePlan) ? musePlan : musePlan?.scenes;
          } catch (musePlanErr) {
            console.warn('[Director] Muse.ai chưa trả về JSON scene, chuyển sang Gemini Ultra (#2):', musePlanErr.message);
            if (aiEngine !== 'muse_only') {
              try {
                const { page } = await connectToGeminiPage(undefined, 2500, true);
                scenes = await planScenes(page, rawScript, kind, {
                  layoutMode: project.layoutMode,
                  targetDuration: project.targetDuration,
                  filmRules: filmCtx.filmRules,
                  sceneRules: filmCtx.sceneRules,
                  filmAssets: filmCtx.filmAssets,
                });
              } catch (cdpErr) {
                console.warn('[Director] Gemini Ultra chưa sẵn sàng, dùng bộ chia scene thông minh cục bộ:', cdpErr.message);
              }
            }
          }
        }
      }
      if (!Array.isArray(scenes) || scenes.length === 0) {
        scenes = buildInstantLocalScenes(rawScript, kind, project.layoutMode);
      }

      const updated = videoGenStore.updateProject(project.id, {
        status: 'planned',
        scenes,
        refs: filmCtx.resolvedRefs,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Lỗi lập kế hoạch scene:', err);
      res.status(500).json({ error: err.message });
    }
  })
);

// 23b. Thêm hàng loạt kịch bản/prompt vào Hàng đợi (Batch Queue - chuẩn Muse Studio Pro)
app.post('/api/video-gen/batches', (req, res) => {
  try {
    const {
      kind = 'psych_split',
      aspectRatio = '9:16',
      layoutMode = null,
      channelName = 'LÀNH TÂM',
      targetDuration = 30,
      projectId = null,
      sceneStart = 1,
      chainMode = 'none',
      continuityOffset = 0.3,
      lessonText = '',
      voice = 'vi-VN-NamMinhNeural',
      voiceRate = '+20%',
      market = 'VI',
      aiEngine = 'muse_first',
      mediaMode = 'muse',
      prompts = [],
      items = [],
    } = req.body;

    const batchList = Array.isArray(prompts) && prompts.length > 0 ? prompts : Array.isArray(items) ? items : [];
    if (batchList.length === 0) {
      return res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 kịch bản / prompt' });
    }

    const createdProjects = [];
    let prevProjectId = null;

    batchList.forEach((item, index) => {
      const rawScript = (typeof item === 'string' ? item : item.rawScript || item.prompt || '').trim();
      if (!rawScript) return;
      const itemRefs = (typeof item === 'object' && Array.isArray(item.refs)) ? item.refs : [];
      const itemTitle = (typeof item === 'object' && item.title) ? item.title : rawScript.slice(0, 48);
      const sceneNo = projectId ? Number(sceneStart || 1) + index : index + 1;
      const shouldChain =
        chainMode === 'all' ||
        Boolean(req.body.chainContinuity) ||
        (chainMode === 'selected' && Array.isArray(req.body.chainScenes) && req.body.chainScenes.includes(sceneNo));

      const scenes = buildInstantLocalScenes(rawScript, kind, layoutMode);
      const proj = videoGenStore.createProject({
        kind,
        market,
        voice,
        voiceRate,
        aiEngine,
        mediaMode,
        aspectRatio,
        layoutMode,
        channelName,
        targetDuration,
        projectId,
        sceneNo,
        predecessorId: shouldChain && prevProjectId ? prevProjectId : null,
        continuityOffset,
        refs: itemRefs,
        rawScript,
        lessonText,
        title: itemTitle,
        scenes,
        status: 'queued',
      });
      prevProjectId = proj.id;
      createdProjects.push(proj);
    });

    res.json({
      success: true,
      batchCount: createdProjects.length,
      projects: createdProjects,
      data: createdProjects,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 24. Sinh media + audio cho toàn bộ scene rồi render
async function executeProjectGeneration(id, options = {}) {
  const { renderOnly = false } = options;
  const project = videoGenStore.getProject(id);
  if (!project) throw new Error('Không tìm thấy project');

  // Nếu project có predecessorId và đã hoàn tất, trích xuất continuity frame
  let continuityFramePath = null;
  if (project.predecessorId) {
    const pred = videoGenStore.getProject(project.predecessorId);
    if (pred && pred.outputPath && fs.existsSync(pred.outputPath)) {
      try {
        continuityFramePath = await extractContinuityFrame(
          pred.outputPath,
          `cont_${pred.id}_to_${project.id}`,
          project.continuityOffset || 0.3
        );
      } catch (contErr) {
        console.warn('[Continuity] Không trích xuất được khung nối:', contErr.message);
      }
    }
  }

  const filmCtx = project.projectId
    ? filmStore.resolveSceneContext(project.projectId, project.sceneNo || 1, project.refs || [], continuityFramePath)
    : {
        resolvedRefs: [
          ...(continuityFramePath ? [continuityFramePath] : []),
          ...(project.refs || []),
        ].slice(0, 8),
      };

  if (!renderOnly) {
    videoGenStore.updateProject(id, { status: 'generating_media' });
    const aiEngine = options.aiEngine || project.aiEngine || 'muse_first';
    const museUrl = options.museUrl || DEFAULT_MUSE_URL;

    const isSceneMediaReady = (s) =>
      (s.mediaStatus === 'video' || s.mediaStatus === 'image') && Boolean(s.mediaFile);

    const runMusePass = async () => {
      const { page } = await connectToMusePage({ museUrl });
      for (const scene of project.scenes) {
        if (isSceneMediaReady(scene)) continue;
        try {
          const result = await generateSceneMediaWithMuse(page, scene, MEDIA_DIR, {
            projectId: project.id,
          });
          scene.mediaStatus = result.mediaStatus;
          scene.mediaFile = result.mediaFile;
          scene.provider = 'muse.ai';
          scene.error = null;
        } catch (sceneErr) {
          scene.mediaStatus = 'pending';
          scene.error = `[Muse.ai] ${sceneErr.message}`;
        }
        videoGenStore.updateProject(id, { scenes: project.scenes });
      }
    };

    const runGeminiPass = async () => {
      const { page } = await connectToGeminiPage();
      for (const scene of project.scenes) {
        if (isSceneMediaReady(scene)) continue;
        try {
          const result = await generateSceneMedia(page, scene, MEDIA_DIR, {
            projectId: project.id,
            refs: filmCtx.resolvedRefs,
          });
          scene.mediaStatus = result.mediaStatus;
          scene.mediaFile = result.mediaFile;
          scene.provider = 'gemini_ultra';
          scene.error = null;
          project.threadUrl = result.threadUrl || project.threadUrl;
        } catch (sceneErr) {
          scene.mediaStatus = 'pending';
          scene.error = `[Gemini Ultra] ${sceneErr.message}`;
        }
        videoGenStore.updateProject(id, { scenes: project.scenes, threadUrl: project.threadUrl });
      }
    };

    try {
      if (aiEngine === 'gemini_first') {
        try {
          await runGeminiPass();
        } catch (gemErr) {
          console.warn('[Generate] Gemini Ultra (#1) gặp lỗi, chuyển sang Muse.ai (#2):', gemErr.message);
        }
        if (project.scenes.some((s) => !isSceneMediaReady(s))) {
          await runMusePass();
        }
      } else {
        // Mặc định: Ưu tiên số 1 là Muse.ai -> Dự phòng số 2 là Gemini Ultra
        let museError = null;
        try {
          await runMusePass();
        } catch (err) {
          museError = err;
          console.warn('[Generate] Muse.ai (Ưu tiên #1) gặp lỗi, tự động chuyển sang Gemini Ultra (Dự phòng #2):', err.message);
        }
        if (aiEngine !== 'muse_only' && project.scenes.some((s) => !isSceneMediaReady(s))) {
          try {
            await runGeminiPass();
          } catch (gemErr) {
            if (museError) throw new Error(`Muse.ai (#1): ${museError.message} | Gemini Ultra (#2): ${gemErr.message}`);
            throw gemErr;
          }
        } else if (museError && aiEngine === 'muse_only') {
          throw museError;
        }
      }
    } catch (cdpErr) {
      if (!options.allowFallbackRender) {
        videoGenStore.updateProject(id, { status: 'media_failed', error: cdpErr.message });
        throw cdpErr;
      }
      console.warn('[Generate] Muse.ai & Gemini Ultra chưa sẵn sàng, tiếp tục TTS + Remotion Render:', cdpErr.message);
    }
  }

  videoGenStore.updateProject(id, { status: 'generating_audio' });
  const marketPreset = getMarketPreset(project.market || 'VI');
  const selectedVoice = options.voice || project.meta?.voice || marketPreset.defaultVoice;
  const selectedRate = options.voiceRate || project.meta?.voiceRate || marketPreset.defaultVoiceRate || '+20%';

  if (options.voice || options.voiceRate) {
    project.meta = {
      ...(project.meta || {}),
      voice: selectedVoice,
      voiceRate: selectedRate,
    };
    videoGenStore.updateProject(id, { meta: project.meta });
  }

  for (let i = 0; i < project.scenes.length; i++) {
    const audioResult = await generateSceneAudio(
      project.scenes[i],
      selectedVoice,
      selectedRate,
      AUDIO_DIR,
      { projectId: project.id }
    );
    project.scenes[i] = audioResult;
    videoGenStore.updateProject(id, { scenes: project.scenes });
  }

  // Tạo giọng đọc cho câu Bài học kết video (nếu có) để cuối video không bị im lặng
  if (project.lessonText && project.lessonText.trim()) {
    try {
      const lessonAudio = await generateSceneAudio(
        {
          id: `${project.id}_lesson`,
          type: 'lesson',
          title: project.market && project.market !== 'VI' ? marketPreset.lessonTitle : 'Bài học rút ra',
          text: project.lessonText.trim(),
        },
        selectedVoice,
        selectedRate,
        AUDIO_DIR
      );
      videoGenStore.updateProject(id, {
        lessonAudioFile: lessonAudio.audioFile || '',
        lessonDurationInFrames: lessonAudio.durationInFrames || null,
      });
    } catch (lessonErr) {
      console.warn('[TTS] Không tạo được audio cho câu bài học:', lessonErr.message);
    }
  }

  videoGenStore.updateProject(id, { status: 'rendering' });
  const outputPath = renderProject(videoGenStore.getProject(id));

  return videoGenStore.updateProject(id, { status: 'done', outputPath, error: null });
}

app.post(
  '/api/video-gen/:id/generate',
  withGenerationLock(async (req, res) => {
    try {
      const updated = await executeProjectGeneration(req.params.id, {
        renderOnly: Boolean(req.body && req.body.renderOnly),
        allowFallbackRender: Boolean(req.body && req.body.allowFallbackRender),
        aiEngine: req.body?.aiEngine || 'muse_first',
        mediaMode: req.body?.mediaMode || 'muse',
        voice: req.body?.voice,
        voiceRate: req.body?.voiceRate,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Lỗi generate video:', err);
      try {
        videoGenStore.updateProject(req.params.id, { status: 'failed', error: err.message });
      } catch (_ignore) {}
      res.status(500).json({ error: err.message });
    }
  })
);

// 24b. Render nhanh bằng TTS + Remotion (sử dụng Built-in Pictogram/Surreal hoặc media có sẵn)
app.post(
  '/api/video-gen/:id/render-only',
  withGenerationLock(async (req, res) => {
    try {
      const updated = await executeProjectGeneration(req.params.id, {
        renderOnly: true,
        allowFallbackRender: true,
        voice: req.body?.voice,
        voiceRate: req.body?.voiceRate,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Lỗi render-only video:', err);
      try {
        videoGenStore.updateProject(req.params.id, { status: 'failed', error: err.message });
      } catch (_ignore) {}
      res.status(500).json({ error: err.message });
    }
  })
);

// 24c. Chạy toàn bộ Hàng đợi (Batch Queue Runner)
app.post('/api/video-gen/queue/start', async (req, res) => {
  if (queueRunnerActive) {
    return res.json({ success: true, message: 'Hàng đợi đang chạy sẵn.' });
  }
  const { projectId = null, renderOnly = false } = req.body || {};
  queueRunnerActive = true;

  (async () => {
    try {
      while (queueRunnerActive) {
        const queued = videoGenStore
          .listProjects()
          .slice()
          .reverse()
          .find(
            (p) =>
              ['queued', 'planned'].includes(p.status) &&
              (!projectId || p.projectId === projectId)
          );
        if (!queued) break;
        generationBusy = true;
        try {
          await executeProjectGeneration(queued.id, {
            renderOnly,
            allowFallbackRender: true,
          });
        } catch (e) {
          videoGenStore.updateProject(queued.id, { status: 'failed', error: e.message });
        } finally {
          generationBusy = false;
        }
      }
    } finally {
      queueRunnerActive = false;
    }
  })();

  res.json({ success: true, running: true });
});

app.post('/api/video-gen/queue/stop', (req, res) => {
  queueRunnerActive = false;
  res.json({ success: true, running: false });
});

// 25. Sinh lại media cho 1 scene bị lỗi (Ưu tiên #1: Muse.ai -> Dự phòng #2: Gemini Ultra)
app.post(
  '/api/video-gen/:id/retry-scene/:sceneId',
  withGenerationLock(async (req, res) => {
    try {
      const { id, sceneId } = req.params;
      const project = videoGenStore.getProject(id);
      if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
      const scene = project.scenes.find((s) => String(s.id) === sceneId);
      if (!scene) return res.status(404).json({ error: 'Không tìm thấy scene' });

      const aiEngine = req.body?.aiEngine || project.aiEngine || 'muse_first';
      let result = null;

      if (aiEngine === 'gemini_first') {
        try {
          const { page } = await connectToGeminiPage();
          result = await generateSceneMedia(page, scene, MEDIA_DIR, {
            projectId: project.id,
            refs: project.refs || [],
          });
          scene.provider = 'gemini_ultra';
        } catch (_gemErr) {
          const { page } = await connectToMusePage({ museUrl: DEFAULT_MUSE_URL });
          result = await generateSceneMediaWithMuse(page, scene, MEDIA_DIR, {
            projectId: project.id,
          });
          scene.provider = 'muse.ai';
        }
      } else {
        // Mặc định: Ưu tiên số 1 Muse.ai -> Dự phòng số 2 Gemini Ultra
        try {
          const { page } = await connectToMusePage({ museUrl: DEFAULT_MUSE_URL });
          result = await generateSceneMediaWithMuse(page, scene, MEDIA_DIR, {
            projectId: project.id,
          });
          scene.provider = 'muse.ai';
        } catch (museErr) {
          console.warn(`[RetryScene] Muse.ai (#1) lỗi (${museErr.message}), chuyển sang Gemini Ultra (#2)...`);
          if (aiEngine === 'muse_only') throw museErr;
          const { page } = await connectToGeminiPage();
          result = await generateSceneMedia(page, scene, MEDIA_DIR, {
            projectId: project.id,
            refs: project.refs || [],
          });
          scene.provider = 'gemini_ultra';
        }
      }

      scene.mediaStatus = result.mediaStatus;
      scene.mediaFile = result.mediaFile;
      scene.error = null;

      const updated = videoGenStore.updateProject(id, { scenes: project.scenes });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Lỗi retry scene:', err);
      const rawMsg = String(err.message || err);
      const friendlyMsg =
        rawMsg.includes('ECONNREFUSED') || rawMsg.includes('Timeout') || rawMsg.includes('waitFor')
          ? 'Đã tự động mở cửa sổ Chrome AI (cổng 9222) với Muse.ai (Ưu tiên #1) và Gemini Ultra (Dự phòng #2). Bạn hãy đăng nhập tài khoản Muse.ai / Gemini trên cửa sổ Chrome vừa bật để tạo video AI!'
          : rawMsg;
      res.status(500).json({ error: friendlyMsg });
    }
  })
);

// 25b. Xem danh sách ảnh tham chiếu & khung nối cảnh của 1 project
app.get('/api/video-gen/:id/references', (req, res) => {
  const project = videoGenStore.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
  const ctx = project.projectId
    ? filmStore.resolveSceneContext(project.projectId, project.sceneNo || 1, project.refs || [], null)
    : {
        resolvedImages: (project.refs || []).map((r) => ({
          role: 'task',
          name: path.basename(r),
          ref: r,
        })),
      };
  res.json({
    success: true,
    images: (ctx.resolvedImages || []).map((img) => ({
      ...img,
      url: img.ref.includes('uploads')
        ? `/storage/uploads/${path.basename(img.ref)}`
        : img.ref.includes('continuity')
        ? `/storage/continuity/${path.basename(img.ref)}`
        : img.ref,
    })),
  });
});

// 26. Lấy trạng thái 1 project
app.get('/api/video-gen/:id', (req, res) => {
  const project = videoGenStore.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project' });
  res.json({ success: true, data: project });
});

// 27. Danh sách project đã tạo
app.get('/api/video-gen', (req, res) => {
  res.json({
    success: true,
    running: queueRunnerActive || generationBusy,
    data: videoGenStore.listProjects(),
  });
});

// 27b. Xóa project hoặc xóa nhiều project
app.delete('/api/video-gen/:id', (req, res) => {
  videoGenStore.deleteProject(req.params.id);
  res.json({ success: true });
});

app.post('/api/video-gen/delete-selected', (req, res) => {
  const { ids = [] } = req.body;
  let deleted = 0;
  for (const id of ids) {
    if (videoGenStore.deleteProject(id)) deleted++;
  }
  res.json({ success: true, deleted });
});

// 27c. Đưa video AI đã render sang bộ lọc Remake FFmpeg / Hàng đợi Autopilot TikTok
app.post('/api/video-gen/:id/send-to-remake', (req, res) => {
  try {
    const project = videoGenStore.getProject(req.params.id);
    if (!project || !project.outputPath || !fs.existsSync(project.outputPath)) {
      return res.status(400).json({ error: 'Video AI chưa được render xong' });
    }
    const videoId = project.id;
    const fileName = `ai_${videoId}.mp4`;
    const destPath = path.join(__dirname, 'storage', 'raw', fileName);
    fs.copyFileSync(project.outputPath, destPath);

    const record = {
      id: videoId,
      title: project.title || project.rawScript.slice(0, 60) || 'AI Video',
      author: project.channelName || 'AI Studio Pro',
      cover: null,
      duration: project.targetDuration || 30,
      rawFileName: fileName,
      rawUrl: `/storage/raw/${fileName}`,
      remakeFileName: fileName,
      remakeUrl: `/storage/raw/${fileName}`,
      originalMd5: VideoRemaker.getFileMD5(destPath),
      remadeMd5: VideoRemaker.getFileMD5(destPath),
      minioStatus: { uploaded: false, key: null, url: null, presignedUrl: null },
      status: 'remade',
      createdAt: new Date().toISOString(),
    };

    const db = getDb();
    db.videos = db.videos.filter((v) => v.id !== videoId);
    db.videos.unshift(record);
    saveDb(db);

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    const finalCaption = caption && caption.trim() ? caption.trim() : project.title || project.kind;
    const uploadResult = await TikTokUploader.uploadVideo(project.outputPath, finalCaption);

    const updated = videoGenStore.updateProject(id, {
      publishing: { tiktok: { posted: true, postedAt: new Date().toISOString(), url: uploadResult.url || null } },
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

    const updated = videoGenStore.updateProject(id, {
      publishing: {
        ...(project.publishing || {}),
        youtube: {
          posted: true,
          postedAt: new Date().toISOString(),
          title: finalTitle,
          description: finalDesc,
          tags: finalTags,
          market: targetMarket,
        },
      },
    });
    res.json({ success: true, data: updated, message: 'Đã sẵn sàng gói xuất bản YouTube Shorts!' });
  } catch (err) {
    console.error('Lỗi chuẩn bị YouTube Shorts:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PHÂN HỆ MỚI 6: KHO THƯ VIỆN HỢP NHẤT (AI VIDEO + PHIM + DOUYIN REUP)
// ============================================================================

app.get('/api/library', (req, res) => {
  const aiProjects = videoGenStore.listProjects().filter((p) => p.outputPath && fs.existsSync(p.outputPath));
  const douyinVideos = getDb().videos || [];

  const items = [
    ...aiProjects.map((p) => ({
      id: p.id,
      source: p.projectId ? 'film' : 'ai',
      projectId: p.projectId || null,
      title: p.title || p.rawScript.slice(0, 70),
      subtitle: `${p.kind.toUpperCase()} · ${p.aspectRatio} · ${p.layoutMode === 'split' ? 'Khung 3 tầng Lành Tâm' : 'Fullscreen'}`,
      videoUrl: `/storage/video-gen/${p.id}/output.mp4`,
      createdAt: p.updatedAt || p.createdAt,
      postedToTikTok: Boolean(p.publishing?.tiktok?.posted),
    })),
    ...douyinVideos.map((v) => ({
      id: v.id,
      source: 'douyin',
      projectId: null,
      title: v.title || 'Douyin Video',
      subtitle: `Douyin Reup · ${v.remakeUrl ? 'Đã Remake FFmpeg' : 'Bản gốc'}`,
      videoUrl: v.remakeUrl || v.rawUrl,
      createdAt: v.createdAt,
      postedToTikTok: Boolean(v.postedToTikTok),
    })),
  ];

  res.json({ success: true, items });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Unified AI Video Studio Pro & Douyin Reup Server đang chạy tại: http://localhost:${PORT}`);
  });
}

module.exports = app;
