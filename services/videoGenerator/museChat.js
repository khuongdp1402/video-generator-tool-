// services/videoGenerator/museChat.js
const fs = require('fs');
const path = require('path');
const { extractJson, JsonExtractionError } = require('./chatJson');
const {
  buildDirectorPrompt,
  normalizeScenes,
  resolveGenerationMode,
  enforceSceneGoalAlignment,
} = require('./director');
const { getMarketPreset } = require('./stylePresets');
const { extractVideoMotionFrames } = require('./continuity');

const DEFAULT_CDP_URL = process.env.MUSE_CDP_URL || 'http://localhost:9222';
const DEFAULT_MUSE_URL = process.env.MUSE_URL || 'https://muse.ai';

const PROMPT_INPUT_SELECTORS = [
  '[data-hatch-composer-chrome="true"] textarea',
  'textarea[data-hatch-composer-prehydration-input="true"]',
  'textarea[placeholder*="Nhắn tin" i]',
  'textarea[aria-label*="Nhắn tin" i]',
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="describe" i]',
  'textarea[placeholder*="script" i]',
  'textarea[placeholder*="video" i]',
  'textarea[placeholder*="ask" i]',
  'textarea[placeholder*="message" i]',
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  'textarea',
  '[role="textbox"]',
].join(', ');

// Chỉ chọn đúng nút Gửi/Send nằm trong thanh nhập lệnh (composer), tuyệt đối không chọn
// button:has-text("Create") hay button[type="submit"] vì sẽ bấm nhầm vào thẻ lịch sử chat ở phía trên.
const SUBMIT_BUTTON_SELECTORS = [
  '[data-hatch-composer-chrome="true"] button[aria-label="Gửi"]:not([disabled])',
  '[data-hatch-composer-chrome="true"] button[aria-label="Send"]:not([disabled])',
  'button[aria-label="Gửi"]:not([disabled])',
  'button[aria-label="Send"]:not([disabled])',
].join(', ');

const REPLY_SELECTORS = [
  '[data-message-role="assistant"]',
  '[data-message-side="agent"]',
  '[data-message-author-role="assistant"]',
  '.assistant-message',
  '.ai-message',
  '.response-content',
  'message-content',
  '.model-response-text',
  '.markdown',
  'article',
  '.prose',
].join(', ');

async function launchHiddenChromeMuseProfile(targetUrl = DEFAULT_MUSE_URL, headless = true) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(chromePath)) return false;
  const { spawn } = require('child_process');
  const profileDir = path.resolve(__dirname, '..', '..', 'storage', 'chrome-muse-profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const chromeArgs = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--window-size=1440,900',
  ];
  if (headless !== false) {
    chromeArgs.unshift('--headless=new');
  }
  chromeArgs.push(targetUrl);

  const child = spawn('open', ['-n', '-a', 'Google Chrome', '--args', ...chromeArgs], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  await new Promise((r) => setTimeout(r, 3200));
  return true;
}

async function connectToMusePage(opts = {}) {
  const cdpUrl = opts.cdpUrl || DEFAULT_CDP_URL;
  const targetUrl = opts.museUrl || DEFAULT_MUSE_URL;
  const { chromium } = require('playwright');

  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl, { timeout: 3000 });
  } catch (err) {
    if (opts.autoLaunch !== false && String(err.message || '').includes('ECONNREFUSED')) {
      const launched = await launchHiddenChromeMuseProfile(targetUrl, opts.headless !== false);
      if (launched) {
        browser = await chromium.connectOverCDP(cdpUrl, { timeout: 6000 });
      }
    }
    if (!browser) {
      throw new Error(
        `Không kết nối được Chrome qua cổng Debug (${cdpUrl}). Chi tiết: ${err.message}`
      );
    }
  }

  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('Không tìm thấy Chrome context nào trên cổng 9222.');
  }

  let hostKey = 'muse';
  try {
    hostKey = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch (_e) {
    hostKey = 'muse';
  }

  const pages = context.pages();
  let page =
    pages.find((p) => p.url().toLowerCase().includes(hostKey.toLowerCase())) ||
    pages.find((p) => p.url().toLowerCase().includes('muse'));

  if (!page) {
    page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } else if (page.url().includes('/library/') && !opts.keepLibraryPage) {
    await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }

  return { browser, page };
}

