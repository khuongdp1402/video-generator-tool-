// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');

async function getKnownGeminiLargeImageSrcs(page) {
  if (typeof page.evaluate !== 'function') return [];
  return page
    .evaluate(() =>
      Array.from(document.querySelectorAll('model-response img, message-content img, img[src^="blob:"]'))
        .filter((im) => (im.naturalWidth || im.width) > 200 && (im.naturalHeight || im.height) > 200)
        .map((im) => im.src)
        .filter(Boolean)
    )
    .catch(() => []);
}

async function extractNewestGeminiImagePng(page, knownSrcs = []) {
  if (typeof page.evaluate !== 'function') return null;
  return page
    .evaluate((prevSrcs) => {
      const prevSet = new Set(prevSrcs || []);
      const imgs = Array.from(
        document.querySelectorAll('model-response img, message-content img, img[src^="blob:"]')
      ).filter(
        (im) =>
          im.complete &&
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

/**
 * Generates visual media (2D illustration image via Imagen 3 or video clip via Veo)
 * for a scene via Gemini Ultra Web (dophukhuong1234@gmail.com).
 * Supports attaching up to 8 reference images before sending the prompt.
 */
async function generateSceneMedia(page, scene, mediaDir, opts = {}) {
  fs.mkdirSync(mediaDir, { recursive: true });

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 20000 });

  // Attach reference images if provided (up to 8 files)
  const refs = (opts.refs || scene.refs || []).filter((p) => p && fs.existsSync(p)).slice(0, 8);
  if (refs.length > 0) {
    try {
      const fileInputs = page.locator('input[type="file"]');
      if ((await fileInputs.count()) > 0) {
        await fileInputs.first().setInputFiles(refs);
        await page.waitForTimeout(1500);
      }
    } catch (uploadErr) {
      console.warn(`[Scene ${scene.id}] Không thể đính kèm trực tiếp file qua input[type=file]: ${uploadErr.message}`);
    }
  }

  const knownImgSrcs = await getKnownGeminiLargeImageSrcs(page);
  const initialVideoCount = await page.locator('video').count();

  const rawPrompt = scene.imagePrompt || scene.videoPrompt || scene.text;
  const fullPrompt = /^generate an image/i.test(rawPrompt)
    ? rawPrompt
    : `Generate an image: ${rawPrompt}`;

  console.log(`[Gemini Ultra · Scene ${scene.id}] Gửi lệnh tạo hình minh họa (ảnh tham chiếu: ${refs.length})...`);
  await promptInput.first().fill(fullPrompt);
  await promptInput.first().press('Enter');

  const filePrefix = opts.projectId ? `${opts.projectId}_scene_${scene.id}` : `scene_${scene.id}`;
  const pngOutputPath = path.join(mediaDir, `${filePrefix}.png`);
  const mp4OutputPath = path.join(mediaDir, `${filePrefix}.mp4`);

  const startTime = Date.now();
  const timeoutMs = opts.timeoutMinutes ? Number(opts.timeoutMinutes) * 60 * 1000 : 50000;
  let videoSrc = null;

  while (Date.now() - startTime < timeoutMs) {
    // 1. Check for newly generated Imagen 3 illustration image
    const pngBase64 = await extractNewestGeminiImagePng(page, knownImgSrcs);
    if (pngBase64) {
      const buf = Buffer.from(pngBase64, 'base64');
      if (buf.length > 2000) {
        fs.writeFileSync(pngOutputPath, buf);
        console.log(`[Gemini Ultra · Scene ${scene.id}] Đã lưu ảnh minh họa: ${pngOutputPath} (${buf.length} bytes)`);
        return {
          mediaStatus: 'image',
          mediaFile: `media/${filePrefix}.png`,
          localPath: pngOutputPath,
          threadUrl: page.url(),
        };
      }
    }

    // 2. Check for newly generated Veo video
    const currentCount = await page.locator('video').count();
    if (currentCount > initialVideoCount) {
      const candidate = page.locator('video').last();
      const src = await candidate.getAttribute('src');
      if (src && src.startsWith('http')) {
        videoSrc = src;
        break;
      }
    }
    await page.waitForTimeout(2000);
  }

  if (!videoSrc) {
    throw new Error(`Hết thời gian chờ Gemini Ultra tạo hình minh họa cho scene ${scene.id}`);
  }

  let downloaded = false;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await page.request.get(videoSrc);
      if (res.ok()) {
        const buffer = await res.body();
        fs.writeFileSync(mp4OutputPath, buffer);
        downloaded = true;
        break;
      }
    } catch (e) {
      console.log(`[Scene ${scene.id}] Thử tải lần ${attempt} chưa thành công (${e.message}), chờ 3s thử lại...`);
    }
    await page.waitForTimeout(3000);
  }

  if (!downloaded) {
    throw new Error(`Không thể tải video từ URL cho scene ${scene.id} sau 6 lần thử`);
  }

  console.log(`[Scene ${scene.id}] Đã lưu video thành công: ${mp4OutputPath}`);
  return {
    mediaStatus: 'video',
    mediaFile: `media/${filePrefix}.mp4`,
    localPath: mp4OutputPath,
    threadUrl: page.url(),
  };
}

module.exports = { generateSceneMedia };
