const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const USER_AGENT_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const USER_AGENT_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

class DouyinScraper {
  /**
   * Trích xuất link URL từ văn bản người dùng nhập
   */
  static extractUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : null;
  }

  /**
   * Theo dõi chuyển hướng (Redirects) để lấy URL thực tế và Item ID
   */
  static async resolveRedirect(shareUrl) {
    let currentUrl = shareUrl;
    let hops = 0;
    while (hops < 5) {
      const resp = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT_MOBILE,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) break;
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        hops++;
      } else {
        break;
      }
    }
    return currentUrl;
  }

  /**
   * Trích xuất video ID từ URL đã resolve
   */
  static extractVideoId(resolvedUrl) {
    const match = resolvedUrl.match(/\/(?:video|note)\/(\d+)/i) ||
                  resolvedUrl.match(/modal_id=(\d+)/i) ||
                  resolvedUrl.match(/(\d{18,20})/);
    return match ? match[1] : null;
  }

  /**
   * Tự động đăng ký mã TTWID từ ByteDance để vượt qua rào cản captcha/cookie của Douyin
   */
  static async getTtwidCookie() {
    try {
      const regRes = await fetch('https://ttwid.bytedance.com/ttwid/union/register/', {
        method: 'POST',
        body: JSON.stringify({
          region: 'cn',
          aid: 1768,
          needFid: false,
          service: 'www.ixigua.com',
          migrate_info: { ticket: '', source: 'node' }
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const cookieHeader = regRes.headers.get('set-cookie');
      if (cookieHeader) {
        return cookieHeader.split(';')[0];
      }
    } catch (e) {
      console.warn('[Scraper] Lỗi sinh TTWID:', e.message);
    }
    return '';
  }

  /**
   * Phương thức 1: Phân giải trực tiếp qua Douyin Detail API với TTWID
   */
  static async fetchFromDirectDouyin(videoId) {
    try {
      const ttwid = await this.getTtwidCookie();
      const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}`;
      
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': USER_AGENT_DESKTOP,
          'Referer': 'https://www.douyin.com/',
          'Cookie': ttwid
        }
      });
      
      console.log('[Scraper] Douyin API status:', res.status);
      if (!res.ok) return null;
      const data = await res.json();
      console.log('[Scraper] Douyin API response keys:', Object.keys(data), 'status_code:', data.status_code);
      
      if (data && data.aweme_detail) {
        const item = data.aweme_detail;
        const playUrlRaw = item.video?.play_addr?.url_list?.[0] || '';
        const cleanPlayUrl = playUrlRaw.replace('playwm', 'play');
        const cover = item.video?.cover?.url_list?.[0] || '';
        const title = item.desc || `douyin_video_${videoId}`;
        const author = item.author?.nickname || 'Douyin Creator';
        const duration = item.duration ? Math.round(item.duration / 1000) : null;

        return {
          id: videoId,
          title,
          author,
          cover,
          duration,
          videoUrl: cleanPlayUrl,
          source: 'douyin-aweme-detail'
        };
      }
    } catch (e) {
      console.warn('Direct Douyin Detail API failed:', e.message);
    }
    return null;
  }

  /**
   * Phương thức 2: Phân giải qua TikWM Gateway (Hỗ trợ cả Douyin & TikTok, không logo cực kỳ ổn định)
   */
  static async fetchFromTikWM(originalUrl) {
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(originalUrl)}&hd=1`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': USER_AGENT_DESKTOP,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.code === 0 && json.data) {
        const d = json.data;
        const videoUrl = d.hdplay || d.play || d.wmplay;
        return {
          id: d.id || Date.now().toString(),
          title: d.title || 'Video Douyin',
          author: d.author?.nickname || d.author?.unique_id || 'Douyin Creator',
          cover: d.cover,
          duration: d.duration,
          videoUrl: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`,
          source: 'tikwm-gateway'
        };
      }
    } catch (e) {
      console.warn('TikWM Gateway failed:', e.message);
    }
    return null;
  }

  /**
   * Lấy thông tin video đầy đủ kèm videoUrl tải không watermark
   */
  static async getVideoInfo(rawInput) {
    const url = this.extractUrl(rawInput);
    if (!url) {
      throw new Error('Không tìm thấy link Douyin hợp lệ trong nội dung bạn nhập.');
    }

    console.log(`[Scraper] Bắt đầu phân giải link: ${url}`);
    const resolvedUrl = await this.resolveRedirect(url);
    console.log(`[Scraper] URL sau chuyển hướng: ${resolvedUrl}`);
    const videoId = this.extractVideoId(resolvedUrl);

    let info = null;
    if (videoId) {
      console.log(`[Scraper] Tìm thấy Video ID: ${videoId}, thử tải trực tiếp...`);
      info = await this.fetchFromDirectDouyin(videoId);
    }

    if (!info || !info.videoUrl) {
      console.log(`[Scraper] Thử qua Gateway phân giải không logo...`);
      info = await this.fetchFromTikWM(url);
    }

    if (!info || !info.videoUrl) {
      throw new Error('Không thể bóc tách link tải video không watermark từ link này. Douyin có thể đang yêu cầu captcha hoặc link là video riêng tư.');
    }

    return info;
  }

  /**
   * Tải file video MP4 về đĩa local
   */
  static async downloadVideo(videoUrl, destPath, onProgress) {
    const file = fs.createWriteStream(destPath);
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        headers: {
          'User-Agent': USER_AGENT_MOBILE,
          'Referer': 'https://www.douyin.com/'
        }
      };

      const getter = videoUrl.startsWith('https') ? https : http;

      const handleResponse = (response) => {
        // Nếu có chuyển hướng tiếp tục
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location.startsWith('http')
            ? response.headers.location
            : new URL(response.headers.location, videoUrl).href;
          return getter.get(redirectUrl, requestOptions, handleResponse).on('error', reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Tải video thất bại với HTTP status: ${response.statusCode}`));
        }

        const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            onProgress(percent, downloadedBytes, totalBytes);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      };

      getter.get(videoUrl, requestOptions, handleResponse).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
}

module.exports = DouyinScraper;