async function dismissMuseDialogs(page) {
  if (typeof page.keyboard?.press === 'function') {
    await page.keyboard.press('Escape').catch(() => {});
  }
  if (typeof page.evaluate === 'function') {
    await page
      .evaluate(() => {
        const dialogs = Array.from(
          document.querySelectorAll('[role="dialog"][data-state="open"], [data-slot="dialog-content"][data-state="open"]')
        );
        for (const d of dialogs) {
          const closeBtn = d.querySelector(
            'button[aria-label="Đóng"], button[aria-label="Close"], [data-slot="dialog-close"]'
          );
          if (closeBtn) closeBtn.click();
        }
      })
      .catch(() => {});
  }
}

async function submitPromptOnMuse(page, promptText) {
  // Đóng bất kỳ modal/popup thư viện nào đang mở đè lên khung chat
  await dismissMuseDialogs(page);

  const input = page.locator(PROMPT_INPUT_SELECTORS).first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.click({ force: true });
  await input.fill(promptText);

  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(250);
  }

  const submitBtn = page.locator(SUBMIT_BUTTON_SELECTORS).first();
  if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible().catch(() => false))) {
    await submitBtn.click({ force: true });
  } else {
    await input.press('Enter');
  }
}

function cleanMuseReplyText(raw) {
  return String(raw || '')
    .replace(/^Tin nhắn của Assistant:\s*/i, '')
    .replace(/^Assistant message:\s*/i, '')
    .trim();
}

async function getMuseLastMessageState(page) {
  if (typeof page.evaluate !== 'function') return null;
  return page
    .evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-message-item="true"]'));
      if (items.length === 0) return null;
      const lastItem = items[items.length - 1];
      const lastRole = lastItem.getAttribute('data-message-role') || '';
      const lastText = (lastItem.innerText || '').trim();
      const asstItems = items.filter((el) => el.getAttribute('data-message-role') === 'assistant');
      const lastAsstText = asstItems.length > 0 ? (asstItems[asstItems.length - 1].innerText || '').trim() : '';
      return {
        totalItems: items.length,
        asstCount: asstItems.length,
        lastRole,
        lastText,
        lastAsstText,
      };
    })
    .catch(() => null);
}

async function sendMusePromptAndWaitForReply(page, promptText, opts = {}) {
  const { timeoutMs = 120000, pollMs = 2000, stableChecks = 2 } = opts;

  const isRealBrowserPage = typeof page.evaluate === 'function';
  const initialMsgState = isRealBrowserPage ? await getMuseLastMessageState(page) : null;
  const repliesLocator = page.locator(REPLY_SELECTORS);
  const initialCount = await repliesLocator.count().catch(() => 0);
  const initialLastText = initialMsgState
    ? cleanMuseReplyText(initialMsgState.lastAsstText)
    : isRealBrowserPage && initialCount > 0
      ? cleanMuseReplyText(await repliesLocator.last().innerText().catch(() => ''))
      : '';

  await submitPromptOnMuse(page, promptText);

  const start = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    if (isRealBrowserPage) {
      const msgState = await getMuseLastMessageState(page);
      if (msgState) {
        // Trên Muse.ai, sau khi gửi tin nhắn user thì bubble cuối cùng phải chuyển sang role="assistant"
        if (msgState.lastRole === 'assistant') {
          const currentText = cleanMuseReplyText(msgState.lastText);
          const isNewReply = currentText && currentText !== initialLastText;
          if (isNewReply && currentText.length > 15 && currentText !== promptText.trim()) {
            if (currentText === lastText) {
              stableCount += 1;
              if (stableCount >= stableChecks) {
                return currentText;
              }
            } else {
              stableCount = 0;
            }
            lastText = currentText;
          }
        }
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }
    }

    const replies = page.locator(REPLY_SELECTORS);
    const count = await replies.count().catch(() => 0);
    if (count > initialCount || count > 0) {
      const currentText = cleanMuseReplyText(await replies.last().innerText().catch(() => ''));
      const isNewReply = !isRealBrowserPage || (currentText && currentText !== initialLastText);
      if (isNewReply && currentText && currentText.length > 20 && currentText !== promptText.trim()) {
        if (currentText === lastText) {
          stableCount += 1;
          if (stableCount >= stableChecks) {
            return currentText;
          }
        } else {
          stableCount = 0;
        }
        lastText = currentText;
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(`Hết thời gian chờ (${timeoutMs / 1000}s) phản hồi kịch bản từ Muse.`);
}

async function getRealVideoSrcsOnMuse(page) {
  if (typeof page.evaluate !== 'function') return [];
  return page
    .evaluate(() => {
      return Array.from(document.querySelectorAll('video'))
        .filter(
          (v) =>
            v.getAttribute('aria-hidden') !== 'true' &&
            !v.closest('[data-hatch-avatar-interaction]') &&
            !v.hasAttribute('data-hatch-avatar-layer') &&
            !(v.videoWidth === 480 && v.videoHeight === 480)
        )
        .map((v) => v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src) || '')
        .filter((s) => s.startsWith('blob:') || s.startsWith('http'));
    })
    .catch(() => []);
}

async function countNonAvatarVideos(page) {
  const srcs = await getRealVideoSrcsOnMuse(page);
  return srcs.length;
}

async function extractNewestVideoSrcOnMuse(page, knownSrcs = []) {
  if (typeof page.evaluate !== 'function') return null;
  return page
    .evaluate((prevSrcs) => {
      const prevSet = new Set(prevSrcs || []);
      const candidates = Array.from(document.querySelectorAll('video')).filter(
        (v) =>
          v.getAttribute('aria-hidden') !== 'true' &&
          !v.closest('[data-hatch-avatar-interaction]') &&
          !v.hasAttribute('data-hatch-avatar-layer') &&
          !(v.videoWidth === 480 && v.videoHeight === 480) &&
          (v.videoWidth > 200 || v.readyState >= 2)
      );
      for (const v of candidates) {
        const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src) || '';
        if ((src.startsWith('blob:') || src.startsWith('http')) && !prevSet.has(src)) {
          return src;
        }
      }
      return null;
    }, knownSrcs)
    .catch(() => null);
}

