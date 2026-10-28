// services/videoGenerator/geminiChat.js
const DEFAULT_CDP_URL = 'http://localhost:9222';
const GEMINI_URL = 'https://gemini.google.com/app';

async function connectToGeminiPage(cdpUrl = DEFAULT_CDP_URL, timeout = 2500) {
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout });
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('Không tìm thấy Chrome context nào. Hãy mở Chrome với --remote-debugging-port=9222.');
  }
  let page = context.pages().find((p) => p.url().includes('gemini.google.com'));
  if (!page) {
    page = await context.newPage();
    await page.goto(GEMINI_URL, { waitUntil: 'networkidle' });
  }
  return { browser, page };
}

async function sendPromptAndWaitForStableReply(page, promptText, opts = {}) {
  const { timeoutMs = 180000, pollMs = 2000, stableChecks = 2 } = opts;

  const promptInput = page.locator(
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt"], [role="textbox"]'
  );
  await promptInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await promptInput.first().fill(promptText);
  await promptInput.first().press('Enter');

  const replySelector = 'message-content, .model-response-text, .markdown';
  const reply = page.locator(replySelector).last();
  await reply.waitFor({ state: 'visible', timeout: timeoutMs });

  const start = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    const currentText = (await reply.innerText().catch(() => '')).trim();
    if (currentText && currentText === lastText) {
      stableCount += 1;
      if (stableCount >= stableChecks) {
        return currentText;
      }
    } else {
      stableCount = 0;
    }
    lastText = currentText;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for a stable reply from Gemini`);
}

module.exports = { connectToGeminiPage, sendPromptAndWaitForStableReply, GEMINI_URL, DEFAULT_CDP_URL };
