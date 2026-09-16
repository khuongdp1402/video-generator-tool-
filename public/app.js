let videoLibrary = [];
let activeVideoForRemake = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadVideos();
  loadPublisherPlan();
  setupEventListeners();
});

function initTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  const headings = {
    'tab-download': { title: 'Cào Video Douyin Không Logo', sub: 'Nhập link chia sẻ Douyin để phân giải stream video gốc không watermark' },
    'tab-remake': { title: 'Xử Lý Remake Video FFmpeg', sub: 'Lật khung hình, zoom cắt viền, tinh chỉnh màu sắc và đổi mã MD5 để lách thuật toán' },
    'tab-minio': { title: 'Lưu Trữ Video MinIO S3', sub: 'Tự động đẩy video thô và video remake lên Object Storage cá nhân' },
    'tab-publisher': { title: 'Kế Hoạch & Tự Động Đăng Bài', sub: 'Chiến lược lên lịch và mã nguồn tự động hóa cho TikTok và YouTube Shorts' },
    'tab-autopilot': { title: 'Cỗ Máy Tự Động Autopilot 24/7', sub: 'Tự động cào video mới từ các kênh đánh dấu, tự remake lách bản quyền và đăng 2-4 video/ngày' },
    'tab-video-gen': { title: 'Tạo Video AI', sub: 'Nhập kịch bản, chọn style, để Gemini Ultra chia scene, sinh media và render qua Remotion' }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      const content = document.getElementById(target);
      if (content) content.classList.add('active');

      if (headings[target]) {
        document.getElementById('page-heading').innerText = headings[target].title;
        document.getElementById('page-subheading').innerText = headings[target].sub;
      }

      if (target === 'tab-autopilot') {
        loadAutopilotData();
      }
    });
  });
}

function setupEventListeners() {
  document.getElementById('btn-refresh-list').addEventListener('click', loadVideos);
  document.getElementById('btn-start-download').addEventListener('click', handleDownload);
  document.getElementById('btn-run-remake').addEventListener('click', handleRemake);
  document.getElementById('btn-test-minio').addEventListener('click', handleTestMinio);
  document.getElementById('btn-upload-minio').addEventListener('click', handleUploadMinio);

  // Autopilot listeners
  document.getElementById('btn-toggle-autopilot')?.addEventListener('click', handleToggleAutopilot);
  document.getElementById('btn-save-tiktok-cookie')?.addEventListener('click', handleSaveTikTokCookie);
  document.getElementById('btn-open-tiktok-login')?.addEventListener('click', handleOpenTikTokLogin);
  document.getElementById('btn-close-tiktok-login')?.addEventListener('click', handleCloseTikTokLogin);
  document.getElementById('btn-manual-scan')?.addEventListener('click', handleManualScan);
  document.getElementById('btn-post-now')?.addEventListener('click', handlePostNow);
  document.getElementById('btn-add-target')?.addEventListener('click', handleAddTarget);
  document.getElementById('btn-refresh-logs')?.addEventListener('click', loadAutopilotData);

  // Video Generator listeners
  document.getElementById('vgPlanBtn')?.addEventListener('click', vgPlanScenes);
  document.getElementById('vgGenerateBtn')?.addEventListener('click', vgGenerateAndRender);
  document.getElementById('vgPublishBtn')?.addEventListener('click', vgPublishToTikTok);

  document.getElementById('select-remake-video').addEventListener('change', (e) => {
    const video = videoLibrary.find(v => v.id === e.target.value);
    if (video) updateRemakeView(video);
  });
}

// 1. Tải danh sách video
async function loadVideos() {
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    if (data.success) {
      videoLibrary = data.videos;
      renderVideoGrid();
      updateSelectDropdowns();
    }
  } catch (err) {
    console.error('Lỗi load video:', err);
  }
}