async function extractLatestVideoUrl(page, initialVideoCount) {
  const srcs = await getRealVideoSrcsOnMuse(page);
  if (srcs.length > initialVideoCount) {
    return srcs[0];
  }
  return null;
}

async function attachFilesOnMuse(page, filePaths = []) {
  const validFiles = (filePaths || []).filter((p) => p && fs.existsSync(p));
  if (validFiles.length === 0) return false;
  try {
    const fileInput = page.locator('[data-hatch-composer-chrome="true"] input[type="file"], input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(validFiles);
      await page.waitForTimeout(1800);
      return true;
    }
  } catch (err) {
    console.warn('[Muse.ai] Không thể đính kèm file tham chiếu:', err.message);
  }
  return false;
}

async function downloadVideoUrlOrBlobToDisk(page, videoUrl, outputPath) {
  if (videoUrl.startsWith('blob:')) {
    const base64Data = await page.evaluate(async (bUrl) => {
      const resp = await fetch(bUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = String(reader.result || '');
          const commaIdx = res.indexOf(',');
          resolve(commaIdx > -1 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }, videoUrl);

    if (base64Data) {
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length > 1000) {
        fs.writeFileSync(outputPath, buf);
        return outputPath;
      }
    }
    throw new Error(`Blob video trên Muse.ai rỗng hoặc không đọc được (${videoUrl})`);
  }

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await page.request.get(videoUrl);
      if (res.ok()) {
        const buffer = await res.body();
        if (buffer && buffer.length > 1000) {
          fs.writeFileSync(outputPath, buffer);
          return outputPath;
        }
      }
    } catch (err) {
      console.log(`[Muse] Thử tải video lần ${attempt} chưa thành công (${err.message}), thử lại sau 3s...`);
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`Không thể tải file video từ URL Muse: ${videoUrl}`);
}

