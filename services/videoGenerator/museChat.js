// services/videoGenerator/museChat.js
const fs = require('fs');
const path = require('path');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { buildDirectorPrompt, normalizeScenes } = require('./director');
const { getMarketPreset } = require('./stylePresets');

const DEFAULT_CDP_URL = process.env.MUSE_CDP_URL || 'http://localhost:9222';
const DEFAULT_MUSE_URL = process.env.MUSE_URL || 'https://muse.ai';

const PROMPT_INPUT_SELECTORS = [
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

const SUBMIT_BUTTON_SELECTORS = [
  'button[type="submit"]:not([disabled])',
  'button[aria-label*="send" i]:not([disabled])',
  'button[aria-label*="generate" i]:not([disabled])',
  'button:has-text("Generate"):not([disabled])',
  'button:has-text("Create"):not([disabled])',
  'button:has-text("Tạo"):not([disabled])',
  'button:has-text("Send"):not([disabled])',
].join(', ');

const REPLY_SELECTORS = [
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

async function connectToMusePage(opts = {}) {
  const cdpUrl = opts.cdpUrl || DEFAULT_CDP_URL;
  const targetUrl = opts.museUrl || DEFAULT_MUSE_URL;
  const { chromium } = require('playwright');

  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (err) {
    throw new Error(
      `Không kết nối được Chrome qua cổng Debug (${cdpUrl}). ` +
        `Hãy mở Chrome bằng lệnh: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 ` +
        `và đăng nhập sẵn tài khoản Muse (${targetUrl}). Chi tiết: ${err.message}`
    );
  }

  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('Không tìm thấy Chrome context nào. Hãy mở Chrome với --remote-debugging-port=9222.');
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
  }

  return { browser, page };
}

async function submitPromptOnMuse(page, promptText) {
  const input = page.locator(PROMPT_INPUT_SELECTORS).first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.click();
  await input.fill(promptText);

  const submitBtn = page.locator(SUBMIT_BUTTON_SELECTORS).first();
  if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible().catch(() => false))) {
    await submitBtn.click();
  } else {
    await input.press('Enter');
  }
}

async function sendMusePromptAndWaitForReply(page, promptText, opts = {}) {
  const { timeoutMs = 180000, pollMs = 2000, stableChecks = 2 } = opts;

  const initialCount = await page.locator(REPLY_SELECTORS).count().catch(() => 0);
  await submitPromptOnMuse(page, promptText);

  const start = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    const replies = page.locator(REPLY_SELECTORS);
    const count = await replies.count().catch(() => 0);
    if (count > initialCount || count > 0) {
      const currentText = (await replies.last().innerText().catch(() => '')).trim();
      if (currentText && currentText.length > 20 && currentText !== promptText.trim()) {
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

async function extractLatestVideoUrl(page, initialVideoCount) {
  return page.evaluate((prevCount) => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length > prevCount) {
      const lastVideo = videos[videos.length - 1];
      if (lastVideo.src && lastVideo.src.startsWith('http')) return lastVideo.src;
      const source = lastVideo.querySelector('source');
      if (source && source.src && source.src.startsWith('http')) return source.src;
    }
    const downloadLinks = Array.from(
      document.querySelectorAll('a[download], a[href*=".mp4"], a[href*="video"]')
    );
    for (let i = downloadLinks.length - 1; i >= 0; i--) {
      const href = downloadLinks[i].href;
      if (href && href.startsWith('http') && (href.includes('.mp4') || downloadLinks[i].hasAttribute('download'))) {
        return href;
      }
    }
    return null;
  }, initialVideoCount);
}

async function waitForMuseVideoAndDownload(page, promptText, outputPath, opts = {}) {
  const { timeoutMs = 420000, pollMs = 3000 } = opts;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const initialVideoCount = await page.locator('video').count().catch(() => 0);
  await submitPromptOnMuse(page, promptText);

  const startTime = Date.now();
  let videoUrl = null;

  while (Date.now() - startTime < timeoutMs) {
    videoUrl = await extractLatestVideoUrl(page, initialVideoCount);
    if (videoUrl) break;
    await page.waitForTimeout(pollMs);
  }

  if (!videoUrl) {
    throw new Error('Hết thời gian chờ Muse sinh video mới (7 phút). Hãy kiểm tra cửa sổ Chrome Muse.');
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

async function planScenesWithMuse(page, rawScript, kind = 'story', market = 'US') {
  const prompt = buildDirectorPrompt(rawScript, kind, market);
  let reply;
  try {
    reply = await sendMusePromptAndWaitForReply(page, prompt);
    const parsed = extractJson(reply);
    return {
      scenes: normalizeScenes(parsed.scenes),
      title: parsed.title || '',
      lessonText: parsed.lessonText || '',
      youtubeMeta: parsed.youtubeMeta || null,
    };
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) throw err;
    const retryReply = await sendMusePromptAndWaitForReply(
      page,
      'Please output ONLY valid JSON matching the exact schema requested above, with no markdown prose.'
    );
    const parsed = extractJson(retryReply);
    return {
      scenes: normalizeScenes(parsed.scenes),
      title: parsed.title || '',
      lessonText: parsed.lessonText || '',
      youtubeMeta: parsed.youtubeMeta || null,
    };
  }
}

async function generateSceneMediaWithMuse(page, scene, mediaDir) {
  const outputPath = path.join(mediaDir, `scene_${scene.id}.mp4`);
  const prompt = scene.videoPrompt || scene.imagePrompt || scene.text;
  await waitForMuseVideoAndDownload(page, prompt, outputPath);
  return { mediaStatus: 'video', mediaFile: `media/scene_${scene.id}.mp4` };
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
    `Language & Voiceover: Native ${marketPreset.locale} (${marketPreset.scriptInstruction}).\n` +
    `Topic / Script:\n${content}`
  );
}

async function generateFullVideoWithMuse(page, params, outputPath) {
  const prompt = buildMuseFullVideoPrompt(params);
  await waitForMuseVideoAndDownload(page, prompt, outputPath);
  return outputPath;
}

module.exports = {
  DEFAULT_CDP_URL,
  DEFAULT_MUSE_URL,
  connectToMusePage,
  submitPromptOnMuse,
  sendMusePromptAndWaitForReply,
  waitForMuseVideoAndDownload,
  planScenesWithMuse,
  generateSceneMediaWithMuse,
  buildMuseFullVideoPrompt,
  generateFullVideoWithMuse,
};
