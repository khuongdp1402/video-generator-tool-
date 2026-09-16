// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');

async function generateSceneMedia(page, scene, mediaDir) {
  fs.mkdirSync(mediaDir, { recursive: true });

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 20000 });

  // Count existing videos BEFORE submitting prompt so we NEVER grab an old video
  const initialVideoCount = await page.locator('video').count();

  console.log(`[Scene ${scene.id}] Gửi video prompt (số video hiện tại: ${initialVideoCount})...`);
  await promptInput.first().fill(scene.videoPrompt);
  await promptInput.first().press('Enter');

  console.log(`[Scene ${scene.id}] Đang chờ Gemini sinh video mới (Veo)...`);
  const startTime = Date.now();
  const timeoutMs = 360000; // 6 minutes max per scene
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
    throw new Error(`Hết thời gian chờ (timeout 6 phút) sinh video mới cho scene ${scene.id}`);
  }

  const outputPath = path.join(mediaDir, `scene_${scene.id}.mp4`);

  try {
    const res = await page.request.get(videoSrc);
    const buffer = await res.body();
    fs.writeFileSync(outputPath, buffer);
  } catch (_reqErr) {
    const buffer = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      const ab = await blob.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    }, videoSrc);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  }

  console.log(`[Scene ${scene.id}] Đã lưu video thành công: ${outputPath}`);
  return { mediaStatus: 'video', mediaFile: `media/scene_${scene.id}.mp4` };
}

module.exports = { generateSceneMedia };
