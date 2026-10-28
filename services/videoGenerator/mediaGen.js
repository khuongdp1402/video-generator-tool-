// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');

/**
 * Generates video media for a scene via Gemini Ultra Web (Veo).
 * Supports attaching up to 8 reference images (character/scene/continuity frames)
 * before sending the videoPrompt.
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

  // Count existing videos BEFORE submitting prompt so we NEVER grab an old video
  const initialVideoCount = await page.locator('video').count();

  console.log(`[Scene ${scene.id}] Gửi video prompt (số video hiện tại: ${initialVideoCount}, ảnh tham chiếu: ${refs.length})...`);
  await promptInput.first().fill(scene.videoPrompt);
  await promptInput.first().press('Enter');

  console.log(`[Scene ${scene.id}] Đang chờ Gemini sinh video mới (Veo)...`);
  const startTime = Date.now();
  const timeoutMs = (opts.timeoutMinutes ? Number(opts.timeoutMinutes) * 60 * 1000 : 360000);
  let videoSrc = null;

  while (Date.now() - startTime < timeoutMs) {
    const currentCount = await page.locator('video').count();
    if (currentCount > initialVideoCount) {
      const candidate = page.locator('video').last();
      const src = await candidate.getAttribute('src');
      if (src && src.startsWith('http')) {
        videoSrc = src;
        break;
      }
    }
    // Chờ 3 giây mỗi vòng poll
    await page.waitForTimeout(3000);
  }

  if (!videoSrc) {
    throw new Error(`Hết thời gian chờ sinh video mới cho scene ${scene.id}`);
  }

  const filePrefix = opts.projectId ? `${opts.projectId}_scene_${scene.id}` : `scene_${scene.id}`;
  const fileName = `${filePrefix}.mp4`;
  const outputPath = path.join(mediaDir, fileName);

  let downloaded = false;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await page.request.get(videoSrc);
      if (res.ok()) {
        const buffer = await res.body();
        fs.writeFileSync(outputPath, buffer);
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

  console.log(`[Scene ${scene.id}] Đã lưu video thành công: ${outputPath}`);
  return {
    mediaStatus: 'video',
    mediaFile: `media/${fileName}`,
    localPath: outputPath,
    threadUrl: page.url(),
  };
}

module.exports = { generateSceneMedia };
