// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');
const { resolveGenerationMode, enforceSceneGoalAlignment } = require('./director');
const { extractVideoMotionFrames } = require('./continuity');

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

async function getKnownGeminiVideoSrcs(page) {
  if (typeof page.evaluate !== 'function') return [];
  return page
    .evaluate(() =>
      Array.from(document.querySelectorAll('video'))
        .map((v) => v.currentSrc || v.src || '')
        .filter(Boolean)
    )
    .catch(() => []);
}

async function attachFilesOnGemini(page, filePaths = []) {
  const validFiles = (filePaths || []).filter((p) => p && fs.existsSync(p)).slice(0, 8);
  if (validFiles.length === 0) return 0;

  try {
    const fileInputs = page.locator('input[type="file"]');
    if ((await fileInputs.count()) > 0) {
      await fileInputs.first().setInputFiles(validFiles);
      await page.waitForTimeout(1600);
      return validFiles.length;
    }

    // Mở menu "Nội dung tải lên và công cụ" -> "Tệp" để kích hoạt filechooser của Gemini
    const toolsBtn = page
      .locator('button[aria-label="Nội dung tải lên và công cụ"], button[aria-label*="Upload"], button[aria-label*="Tools"]')
      .first();
    if ((await toolsBtn.count()) > 0) {
      await toolsBtn.click();
      await page.waitForTimeout(600);
      const fileItem = page
        .locator('button[aria-label^="Tệp"], [role="menuitem"]:has-text("Tệp"), button:has-text("Upload files")')
        .first();
      if ((await fileItem.count()) > 0) {
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 6000 }),
          fileItem.click(),
        ]);
        await chooser.setFiles(validFiles);
        await page.waitForTimeout(2000);
        return validFiles.length;
      }
      await page.keyboard.press('Escape').catch(() => {});
    }
  } catch (err) {
    console.warn(`[Gemini Ultra] Không thể đính kèm file tham chiếu: ${err.message}`);
  }
  return 0;
}

async function downloadNewestGeminiVeoVideo(page, knownVideoSrcs, mp4OutputPath, timeoutMs = 150000) {
  const start = Date.now();
  const prevSet = new Set(knownVideoSrcs || []);
  let foundSrc = null;

  while (Date.now() - start < timeoutMs) {
    const srcs = await getKnownGeminiVideoSrcs(page);
    const newest = srcs.find((s) => !prevSet.has(s));
    if (newest) {
      foundSrc = newest;
      break;
    }
    await page.waitForTimeout(2500);
  }

  if (!foundSrc) {
    throw new Error('Hết thời gian chờ Gemini Ultra (Veo) sinh video MP4');
  }

  // Ưu tiên 1: Nút "Tải video xuống" chính thức của Gemini Ultra (tải MP4 gốc 100%)
  try {
    const dlBtn = page
      .locator('button[aria-label="Tải video xuống"], button[aria-label*="Download video"]')
      .last();
    if ((await dlBtn.count()) > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        dlBtn.click(),
      ]);
      await download.saveAs(mp4OutputPath);
      if (fs.existsSync(mp4OutputPath) && fs.statSync(mp4OutputPath).size > 5000) {
        return mp4OutputPath;
      }
    }
  } catch (dlErr) {
    console.warn(`[Gemini Ultra] Nút Tải video xuống chưa phản hồi (${dlErr.message}), tải trực tiếp qua URL...`);
  }

  // Ưu tiên 2: Tải trực tiếp qua HTTP session của trình duyệt
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await page.request.get(foundSrc);
      if (res.ok()) {
        const buffer = await res.body();
        if (buffer && buffer.length > 5000) {
          fs.writeFileSync(mp4OutputPath, buffer);
          return mp4OutputPath;
        }
      }
    } catch (_e) {}
    await page.waitForTimeout(2500);
  }

  throw new Error('Không thể tải file MP4 từ Gemini Ultra Veo');
}

/**
 * Generates visual media via Gemini Ultra Web (dophukhuong1234@gmail.com)
 * supporting all 4 modes: image_to_video, text_to_video, video_to_video, image_stitch.
 */