async function tryExtractNewestLibraryVideoOnMuse(page, outputPath) {
  try {
    await page.goto('https://muse.ai/library/media?view=video', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await page.waitForTimeout(3000);
    const firstThumb = page.locator('img[src^="blob:"]').first();
    if ((await firstThumb.count()) === 0) return null;
    await firstThumb.click({ force: true });
    await page.waitForTimeout(2000);
    const blobUrl = await extractLatestVideoUrl(page, 0);
    if (blobUrl) {
      await downloadVideoUrlOrBlobToDisk(page, blobUrl, outputPath);
      await dismissMuseDialogs(page);
      await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      return outputPath;
    }
  } catch (err) {
    console.warn('[Muse Library] Không lấy được video từ thư viện Muse:', err.message);
  }
  return null;
}

async function waitForMuseVideoAndDownload(page, promptText, outputPath, opts = {}) {
  const { timeoutMs = 150000, pollMs = 2500 } = opts;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const knownVideoSrcs = await getRealVideoSrcsOnMuse(page);

  const videoRequestPrompt =
    promptText.toLowerCase().includes('video') || promptText.toLowerCase().includes('mp4')
      ? promptText
      : `Use your MP4 video generation tool right now (do NOT generate a still image, call your video tool immediately) to create a vertical 9:16 (720x1280) full-screen single-layer video clip: ${promptText}`;

  await submitPromptOnMuse(page, videoRequestPrompt);

  const startTime = Date.now();
  let videoUrl = null;

  while (Date.now() - startTime < timeoutMs) {
    videoUrl = await extractNewestVideoSrcOnMuse(page, knownVideoSrcs);
    if (videoUrl) break;
    await page.waitForTimeout(pollMs);
  }

  if (videoUrl) {
    return await downloadVideoUrlOrBlobToDisk(page, videoUrl, outputPath);
  }

  // Nếu Muse lưu video mới vào mục Thư viện Video (/library/media?view=video), tự động lấy từ Thư viện
  const libSaved = await tryExtractNewestLibraryVideoOnMuse(page, outputPath);
  if (libSaved) return libSaved;

  throw new Error('Hết thời gian chờ Muse sinh video MP4 mới. Đang chuyển sang phương án dự phòng.');
}

async function planScenesWithMuse(page, rawScript, kind = 'story', market = 'VI', opts = {}) {
  const options = typeof opts === 'object' && opts !== null ? opts : {};
  const prompt = buildDirectorPrompt(rawScript, kind, { ...options, market });
  const normOpts = {
    layoutMode: options.layoutMode,
    generationMode: options.generationMode,
    sourceVideoPath: options.sourceVideoPath,
  };
  let reply;
  try {
    reply = await sendMusePromptAndWaitForReply(page, prompt, { timeoutMs: 45000 });
    const parsed = extractJson(reply);
    return {
      scenes: normalizeScenes(parsed.scenes, normOpts),
      title: parsed.title || '',
      lessonText: parsed.lessonText || '',
      youtubeMeta: parsed.youtubeMeta || null,
    };
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) throw err;
    const retryReply = await sendMusePromptAndWaitForReply(
      page,
      'Please output ONLY valid JSON matching the exact schema requested above, with no markdown prose.',
      { timeoutMs: 35000 }
    );
    const parsed = extractJson(retryReply);
    return {
      scenes: normalizeScenes(parsed.scenes, normOpts),
      title: parsed.title || '',
      lessonText: parsed.lessonText || '',
      youtubeMeta: parsed.youtubeMeta || null,
    };
  }
}

async function getLargeImageSrcsOnMuse(page) {
  if (typeof page.evaluate !== 'function') return [];
  return page
    .evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter(
          (im) =>
            !im.closest('[data-hatch-avatar-interaction]') &&
            (im.naturalWidth || im.width) > 200
        )
        .map((im) => im.src)
        .filter(Boolean)
    )
    .catch(() => []);
}

async function extractNewestLargeImagePngOnMuse(page, knownSrcs = []) {
  if (typeof page.evaluate !== 'function') return null;
  return page
    .evaluate((prevSrcs) => {
      const prevSet = new Set(prevSrcs || []);
      const imgs = Array.from(document.querySelectorAll('img')).filter(
        (im) =>
          im.complete &&
          !im.closest('[data-hatch-avatar-interaction]') &&
          (im.naturalWidth || im.width) > 250 &&
          (im.naturalHeight || im.height) > 250 &&
          im.src &&
          !prevSet.has(im.src)
      );
      if (imgs.length === 0) return null;
      const target = imgs[imgs.length - 1];
      const c = document.createElement('canvas');
      c.width = target.naturalWidth || target.width;
      c.height = target.naturalHeight || target.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(target, 0, 0);
      const dataUrl = c.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      return commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : null;
    }, knownSrcs)
    .catch(() => null);
}

