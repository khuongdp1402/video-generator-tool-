/**
 * Kế Hoạch & Mã Mẫu Tự Động Đăng Video Lên TikTok & YouTube Shorts
 */

const PUBLISHER_STRATEGY = {
  youtube: {
    name: "YouTube Shorts",
    method: "YouTube Data API v3 (Chính thức, không lo bị checkpoint)",
    auth: "Google OAuth2 (Client ID, Client Secret, Refresh Token)",
    goldenHours: ["11:30", "14:00", "19:45"],
    dailyLimit: "3 - 5 video / ngày",
    metadataRules: {
      titleSuffix: " #Shorts #viral #reels",
      category: "22 (People & Blogs) hoặc 24 (Entertainment)",
      madeForKids: false
    }
  },
  tiktok: {
    name: "TikTok",
    method: "Playwright Headless Browser Automation (Creator Center)",
    auth: "Persistent Browser Session / Cookie Profile",
    goldenHours: ["07:30", "12:15", "18:30", "21:00"],
    dailyLimit: "2 - 4 video / ngày (cách nhau tối thiểu 2.5 tiếng)",
    antiShadowbanRules: [
      "Sử dụng IP/Proxy dân cư (Residential) nếu reup kênh nước ngoài",
      "Không đăng quá dồn dập trong 1 giờ",
      "Đổi nhạc nền thịnh hành (Trending Sound) trên TikTok Creator Studio để tăng tương tác",
      "Chỉnh sửa Remake (Mirror, Zoom, Hash MD5) trước khi upload"
    ]
  }
};

/**
 * Đoạn mã script tự động hóa mẫu cho Playwright (TikTok)
 */
const TIKTOK_PLAYWRIGHT_SNIPPET = `
const { chromium } = require('playwright');
const path = require('path');

async function uploadToTikTok(videoFilePath, caption) {
  // Sử dụng profile lưu sẵn để không phải đăng nhập lại mỗi lần
  const userDataDir = path.resolve(__dirname, '../tiktok_browser_profile');
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Để xem tiến trình hoặc đổi sang true khi chạy ổn
    viewport: { width: 1280, height: 800 }
  });

  const page = await browserContext.newPage();
  console.log('Đang truy cập TikTok Creator Center...');
  await page.goto('https://www.tiktok.com/creator-center/upload?from=upload');

  // Chờ input file xuất hiện
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
  await fileInput.setInputFiles(videoFilePath);
  console.log('Đã đưa file video vào trình upload...');

  // Chờ video upload và điền caption
  await page.waitForTimeout(5000);
  const captionEditor = await page.waitForSelector('div[contenteditable="true"]');
  await captionEditor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(caption);

  // Nhấn nút Post sau khi video xử lý xong
  const postBtn = await page.waitForSelector('button:has-text("Post"), button:has-text("Đăng")', { timeout: 60000 });
  await postBtn.click();
  console.log('Đã nhấn nút đăng video lên TikTok thành công!');
  await page.waitForTimeout(5000);
  await browserContext.close();
}
`;

/**
 * Đoạn mã script mẫu cho YouTube Shorts qua Google API
 */
const YOUTUBE_API_SNIPPET = `
const { google } = require('googleapis');
const fs = require('fs');

async function uploadToYouTubeShorts(authClient, videoFilePath, title, description, publishAtTime) {
  const youtube = google.youtube({ version: 'v3', auth: authClient });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title.includes('#Shorts') ? title : \`\${title} #Shorts\`,
        description: description,
        tags: ['shorts', 'trending', 'douyin'],
        categoryId: '24'
      },
      status: {
        privacyStatus: publishAtTime ? 'private' : 'public',
        publishAt: publishAtTime || undefined, // Hẹn giờ đăng nếu có
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoFilePath)
    }
  });

  console.log('Đăng YouTube Shorts thành công, Video ID:', res.data.id);
  return res.data;
}
`;

module.exports = {
  PUBLISHER_STRATEGY,
  TIKTOK_PLAYWRIGHT_SNIPPET,
  YOUTUBE_API_SNIPPET
};
