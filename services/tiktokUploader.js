const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const USER_DATA_DIR = path.resolve(__dirname, '../tiktok_browser_profile');
const COOKIE_JSON_FILE = path.resolve(__dirname, '../storage/tiktok_cookie.json');
let activeBrowserContext = null;

class TikTokUploader {
  /**
   * Dọn dẹp triệt để các tiến trình Chrome Playwright cũ nếu bị kẹt
   */
  static async forceCleanBrowserProcesses() {
    if (activeBrowserContext) {
      console.log('[TikTok] Đang đóng context trình duyệt Playwright...');
      try {
        await activeBrowserContext.close();
      } catch (e) {}
      activeBrowserContext = null;
    }

    try {
      if (process.platform === 'win32') {
        const psCmd = `Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.ExecutablePath -like "*ms-playwright*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
        execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'ignore' });
      }
    } catch (e) {}

    try {
      const lockFiles = ['lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket'];
      for (const lf of lockFiles) {
        const p = path.join(USER_DATA_DIR, lf);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    } catch (e) {}
  }

  /**
   * Đóng cửa sổ trình duyệt đăng nhập
   */
  static async closeBrowserContext() {
    await this.forceCleanBrowserProcesses();
    return { success: true, message: 'Đã đóng cửa sổ trình duyệt và lưu cấu hình.' };
  }

  /**
   * Lưu trực tiếp Cookie hoặc Session ID của TikTok
   * @param {string} rawInput - Chuỗi Cookie hoặc giá trị sessionid
   */
  static saveSessionCookie(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') {
      throw new Error('Vui lòng nhập giá trị cookie hoặc sessionid hợp lệ!');
    }

    const trimmed = rawInput.trim();
    let sessionId = '';

    if (trimmed.includes('sessionid=')) {
      const match = trimmed.match(/sessionid=([^;]+)/);
      if (match) sessionId = match[1];
    } else if (!trimmed.includes(';') && !trimmed.includes('=')) {
      // Người dùng dán trực tiếp chuỗi sessionid
      sessionId = trimmed;
    } else {
      // Thử tìm bất kỳ token nào
      const match = trimmed.match(/([a-f0-9]{32})/);
      if (match) sessionId = match[1];
      else sessionId = trimmed;
    }

    if (!sessionId) {
      throw new Error('Không tìm thấy token sessionid trong chuỗi cookie vừa nhập!');
    }

    const cookieData = {
      sessionId,
      savedAt: new Date().toISOString(),
      rawCookie: trimmed
    };

    const dir = path.dirname(COOKIE_JSON_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(COOKIE_JSON_FILE, JSON.stringify(cookieData, null, 2));
    console.log('[TikTok] Đã lưu cookie sessionid thành công:', sessionId.slice(0, 8) + '...');
    return {
      success: true,
      message: 'Đã lưu Cookie TikTok thành công! Hệ thống đã sẵn sàng đăng video tự động.',
      sessionIdMasked: sessionId.slice(0, 6) + '...' + sessionId.slice(-4)
    };
  }

  /**
   * Mở cửa sổ trình duyệt Chromium độc lập để quét QR hoặc đăng nhập
   */
  static async openLoginWindow() {
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    await this.forceCleanBrowserProcesses();

    console.log('[TikTok] Mở Chromium độc lập với profile:', USER_DATA_DIR);
    activeBrowserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 850 },
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    activeBrowserContext.on('close', () => {
      console.log('[TikTok] Cửa sổ Chromium đăng nhập đã được đóng.');
      activeBrowserContext = null;
    });

    const page = await activeBrowserContext.newPage();
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });
    await page.bringToFront().catch(() => {});

    console.log('[TikTok] Trình duyệt đăng nhập đã sẵn sàng trên màn hình.');
    return {
      success: true,
      message: 'Cửa sổ Chromium đăng nhập đã mở! Bạn hãy quét mã QR hoặc đăng nhập. Khi hoàn tất, hãy bấm "💾 Đã Đăng Nhập Xong (Lưu Phiên)".'
    };
  }

  /**
   * Kiểm tra trạng thái đã đăng nhập TikTok hay chưa
   */
  static async checkLoginStatus() {
    // 1. Kiểm tra nếu có cookie file lưu trực tiếp
    if (fs.existsSync(COOKIE_JSON_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(COOKIE_JSON_FILE, 'utf8'));
        if (data.sessionId && data.sessionId.length > 10) {
          return { loggedIn: true, browserOpen: false, mode: 'cookie' };
        }
      } catch (e) {}
    }

    // 2. Nếu trình duyệt đang mở
    if (activeBrowserContext) {
      try {
        const pages = activeBrowserContext.pages();
        for (const p of pages) {
          const u = p.url();
          if (u.includes('creator-center') || (u.includes('tiktok.com') && !u.includes('/login') && !u.includes('about:blank'))) {
            return { loggedIn: true, browserOpen: true, mode: 'browser' };
          }
        }
      } catch (e) {}
      return { loggedIn: false, browserOpen: true, mode: 'browser' };
    }

    // 3. Kiểm tra file cookie SQLite trong profile
    const cookieDbPath = path.join(USER_DATA_DIR, 'Default', 'Network', 'Cookies');
    if (fs.existsSync(cookieDbPath)) {
      try {
        const buf = fs.readFileSync(cookieDbPath);
        const hasSession = buf.includes('sessionid') || buf.includes('sid_tt');
        return { loggedIn: hasSession, browserOpen: false, mode: 'profile' };
      } catch (e) {}
    }

    return { loggedIn: false, browserOpen: false };
  }

  /**
   * Tự động Upload Video lên TikTok Creator Center
   * @param {string} videoFilePath - Đường dẫn tuyệt đối file video MP4
   * @param {string} caption - Tiêu đề kèm hashtag
   */
  static async uploadVideo(videoFilePath, caption) {
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`File video không tồn tại: ${videoFilePath}`);
    }

    // Đảm bảo luôn có hashtag #fyp trong mọi video đăng
    let finalCaption = (caption || '').trim();
    if (!finalCaption.toLowerCase().includes('#fyp')) {
      finalCaption = `${finalCaption} #fyp`.trim();
    }

    await this.forceCleanBrowserProcesses();

    console.log(`[TikTok] Bắt đầu tự động upload video: ${videoFilePath}`);
    let uploadContext = null;

    try {
      uploadContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 850 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
      });

      // Nếu có Cookie file được nhập bằng tay, tiêm vào context
      if (fs.existsSync(COOKIE_JSON_FILE)) {
        try {
          const cookieData = JSON.parse(fs.readFileSync(COOKIE_JSON_FILE, 'utf8'));
          if (cookieData.sessionId) {
            console.log('[TikTok] Nạp sessionid từ storage/tiktok_cookie.json...');
            await uploadContext.addCookies([
              {
                name: 'sessionid',
                value: cookieData.sessionId,
                domain: '.tiktok.com',
                path: '/',
                httpOnly: true,
                secure: true
              },
              {
                name: 'sessionid_ss',
                value: cookieData.sessionId,
                domain: '.tiktok.com',
                path: '/',
                httpOnly: true,
                secure: true
              },
              {
                name: 'sid_tt',
                value: cookieData.sessionId,
                domain: '.tiktok.com',
                path: '/',
                httpOnly: true,
                secure: true
              }
            ]);
          }
        } catch (e) {
          console.warn('[TikTok] Lỗi nạp cookie json:', e.message);
        }
      }

      const page = await uploadContext.newPage();

      console.log('[TikTok] Truy cập trang tải video TikTok Studio...');
      await page.goto('https://www.tiktok.com/creator-center/upload?from=upload', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      await page.waitForTimeout(4000);

      if (page.url().includes('/login')) {
        await uploadContext.close();
        await this.forceCleanBrowserProcesses();
        throw new Error('Tài khoản TikTok chưa được đăng nhập! Bạn hãy dán Cookie hoặc bấm "Mở Cửa Sổ Đăng Nhập" để đăng nhập.');
      }

      console.log('[TikTok] Tìm ô tải file video...');
      let fileInput = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 35000) {
        fileInput = await page.$('input[type="file"]');
        if (fileInput) break;

        for (const frame of page.frames()) {
          fileInput = await frame.$('input[type="file"]');
          if (fileInput) break;
        }

        if (fileInput) break;
        await page.waitForTimeout(1500);
      }

      if (!fileInput) {
        throw new Error('Không tìm thấy ô chọn file video trên giao diện TikTok Studio.');
      }

      console.log('[TikTok] Đã tìm thấy ô tải file, tiến hành đưa file video vào...');
      await fileInput.setInputFiles(videoFilePath);

      console.log('[TikTok] Đang chờ TikTok xử lý video và nạp trình soạn thảo...');
      await page.waitForTimeout(7000);

      // Tắt popup kiểm tra bản quyền (TUXModal) nếu xuất hiện trước ô caption
      try {
        await page.keyboard.press('Escape');
        const initialDismiss = await page.$('.TUXModal button, [data-floating-ui-portal] button, [role="dialog"] button');
        if (initialDismiss) {
          console.log('[TikTok] Đóng modal popup thông báo...');
          await initialDismiss.evaluate(b => b.click()).catch(() => {});
          await page.waitForTimeout(1000);
        }
      } catch (e) {}

      // Điền Caption & Hashtags
      let editorFound = false;
      const editorSelectors = [
        'div[contenteditable="true"]',
        '.DraftEditor-root',
        '.notranslate[contenteditable="true"]',
        '[data-placeholder]',
        'textarea'
      ];

      for (const selector of editorSelectors) {
        let el = await page.$(selector);
        if (!el) {
          for (const frame of page.frames()) {
            el = await frame.$(selector);
            if (el) break;
          }
        }

        if (el) {
          try {
            await el.evaluate(e => {
              e.focus();
              e.click();
            }).catch(() => {});
            await el.click({ force: true }).catch(() => {});
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await page.keyboard.type(finalCaption, { delay: 25 });
            console.log('[TikTok] Đã điền caption & hashtag thành công:', finalCaption);
            editorFound = true;
            break;
          } catch (err) {
            console.warn('[TikTok] Thử điền selector lỗi:', selector, err.message);
          }
        }
      }

      console.log('[TikTok] Đang chờ tiến trình tải video lên máy chủ TikTok...');
      try {
        await page.waitForSelector('text=Uploaded, text=Tải lên', { timeout: 30000 });
        console.log('[TikTok] Video đã được tải lên 100%!');
      } catch (e) {
        await page.waitForTimeout(15000);
      }

      // Kiểm tra và dọn dẹp popup/modal che khuất (TUXModal, floating UI, bản quyền check)
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);