function buildMuseSceneVideoPrompt(scene, opts = {}) {
  const generationMode = resolveGenerationMode(
    opts.generationMode || scene.generationMode,
    'image_to_video'
  );
  const aspectRatio = opts.aspectRatio || scene.aspectRatio || '9:16';
  const ratioSpec =
    aspectRatio === '16:9'
      ? 'horizontal 16:9 widescreen (1280x720) full-screen single-layer'
      : 'vertical 9:16 portrait (720x1280) full-screen single-layer (NO split-screen, NO blurred top/bottom borders, NO text/watermarks)';

  const aligned = enforceSceneGoalAlignment(scene, {
    ...opts,
    generationMode,
    aspectRatio,
  });

  if (generationMode === 'text_to_image' || generationMode === 'image_stitch') {
    return `Generate a single high-resolution ${ratioSpec} illustration image right now (do NOT generate a video, do NOT ask questions, call your image generation tool immediately): ${aligned.alignedImagePrompt}`;
  }

  if (generationMode === 'image_to_video') {
    return (
      `Use your MP4 video generation tool right now (do NOT output a still image, do NOT ask questions, call your video tool immediately) ` +
      `to animate the attached reference keyframe image into a smooth 5-second ${ratioSpec} MP4 video clip: ${aligned.alignedVideoPrompt}`
    );
  }

  if (generationMode === 'video_to_video') {
    return (
      `Use your MP4 video generation tool right now (do NOT output a still image, call your video tool immediately) ` +
      `to create a 5-second ${ratioSpec} video-to-video transformation MP4 clip from the attached motion reference frames/video: ${aligned.alignedVideoPrompt}`
    );
  }

  // Default: text_to_video
  return (
    `Use your MP4 video generation tool right now (do NOT output a still image, do NOT ask questions, call your video tool immediately) ` +
    `to create a 5-second ${ratioSpec} animated MP4 video clip for this scene: ${aligned.alignedVideoPrompt}`
  );
}

async function generateKeyframeImageOnMuse(page, alignedScene, pngOutputPath, opts = {}) {
  const aspectRatio = opts.aspectRatio || alignedScene.aspectRatio || '9:16';
  const ratioSpec =
    aspectRatio === '16:9'
      ? 'horizontal 16:9 widescreen (1280x720) full-screen single-layer'
      : 'vertical 9:16 portrait (720x1280) full-screen single-layer (NO split-screen, NO blurred bars)';
  const knownImgSrcs = await getLargeImageSrcsOnMuse(page);
  const keyframePrompt = `Generate a single ${ratioSpec} keyframe image right now (do not ask questions, call your image generation tool immediately): ${alignedScene.alignedImagePrompt}`;
  await submitPromptOnMuse(page, keyframePrompt);

  const timeoutMs = opts.keyframeTimeoutMs || 45000;
  const pollMs = opts.pollMs || 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const pngBase64 = await extractNewestLargeImagePngOnMuse(page, knownImgSrcs);
    if (pngBase64) {
      const buf = Buffer.from(pngBase64, 'base64');
      if (buf.length > 2000) {
        fs.writeFileSync(pngOutputPath, buf);
        return pngOutputPath;
      }
    }
    await page.waitForTimeout(pollMs);
  }
  return null;
}