function renderVideoGrid() {
  const grid = document.getElementById('video-grid');
  document.getElementById('video-count').innerText = videoLibrary.length;

  if (videoLibrary.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: 10px;">
        <p>Chưa có video nào trong thư viện. Hãy dán link Douyin ở phía trên để tải thử nghiệm!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = videoLibrary.map(v => {
    const activeVideoSrc = v.remakeUrl || v.rawUrl;
    const isRemade = !!v.remakeUrl;
    return `
      <div class="video-card">
        <div class="video-player-wrap">
          <video controls preload="metadata" src="${activeVideoSrc}"></video>
        </div>
        <div class="video-info-box">
          <div class="video-title" title="${escapeHtml(v.title || 'Video')}">${escapeHtml(v.title || 'Video Douyin')}</div>
          <div class="video-meta">
            <span>Tác giả: <strong>${escapeHtml(v.author || 'N/A')}</strong></span>
            <span class="badge-status ${isRemade ? 'status-remade' : 'status-downloaded'}">
              ${isRemade ? 'Đã Remake' : 'Video Gốc'}
            </span>
          </div>
          <div style="font-size: 11px; font-family: var(--font-mono); color: #38bdf8; word-break: break-all;">
            MD5: ${(isRemade ? v.remadeMd5 : v.originalMd5)?.slice(0, 16)}...
          </div>
          <div class="video-card-actions">
            <button class="btn btn-secondary" onclick="switchToRemake('${v.id}')">⚡ Remake</button>
            <button class="btn btn-secondary" onclick="switchToMinio('${v.id}')">☁️ MinIO</button>
            <button class="btn btn-secondary" style="color: #f87171;" onclick="deleteVideo('${v.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateSelectDropdowns() {
  const remakeSelect = document.getElementById('select-remake-video');
  const minioSelect = document.getElementById('select-minio-video');

  const options = `<option value="">-- Chọn video trong thư viện --</option>` +
    videoLibrary.map(v => `<option value="${v.id}">${escapeHtml(v.title || v.id).slice(0, 45)}...</option>`).join('');

  remakeSelect.innerHTML = options;
  minioSelect.innerHTML = options;
}

// 2. Xử lý Tải Video
async function handleDownload() {
  const input = document.getElementById('input-douyin-url');
  const rawUrl = input.value.trim();
  if (!rawUrl) {
    alert('Vui lòng dán link video Douyin!');
    return;
  }

  const progressBox = document.getElementById('download-progress-box');
  const progressText = document.getElementById('progress-text');
  const btnDownload = document.getElementById('btn-start-download');

  progressBox.classList.remove('hidden');
  progressText.innerText = 'Đang phân giải link video Douyin không watermark...';
  btnDownload.disabled = true;

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawUrl })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Tải video thất bại');
    }

    progressText.innerText = 'Tải video thành công!';
    input.value = '';
    await loadVideos();

    setTimeout(() => {
      progressBox.classList.add('hidden');
    }, 2000);
  } catch (err) {
    alert('Lỗi: ' + err.message);
    progressBox.classList.add('hidden');
  } finally {
    btnDownload.disabled = false;
  }
}

// 3. Xử lý Remake Video
function switchToRemake(id) {
  const navBtn = document.querySelector('[data-tab="tab-remake"]');
  if (navBtn) navBtn.click();
  const select = document.getElementById('select-remake-video');
  select.value = id;
  const video = videoLibrary.find(v => v.id === id);
  if (video) updateRemakeView(video);
}

function updateRemakeView(video) {
  activeVideoForRemake = video;
  const playerOrig = document.getElementById('player-original');
  const playerRemade = document.getElementById('player-remade');
  const md5Orig = document.getElementById('md5-original');
  const md5Remade = document.getElementById('md5-remade');
  const badge = document.getElementById('remake-status-badge');

  playerOrig.src = video.rawUrl;
  md5Orig.innerText = `MD5 Gốc: ${video.originalMd5 || 'N/A'}`;

  if (video.remakeUrl) {
    playerRemade.src = video.remakeUrl;
    md5Remade.innerText = `MD5 Remake: ${video.remadeMd5 || 'N/A'}`;
    badge.innerText = 'Đã hoàn thành Remake';
    badge.className = 'badge badge-accent';
  } else {
    playerRemade.src = '';
    md5Remade.innerText = 'MD5: Chưa xử lý';
    badge.innerText = 'Chưa Remake';
    badge.className = 'badge';
  }
}

async function handleRemake() {
  const select = document.getElementById('select-remake-video');
  const id = select.value;
  if (!id) {
    alert('Vui lòng chọn video cần remake!');
    return;
  }

  const options = {
    flipHorizontal: document.getElementById('opt-flip').checked,
    removeChineseSub: document.getElementById('opt-remove-sub').checked,
    zoomCrop: document.getElementById('opt-zoom').checked,
    colorGrade: document.getElementById('opt-color').checked,
    pitchShift: document.getElementById('opt-pitch').checked,
    speedAdjust: parseFloat(document.getElementById('opt-speed').value)
  };

  const btn = document.getElementById('btn-run-remake');
  btn.disabled = true;
  btn.innerText = '⏳ Đang xử lý FFmpeg (Lật, Zoom, Đổi MD5)...';

  try {
    const res = await fetch(`/api/remake/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Remake thất bại');
    }

    alert('Đã Remake video thành công!');
    await loadVideos();
    const updated = videoLibrary.find(v => v.id === id);
    if (updated) updateRemakeView(updated);
  } catch (err) {
    alert('Lỗi remake: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '⚡ Tiến Hành Remake Bằng FFmpeg';
  }
}

// 4. MinIO Functions
function switchToMinio(id) {
  const navBtn = document.querySelector('[data-tab="tab-minio"]');
  if (navBtn) navBtn.click();
  document.getElementById('select-minio-video').value = id;
}

async function handleTestMinio() {
  const alertBox = document.getElementById('minio-test-alert');
  alertBox.className = 'alert';
  alertBox.classList.remove('hidden');
  alertBox.innerText = 'Đang kiểm tra kết nối MinIO...';

  const config = {
    endpoint: document.getElementById('minio-endpoint').value.trim(),
    accessKeyId: document.getElementById('minio-access-key').value.trim(),
    secretAccessKey: document.getElementById('minio-secret-key').value.trim(),
    bucket: document.getElementById('minio-bucket').value.trim()
  };

  try {
    const res = await fetch('/api/minio/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (data.success) {
      alertBox.classList.add('success');
      alertBox.innerText = '✓ ' + data.message;
    } else {
      alertBox.classList.add('error');
      alertBox.innerText = '✗ ' + data.message;
    }
  } catch (err) {
    alertBox.classList.add('error');
    alertBox.innerText = '✗ Lỗi kết nối: ' + err.message;
  }
}

async function handleUploadMinio() {
  const select = document.getElementById('select-minio-video');
  const id = select.value;
  if (!id) {
    alert('Vui lòng chọn video cần đẩy lên MinIO!');
    return;
  }

  const useRemake = document.getElementById('minio-use-remake').checked;
  const btn = document.getElementById('btn-upload-minio');
  btn.disabled = true;
  btn.innerText = '⏳ Đang upload lên MinIO...';

  try {
    const res = await fetch(`/api/minio/upload/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useRemake })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload MinIO thất bại');
    }

    const resultBox = document.getElementById('minio-upload-result');
    resultBox.classList.remove('hidden');
    document.getElementById('res-s3-key').innerText = data.data.key;
    const link = document.getElementById('res-presigned-url');
    link.href = data.data.presignedUrl;
    link.innerText = 'Xem video trực tiếp (Presigned URL)';

    alert('Đã đẩy video lên MinIO thành công!');
    await loadVideos();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '☁️ Upload Lên MinIO Bucket';
  }
}

// 5. Xóa Video
async function deleteVideo(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa video này?')) return;
  try {
    await fetch(`/api/videos/${id}`, { method: 'DELETE' });
    await loadVideos();
  } catch (err) {
    alert('Lỗi xóa: ' + err.message);
  }
}

// 6. Tải Kế hoạch đăng bài
async function loadPublisherPlan() {
  try {
    const res = await fetch('/api/publisher/plan');
    const data = await res.json();
    const snippetView = document.getElementById('code-snippet-view');
    snippetView.innerText = `// === 1. MÃ TỰ ĐỘNG POST TIKTOK QUA PLAYWRIGHT ===\n` +
      data.tiktokSnippet +
      `\n\n// === 2. MÃ TỰ ĐỘNG POST YOUTUBE SHORTS QUA GOOGLE API ===\n` +
      data.youtubeSnippet;
  } catch (err) {
    console.error('Lỗi tải publisher plan:', err);
  }
}

// 7. AUTOPILOT MODULE FUNCTIONS
let autopilotState = { isRunning: false };

async function loadAutopilotData() {
  try {
    // 1. Load Autopilot Status
    const statusRes = await fetch('/api/autopilot/status');
    const statusData = await statusRes.json();
    autopilotState.isRunning = statusData.isRunning;

    const badge = document.getElementById('autopilot-status-badge');
    const btnToggle = document.getElementById('btn-toggle-autopilot');
    if (statusData.isRunning) {
      badge.innerText = '● Đang Chạy Tự Động';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
      btnToggle.innerText = '⏸️ Tạm Dừng Autopilot';
      btnToggle.className = 'btn btn-secondary';
    } else {
      badge.innerText = 'Đang Tắt';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#f87171';
      btnToggle.innerText = '⚡ Bật Chế Độ Tự Động Hoá (Autopilot)';
      btnToggle.className = 'btn btn-primary';
    }

    // 2. Load Queue
    document.getElementById('queue-count').innerText = statusData.queueCount || 0;
    const queueList = document.getElementById('queue-list');
    if (statusData.queue && statusData.queue.length > 0) {
      queueList.innerHTML = statusData.queue.map((v, i) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px;">
            <strong style="color: #38bdf8;">#${i + 1}</strong> ${escapeHtml(v.title)}
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(v.author)} • ${v.duration || 30}s</div>
          </div>
          <span class="badge badge-accent">Sẵn Sàng</span>
        </div>
      `).join('');
    } else {
      queueList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Hàng đợi trống. Hãy bấm "Quét Kênh" để tự động cào video mới!</div>`;
    }

    // 3. Load Logs
    const logsBox = document.getElementById('autopilot-logs-box');
    if (statusData.recentLogs && statusData.recentLogs.length > 0) {
      logsBox.innerHTML = statusData.recentLogs.map(l => `
        <div style="margin-bottom: 6px;">
          <span style="color: var(--text-muted);">[${l.time}]</span>
          <strong style="color: ${l.type === 'SUCCESS' ? '#34d399' : l.type === 'ERROR' ? '#f87171' : '#38bdf8'};">[${l.type}]</strong>
          <span>${escapeHtml(l.message)}</span>
        </div>
      `).join('');
    } else {
      logsBox.innerHTML = `<span style="color: var(--text-muted);">Chưa có nhật ký hoạt động nào.</span>`;
    }

    // 4. Check TikTok Login Status
    checkTikTokLoginStatus();

    // 5. Load Targets
    loadTargets();
  } catch (err) {
    console.error('Lỗi load Autopilot data:', err);
  }
}

async function checkTikTokLoginStatus() {
  const badge = document.getElementById('tiktok-login-badge');
  try {
    const res = await fetch('/api/tiktok/status');
    const data = await res.json();
    if (data.loggedIn) {
      badge.innerText = '✓ Đã Kết Nối';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
    } else {
      badge.innerText = '✗ Chưa Đăng Nhập';
      badge.style.background = 'rgba(245, 158, 11, 0.2)';
      badge.style.color = '#fbbf24';
    }
  } catch (e) {
    badge.innerText = 'Chưa Kết Nối';
  }
}

async function handleToggleAutopilot() {
  const nextState = !autopilotState.isRunning;
  try {
    const res = await fetch('/api/autopilot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextState })
    });
    const data = await res.json();
    if (data.success) {
      await loadAutopilotData();
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function handleSaveTikTokCookie() {
  const input = document.getElementById('input-tiktok-cookie');
  const val = input.value.trim();
  if (!val) {
    alert('Vui lòng dán chuỗi cookie hoặc mã sessionid từ TikTok!');
    return;
  }
  const btn = document.getElementById('btn-save-tiktok-cookie');
  btn.disabled = true;
  btn.innerText = '⏳ Đang lưu...';
  try {
    const res = await fetch('/api/tiktok/save-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: val })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi lưu cookie');
    alert(data.message);
    input.value = '';
    await checkTikTokLoginStatus();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '💾 Lưu Cookie';
  }
}

async function handleOpenTikTokLogin() {
  const btn = document.getElementById('btn-open-tiktok-login');
  btn.disabled = true;
  btn.innerText = '⏳ Đang mở trình duyệt...';
  try {
    const res = await fetch('/api/tiktok/login-window', { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Cửa sổ đăng nhập TikTok đã mở! Bạn hãy đăng nhập trên trình duyệt vừa hiện lên.');
    setTimeout(checkTikTokLoginStatus, 5000);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🔑 Mở Cửa Sổ Đăng Nhập TikTok';
  }
}

async function handleCloseTikTokLogin() {
  const btn = document.getElementById('btn-close-tiktok-login');
  btn.disabled = true;
  btn.innerText = '⏳ Đang lưu phiên...';
  try {
    const res = await fetch('/api/tiktok/close-login', { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Đã lưu phiên làm việc và đóng cửa sổ đăng nhập an toàn!');
    await checkTikTokLoginStatus();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '💾 Đã Đăng Nhập Xong (Lưu Phiên)';
  }
}

async function checkTikTokLoginStatus() {
  const badge = document.getElementById('tiktok-login-badge');
  if (!badge) return;
  try {
    const res = await fetch('/api/tiktok/status');
    const data = await res.json();
    if (data.loggedIn) {
      badge.innerText = 'Đã Đăng Nhập ✓';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
    } else {
      badge.innerText = data.browserOpen ? 'Đang Mở Trình Duyệt...' : 'Chưa Đăng Nhập';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#f87171';
    }
  } catch (e) {
    badge.innerText = 'Chưa Kết Nối';
  }
}

async function handleManualScan() {
  const btn = document.getElementById('btn-manual-scan');
  btn.disabled = true;
  btn.innerText = '⏳ Đang quét & tải video từ 3 kênh mục tiêu...';
  try {
    const res = await fetch('/api/autopilot/scan-channels', { method: 'POST' });
    const data = await res.json();
    alert('Đã kích hoạt quét 3 kênh mục tiêu thành công! Hệ thống đang tự động tải và remake video mới chạy nền.');
    setTimeout(loadAutopilotData, 3000);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🔄 Quét Ngay 3 Kênh Mục Tiêu (Cào & Remake Tự Động)';
  }
}

async function handlePostNow() {
  const btn = document.getElementById('btn-post-now');
  if (!confirm('Bạn có muốn tự động lấy 1 video trong hàng đợi và đăng ngay lên TikTok?')) return;
  btn.disabled = true;
  btn.innerText = '⏳ Đang đăng video lên TikTok...';
  try {
    const res = await fetch('/api/autopilot/post-now', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert('✓ Đã đăng video lên TikTok thành công!');
    } else {
      alert('Thông báo: ' + (data.message || data.error));
    }
    await loadAutopilotData();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 Đăng 1 Video Ngay';
  }
}

async function loadTargets() {
  try {
    const res = await fetch('/api/targets');
    const data = await res.json();
    const list = document.getElementById('targets-list');
    if (data.targets && data.targets.length > 0) {
      list.innerHTML = data.targets.map((t, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid var(--border-color);">
          <div>
            <strong style="color: #38bdf8;">${escapeHtml(t.name || t.username)}</strong>
            <div style="font-size: 11px; color: var(--text-muted);"><a href="${escapeHtml(t.url)}" target="_blank" style="color: var(--text-muted);">${escapeHtml(t.url)}</a></div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Đang Theo Dõi</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Lỗi load targets:', e);
  }
}

async function handleAddTarget() {
  const input = document.getElementById('input-new-target-url');
  const url = input.value.trim();
  if (!url) return;

  try {
    const res = await fetch('/api/targets');
    const data = await res.json();
    const targets = data.targets || [];
    targets.push({
      id: 't_' + Date.now(),
      username: url.split('@')[1]?.split('/')[0] || 'Kênh mới',
      url,
      name: 'Kênh theo dõi ' + (targets.length + 1),
      active: true
    });

    await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets })
    });

    input.value = '';
    await loadTargets();
  } catch (e) {
    alert('Lỗi thêm kênh: ' + e.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

// 9. VIDEO GENERATOR MODULE FUNCTIONS
let vgCurrentProjectId = null;

async function vgPlanScenes() {
  const rawScript = document.getElementById('vgScriptInput').value.trim();
  if (!rawScript) return alert('Vui lòng nhập kịch bản');

  const btn = document.getElementById('vgPlanBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang chia scene (Gemini Ultra)...';

  try {
    const res = await fetch('/api/video-gen/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: document.getElementById('vgKind').value,
        aspectRatio: document.getElementById('vgAspectRatio').value,
        title: document.getElementById('vgTitle').value.trim(),
        rawScript,
        lessonText: document.getElementById('vgLessonText').value.trim(),
      }),
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);

    vgCurrentProjectId = json.data.id;
    document.getElementById('vgProjectView').hidden = false;
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🎬 Chia Scene';
  }
}

function vgRenderProject(project) {
  const grid = document.getElementById('vgSceneGrid');
  grid.innerHTML = project.scenes.map((scene) => `
    <div class="vf-scene-card">
      <div class="vf-scene-status">${escapeHtml(scene.mediaStatus || 'pending')}</div>
      ${scene.mediaFile ? `<video src="/media/${escapeHtml(scene.mediaFile.split('/').pop())}" muted></video>` : ''}
      <p>${escapeHtml(scene.text)}</p>
      ${scene.mediaStatus !== 'video' ? `<button class="btn btn-secondary" onclick="vgRetryScene('${scene.id}')">Tạo lại media</button>` : ''}
    </div>
  `).join('');

  document.getElementById('vgGenerateBtn').hidden = false;

  if (project.status === 'done' && project.outputPath) {
    const video = document.getElementById('vgFinalVideo');
    video.src = `/storage/video-gen/${project.id}/output.mp4`;
    video.hidden = false;
    document.getElementById('vgPublishBox').hidden = false;
  }
}

async function vgRetryScene(sceneId) {
  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/retry-scene/${sceneId}`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function vgGenerateAndRender() {
  const btn = document.getElementById('vgGenerateBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang sinh media + render (có thể mất vài phút)...';

  // The /generate call blocks server-side until every scene is done (same
  // pattern the old AI Video Factory used) — poll GET /api/video-gen/:id
  // in the background so the scene grid shows live per-scene status
  // instead of staying frozen for the whole duration.
  const pollInterval = setInterval(async () => {
    try {
      const statusRes = await fetch(`/api/video-gen/${vgCurrentProjectId}`);
      const statusJson = await statusRes.json();
      if (statusJson.success) vgRenderProject(statusJson.data);
    } catch (_err) {
      // Ignore transient poll failures — the final fetch below is authoritative.
    }
  }, 4000);

  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/generate`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    clearInterval(pollInterval);
    btn.disabled = false;
    btn.innerText = '🎨 Sinh Media + Render';
  }
}

async function vgPublishToTikTok() {
  const btn = document.getElementById('vgPublishBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang đăng...';
  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/publish/tiktok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: document.getElementById('vgCaption').value.trim() }),
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    alert('Đã đăng TikTok thành công!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '📤 Đăng TikTok';
  }
}
