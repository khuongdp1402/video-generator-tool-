// services/videoGenerator/mediaGen.js
const fs = require('fs');
const path = require('path');

async function generateSceneMedia(page, scene, mediaDir) {
  fs.mkdirSync(mediaDir, { recursive: true });

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await promptInput.first().fill(scene.videoPrompt);
  await promptInput.first().press('Enter');

  const videoLocator = page.locator('video').last();
  await videoLocator.waitFor({ state: 'visible', timeout: 300000 }); // Veo generations can take minutes

  const outputPath = path.join(mediaDir, `scene_${scene.id}.mp4`);
  const videoSrc = await videoLocator.getAttribute('src');

  if (videoSrc && videoSrc.startsWith('http')) {
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
  } else {
    const downloadBtn = page
      .locator('button[aria-label*="Tải"], button[aria-label*="Download"], [data-test-id*="download"]')
      .last();
    await downloadBtn.waitFor({ state: 'visible', timeout: 15000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      downloadBtn.click(),
    ]);
    await download.saveAs(outputPath);
  }

  return { mediaStatus: 'video', mediaFile: `media/scene_${scene.id}.mp4` };
}

module.exports = { generateSceneMedia };