async function generateSceneMediaWithMuse(page, scene, mediaDir, opts = {}) {
  fs.mkdirSync(mediaDir, { recursive: true });
  const filePrefix = opts.projectId ? `${opts.projectId}_scene_${scene.id}` : `scene_${scene.id}`;
  const pngOutputPath = path.join(mediaDir, `${filePrefix}.png`);
  const mp4OutputPath = path.join(mediaDir, `${filePrefix}.mp4`);

  const generationMode = resolveGenerationMode(
    opts.generationMode || scene.generationMode,
    'image_to_video'
  );
  const alignedScene = enforceSceneGoalAlignment(scene, {
    ...opts,
    generationMode,
  });

  // 1. Chế độ Tạo Ảnh AI (text_to_image) hoặc Image Stitch (Tạo ảnh 2D + ghép Remotion)
  if (generationMode === 'text_to_image' || generationMode === 'image_stitch') {
    const knownImgSrcs = await getLargeImageSrcsOnMuse(page);
    const initialVideoCount = await countNonAvatarVideos(page);
    await attachFilesOnMuse(page, opts.refs || scene.refs || []);
    const imageRequestPrompt = buildMuseSceneVideoPrompt(alignedScene, {
      ...opts,
      generationMode,
    });
    await submitPromptOnMuse(page, imageRequestPrompt);

    const timeoutMs = opts.timeoutMs || 55000;
    const pollMs = opts.pollMs || 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const pngBase64 = await extractNewestLargeImagePngOnMuse(page, knownImgSrcs);
      if (pngBase64) {
        const buf = Buffer.from(pngBase64, 'base64');
        if (buf.length > 2000) {
          fs.writeFileSync(pngOutputPath, buf);
          console.log(`[Muse.ai · ${generationMode}] Đã lưu ảnh Scene ${scene.id}: ${pngOutputPath}`);
          return {
            mediaStatus: 'image',
            generationMode,
            mediaFile: `media/${filePrefix}.png`,
            localPath: pngOutputPath,
          };
        }
      }
      if (generationMode === 'image_stitch') {
        const videoUrl = await extractLatestVideoUrl(page, initialVideoCount);
        if (videoUrl) {
          await downloadVideoUrlOrBlobToDisk(page, videoUrl, mp4OutputPath);
          return {
            mediaStatus: 'video',
            generationMode: 'image_stitch',
            mediaFile: `media/${filePrefix}.mp4`,
            localPath: mp4OutputPath,
          };
        }
      }
      await page.waitForTimeout(pollMs);
    }
    throw new Error(`Hết thời gian chờ Muse.ai tạo hình ảnh (${generationMode}) cho Scene ${scene.id}`);
  }

  // 2. Chế độ Image-to-Video (Tạo/Lấy Keyframe chuẩn mục tiêu -> Animate thành Video MP4)
  if (generationMode === 'image_to_video') {
    let keyframePath =
      (opts.keyframePath && fs.existsSync(opts.keyframePath) && opts.keyframePath) ||
      (scene.keyframePath && fs.existsSync(scene.keyframePath) && scene.keyframePath) ||
      (fs.existsSync(pngOutputPath) && pngOutputPath) ||
      null;

    if (!keyframePath) {
      await attachFilesOnMuse(page, opts.refs || scene.refs || []);
      console.log(`[Muse.ai · I2V · Scene ${scene.id}] Bước 1/2: Tạo ảnh Keyframe chuẩn mục tiêu...`);
      keyframePath = await generateKeyframeImageOnMuse(page, alignedScene, pngOutputPath, opts);
    }

    const refsToAttach = [
      ...(keyframePath ? [keyframePath] : []),
      ...((opts.refs || scene.refs || []).filter((p) => p !== keyframePath)),
    ];
    await attachFilesOnMuse(page, refsToAttach);

    const i2vPrompt = buildMuseSceneVideoPrompt(alignedScene, {
      ...opts,
      generationMode: 'image_to_video',
    });
    console.log(`[Muse.ai · I2V · Scene ${scene.id}] Bước 2/2: Biến ảnh Keyframe thành Video chuyển động...`);
    try {
      await waitForMuseVideoAndDownload(page, i2vPrompt, mp4OutputPath, {
        timeoutMs: opts.videoTimeoutMs || opts.timeoutMs || 150000,
        pollMs: opts.pollMs || 2500,
      });
      return {
        mediaStatus: 'video',
        generationMode: 'image_to_video',
        mediaFile: `media/${filePrefix}.mp4`,
        keyframeFile: keyframePath ? `media/${filePrefix}.png` : '',
        localPath: mp4OutputPath,
      };
    } catch (videoErr) {
      if (keyframePath && opts.allowKeyframeFallback !== false) {
        console.warn(
          `[Muse.ai · I2V · Scene ${scene.id}] Chưa lấy được MP4 (${videoErr.message}), giữ Keyframe chuẩn mục tiêu để không đứt luồng.`
        );
        return {
          mediaStatus: 'image',
          generationMode: 'image_to_video',
          mediaFile: `media/${filePrefix}.png`,
          keyframeFile: `media/${filePrefix}.png`,
          localPath: keyframePath,
        };
      }
      throw videoErr;
    }
  }

  // 3. Chế độ Video-to-Video (Trích xuất chuyển động từ video nguồn + Biến đổi sang Video mục tiêu)
  if (generationMode === 'video_to_video') {
    const sourceVideo =
      scene.sourceVideoPath || opts.sourceVideoPath || opts.continuityVideoPath || '';
    let motionRefs = [];
    if (sourceVideo && fs.existsSync(sourceVideo)) {
      try {
        motionRefs = await extractVideoMotionFrames(sourceVideo, `${filePrefix}`);
      } catch (extractErr) {
        console.warn(`[Muse.ai · V2V · Scene ${scene.id}] Không trích xuất được motion frames: ${extractErr.message}`);
      }
    }
    const allRefs = [...motionRefs, ...(opts.refs || scene.refs || [])];
    await attachFilesOnMuse(page, allRefs);

    const v2vPrompt = buildMuseSceneVideoPrompt(alignedScene, {
      ...opts,
      generationMode: 'video_to_video',
    });
    console.log(`[Muse.ai · V2V · Scene ${scene.id}] Đang biến đổi Video-to-Video (tham chiếu chuyển động: ${motionRefs.length} frames)...`);
    await waitForMuseVideoAndDownload(page, v2vPrompt, mp4OutputPath, {
      timeoutMs: opts.videoTimeoutMs || opts.timeoutMs || 150000,
      pollMs: opts.pollMs || 2500,
    });
    return {
      mediaStatus: 'video',
      generationMode: 'video_to_video',
      mediaFile: `media/${filePrefix}.mp4`,
      localPath: mp4OutputPath,
    };
  }

  // 4. Chế độ Text-to-Video (Tạo trực tiếp Video MP4 từ kịch bản chuẩn mục tiêu)
  await attachFilesOnMuse(page, opts.refs || scene.refs || []);
  const t2vPrompt = buildMuseSceneVideoPrompt(alignedScene, {
    ...opts,
    generationMode: 'text_to_video',
  });
  console.log(`[Muse.ai · T2V · Scene ${scene.id}] Đang tạo trực tiếp Video clip từ kịch bản chuẩn mục tiêu...`);
  await waitForMuseVideoAndDownload(page, t2vPrompt, mp4OutputPath, {
    timeoutMs: opts.videoTimeoutMs || opts.timeoutMs || 150000,
    pollMs: opts.pollMs || 2500,
  });
  return {
    mediaStatus: 'video',
    generationMode: 'text_to_video',
    mediaFile: `media/${filePrefix}.mp4`,
    localPath: mp4OutputPath,
  };
}