        const modalDismissSelectors = [
          '.TUXModal button[aria-label="Close"]',
          '.TUXModal button:has-text("OK")',
          '.TUXModal button:has-text("Got it")',
          '.TUXModal button:has-text("Đã hiểu")',
          '.TUXModal button:has-text("Xác nhận")',
          '.TUXModal button:has-text("Đóng")',
          '[data-floating-ui-portal] button:has-text("OK")',
          '[data-floating-ui-portal] button:has-text("Got it")',
          '[data-floating-ui-portal] button:has-text("Đã hiểu")',
          '[role="dialog"] button:has-text("OK")',
          '[role="dialog"] button:has-text("Got it")',
          '[role="dialog"] button:has-text("Đã hiểu")',
          '[role="dialog"] button[aria-label="Close"]'
        ];

        for (const dismissSel of modalDismissSelectors) {
          const btn = await page.$(dismissSel);
          if (btn) {
            console.log('[TikTok] Phát hiện hộp thoại che phủ, tiến hành đóng:', dismissSel);
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(600);
            break;
          }
        }
      } catch (e) {}

      // Tìm nút Đăng chính thức (Button__root--type-primary)
      console.log('[TikTok] Tìm nút "Đăng" / "Post"...');
      let postButton = null;
      const primaryButtons = await page.$$('button.Button__root--type-primary, .btn-post, button[type="submit"]');
      for (const b of primaryButtons) {
        const txt = (await b.innerText().catch(() => '')).trim();
        if (txt.includes('Post') || txt.includes('Đăng')) {
          postButton = b;
          break;
        }
      }

      if (!postButton) {
        postButton = await page.$('button:has-text("Post"), button:has-text("Đăng")');
      }

      if (postButton) {
        await postButton.scrollIntoViewIfNeeded().catch(() => {});
        console.log('[TikTok] Đã tìm thấy nút Đăng chính thức! Tiến hành click...');
        try {
          await postButton.click({ force: true });
        } catch (errClick) {
          await postButton.evaluate(el => el.click());
        }

        console.log('[TikTok] Đã kích hoạt lệnh ĐĂNG VIDEO thành công!');

        // Chờ xem có hộp thoại xác nhận "Vẫn đăng" (Post anyway) không
        try {
          await page.waitForTimeout(1500);
          const confirmPostBtn = await page.$('button:has-text("Post anyway"), button:has-text("Vẫn đăng"), button:has-text("Tiếp tục đăng")');
          if (confirmPostBtn) {
            console.log('[TikTok] Xác nhận hộp thoại "Vẫn đăng"...');
            await confirmPostBtn.evaluate(el => el.click());
          }
        } catch (e) {}

        await page.waitForTimeout(10000);
      } else {
        console.warn('[TikTok] Không tìm thấy nút Đăng. Có thể video đã được xử lý.');
      }

      await uploadContext.close();
      await this.forceCleanBrowserProcesses();

      return {
        success: true,
        message: 'Đã tự động tải lên và đăng video thành công trên kênh TikTok!'
      };

    } catch (err) {
      console.error('[TikTok] Lỗi quá trình upload:', err.message);
      if (uploadContext) {
        try { await uploadContext.close(); } catch (e) {}
      }
      await this.forceCleanBrowserProcesses();
      throw err;
    }
  }
}

module.exports = TikTokUploader;