async function generateSceneMedia(page, scene, mediaDir, opts = {}) {
  fs.mkdirSync(mediaDir, { recursive: true });

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 20000 });

  const filePrefix = opts.projectId ? `${opts.projectId}_scene_${scene.id}` : `scene_${scene.id}`;
  const pngOutputPath = path.join(mediaDir, `${filePrefix}.png`);
  const mp4OutputPath = path.join(mediaDir, `${filePrefix}.mp4`);

  const generationMode = resolveGenerationMode(
    opts.generationMode || scene.generationMode,
    'image_to_video'
  );
  const aspectRatio = opts.aspectRatio || scene.aspectRatio || '9:16';
  const ratioSpec =
    aspectRatio === '16:9'
      ? 'horizontal 16:9 widescreen full-screen single-layer'
      : 'vertical 9:16 portrait full-screen single-layer (NO split-screen, NO blurred bars)';

  const aligned = enforceSceneGoalAlignment(scene, {
    ...opts,
    generationMode,
    aspectRatio,
  });

  // 1. Chế độ Tạo Ảnh AI (text_to_image) hoặc Image Stitch (Chỉ tạo ảnh minh họa toàn màn hình)
  if (generationMode === 'text_to_image' || generationMode === 'image_stitch') {
    await attachFilesOnGemini(page, opts.refs || scene.refs || []);
    const knownImgs = await getKnownGeminiLargeImageSrcs(page);
    await promptInput.first().fill(`Generate a high-resolution ${ratioSpec} illustration image: ${aligned.alignedImagePrompt}`);
    await promptInput.first().press('Enter');

    const start = Date.now();
    const timeoutMs = opts.timeoutMs || 55000;
    while (Date.now() - start < timeoutMs) {
      const pngB64 = await extractNewestGeminiImagePng(page, knownImgs);
      if (pngB64) {
        const buf = Buffer.from(pngB64, 'base64');
        if (buf.length > 2000) {
          fs.writeFileSync(pngOutputPath, buf);
          return {
            mediaStatus: 'image',
            generationMode,
            mediaFile: `media/${filePrefix}.png`,
            localPath: pngOutputPath,
            threadUrl: page.url(),
          };
        }
      }
      await page.waitForTimeout(2000);
    }
    throw new Error(`Hết thời gian chờ Gemini Ultra tạo ảnh cho scene ${scene.id}`);
  }

  // 2. Chế độ Image-to-Video (Tạo Keyframe trên Imagen 3 hoặc lấy ảnh mẫu -> biến thành Video chuyển động Veo ngay trong cùng hội thoại!)
  if (generationMode === 'image_to_video') {
    const explicitKeyframe =
      (opts.keyframePath && fs.existsSync(opts.keyframePath) && opts.keyframePath) ||
      (scene.keyframePath && fs.existsSync(scene.keyframePath) && scene.keyframePath) ||
      null;
    const refs = [
      ...(explicitKeyframe ? [explicitKeyframe] : []),
      ...((opts.refs || scene.refs || []).filter((p) => p && p !== explicitKeyframe && fs.existsSync(p))),
    ];
    if (refs.length > 0) {
      await attachFilesOnGemini(page, refs);
    } else if (!fs.existsSync(pngOutputPath)) {
      const knownImgs = await getKnownGeminiLargeImageSrcs(page);
      await promptInput.first().fill(`Generate a ${ratioSpec} keyframe image: ${aligned.alignedImagePrompt}`);
      await promptInput.first().press('Enter');
      const startImg = Date.now();
      while (Date.now() - startImg < 50000) {
        const pngB64 = await extractNewestGeminiImagePng(page, knownImgs);
        if (pngB64) {
          const buf = Buffer.from(pngB64, 'base64');
          if (buf.length > 2000) {
            fs.writeFileSync(pngOutputPath, buf);
            break;
          }
        }
        await page.waitForTimeout(2000);
      }
    }

    const knownVideos = await getKnownGeminiVideoSrcs(page);
    await promptInput
      .first()
      .fill(`Create a ${ratioSpec} animated video clip from that exact scene and character: ${aligned.alignedVideoPrompt}`);
    await promptInput.first().press('Enter');

    try {
      await downloadNewestGeminiVeoVideo(page, knownVideos, mp4OutputPath, opts.videoTimeoutMs || 150000);
      return {
        mediaStatus: 'video',
        generationMode: 'image_to_video',
        mediaFile: `media/${filePrefix}.mp4`,
        keyframeFile: fs.existsSync(pngOutputPath) ? `media/${filePrefix}.png` : '',
        localPath: mp4OutputPath,
        threadUrl: page.url(),
      };
    } catch (veoErr) {
      if (fs.existsSync(pngOutputPath) && opts.allowKeyframeFallback !== false) {
        return {
          mediaStatus: 'image',
          generationMode: 'image_to_video',
          mediaFile: `media/${filePrefix}.png`,
          localPath: pngOutputPath,
          threadUrl: page.url(),
        };
      }
      throw veoErr;
    }
  }

  // 3. Chế độ Video-to-Video (Trích xuất motion frames từ video mẫu -> tái tạo bằng Veo)
  if (generationMode === 'video_to_video') {
    const sourceVideo = scene.sourceVideoPath || opts.sourceVideoPath || opts.continuityVideoPath || '';
    let motionRefs = [];
    if (sourceVideo && fs.existsSync(sourceVideo)) {
      try {
        motionRefs = await extractVideoMotionFrames(sourceVideo, `${filePrefix}_gem`);
      } catch (_e) {}
    }
    await attachFilesOnGemini(page, [...motionRefs, ...(opts.refs || scene.refs || [])]);
    const knownVideos = await getKnownGeminiVideoSrcs(page);
    await promptInput
      .first()
      .fill(`Create a ${ratioSpec} video transformation clip matching these reference frames and target style: ${aligned.alignedVideoPrompt}`);
    await promptInput.first().press('Enter');
    await downloadNewestGeminiVeoVideo(page, knownVideos, mp4OutputPath, opts.videoTimeoutMs || 150000);
    return {
      mediaStatus: 'video',
      generationMode: 'video_to_video',
      mediaFile: `media/${filePrefix}.mp4`,
      localPath: mp4OutputPath,
      threadUrl: page.url(),
    };
  }

  // 4. Chế độ Text-to-Video (Tạo trực tiếp Video MP4 bằng Gemini Ultra Veo)
  await attachFilesOnGemini(page, opts.refs || scene.refs || []);
  const knownVideos = await getKnownGeminiVideoSrcs(page);
  await promptInput
    .first()
    .fill(`Create a ${ratioSpec} animated video clip: ${aligned.alignedVideoPrompt}`);
  await promptInput.first().press('Enter');
  await downloadNewestGeminiVeoVideo(page, knownVideos, mp4OutputPath, opts.videoTimeoutMs || 150000);

  return {
    mediaStatus: 'video',
    generationMode: 'text_to_video',
    mediaFile: `media/${filePrefix}.mp4`,
    localPath: mp4OutputPath,
    threadUrl: page.url(),
  };
}

module.exports = { generateSceneMedia };