function buildMuseFullVideoPrompt({ topic, rawScript, market = 'US', aspectRatio = '9:16', kind = 'story' }) {
  const marketPreset = getMarketPreset(market);
  const content = (rawScript || topic || '').trim();
  if (!content) {
    throw new Error('Vui lòng nhập chủ đề hoặc kịch bản để Muse tạo video.');
  }
  return (
    `Create a complete, high-retention ${aspectRatio} YouTube video for the ${marketPreset.name} (${marketPreset.locale}) market.\n` +
    `Style: ${kind === 'handdrawn' ? '2D hand-drawn explainer illustration' : 'Cinematic 3D / photorealistic storytelling'}.\n` +
    `Language for voiceover/captions: ${marketPreset.language} (${marketPreset.locale}).\n` +
    `Topic / Script:\n${content}\n\n` +
    `Please generate the full video with engaging visual hooks, smooth transitions, dynamic pacing, and clear storytelling.`
  );
}

async function generateFullVideoWithMuse(page, opts = {}) {
  const {
    topic,
    rawScript,
    market = 'US',
    aspectRatio = '9:16',
    kind = 'story',
    outputPath,
    timeoutMs = 240000,
  } = opts;

  if (!outputPath) {
    throw new Error('Thiếu outputPath để lưu video từ Muse.');
  }

  const promptText = buildMuseFullVideoPrompt({ topic, rawScript, market, aspectRatio, kind });
  await waitForMuseVideoAndDownload(page, promptText, outputPath, { timeoutMs });
  return {
    outputPath,
    promptText,
  };
}

module.exports = {
  DEFAULT_CDP_URL,
  DEFAULT_MUSE_URL,
  connectToMusePage,
  submitPromptOnMuse,
  sendMusePromptAndWaitForReply,
  waitForMuseVideoAndDownload,
  planScenesWithMuse,
  attachFilesOnMuse,
  buildMuseSceneVideoPrompt,
  generateSceneMediaWithMuse,
  buildMuseFullVideoPrompt,
  generateFullVideoWithMuse,
  launchHiddenChromeMuseProfile,
};
