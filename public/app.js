let videoLibrary = [];
let activeVideoForRemake = null;
let vgCurrentProjectId = null;
let vgUploadedRefs = [];
let vgInputMode = 'single';
let vgBatchRunning = false;
let vgQueueData = [];

let filmProjects = [];
let activeFilmProjectId = null;
let filmPendingRefBase64 = [];

let pwState = {
  mode: 'single',
  skills: [],
  profiles: [],
  lastPrompts: []
};

let accountsList = [];
let unifiedLibrary = [];
let activeLibFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  setupEventListeners();
  refreshAllStudioData();
});

async function refreshAllStudioData() {
  await Promise.allSettled([
    loadVgQueue(),
    loadFilmProjects(),
    loadPromptWriterConfig(),
    loadAccounts(),
    loadVideos(),
    loadUnifiedLibrary()
  ]);
}

function showToast(msg) {
  const toast = document.getElementById('studio-toast') || document.getElementById('studioToast');
  if (!toast) return;
  toast.innerText = msg;
  toast.hidden = false;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.classList.add('hidden');
  }, 3800);
}

function initTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  const headings = {
    'tab-video-gen': {
      title: 'Tạo Video AI & Hàng Đợi Batch (Muse Studio Pro)',
      sub: 'Hỗ trợ 8 phong cách (Lành Tâm Split 3-Zone, Pictogram, Surreal Neon, Anime...), 8 ảnh tham chiếu & nối chuỗi video dài'
    },
    'tab-film': {
      title: 'Dự Án Phim & Nhân Vật Nhất Quán (Film Studio)',
      sub: 'Quản lý thư mục dự án, gắn ảnh Nhân vật / Bối cảnh theo khoảng cảnh (Scene Range) và tự động trích frame nối tiếp'
    },
    'tab-prompt-writer': {
      title: 'AI Viết Prompt Đơn & Hàng Loạt (Prompt Writer)',
      sub: 'Sử dụng bộ 6 kỹ năng đạo diễn (Lành Tâm, Điện ảnh, Continuity...) kết nối trực tiếp Gemini Ultra Web hoặc API'
    },
    'tab-accounts': {
      title: 'Tài Khoản AI, Proxy Pool & Extension Sync',
      sub: 'Quản lý đa tài khoản Gemini/TikTok, gán Proxy hàng loạt (ip:port:user:pass) và đồng bộ Cookie 1-click'
    },
    'tab-library': {
      title: 'Thư Viện Đầu Ra Hợp Nhất (Unified Library)',
      sub: 'Toàn bộ video AI đã render, dự án phim và video Douyin đã Remake tập trung tại một nơi'
    },
    'tab-download': {
      title: 'Cào Video Douyin Không Logo',
      sub: 'Nhập link chia sẻ Douyin để phân giải stream video gốc không watermark'
    },
    'tab-remake': {
      title: 'Xử Lý Remake Video FFmpeg (Lách Bản Quyền)',
      sub: 'Lật khung hình, zoom cắt viền, tinh chỉnh màu sắc và đổi mã MD5 cho cả video Douyin và video AI'
    },
    'tab-autopilot': {
      title: 'Cỗ Máy Tự Động Autopilot 24/7',
      sub: 'Tự động cào video mới từ các kênh đánh dấu, tự remake lách bản quyền và đăng TikTok định kỳ'
    },
    'tab-minio': {
      title: 'Lưu Trữ Video MinIO S3 Cloud',
      sub: 'Tự động đẩy video thô, video AI và video remake lên Object Storage cá nhân'
    }
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

      if (target === 'tab-autopilot') loadAutopilotData();
      if (target === 'tab-library') loadUnifiedLibrary();
      if (target === 'tab-accounts') loadAccounts();
      if (target === 'tab-film') loadFilmProjects();
      if (target === 'tab-video-gen') loadVgQueue();
    });
  });
}

function switchTab(tabId) {
  const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

function setupEventListeners() {
  (document.getElementById('btnGlobalRefresh') || document.getElementById('btn-refresh-list'))?.addEventListener('click', () => {
    refreshAllStudioData();
    showToast('🔄 Đã làm mới toàn bộ dữ liệu Studio!');
  });

  // Style Preset Cards
  const styleCards = document.querySelectorAll('#vgStyleCards .style-card, #styleCardsGrid .style-card, .style-cards-grid .style-card');
  styleCards.forEach(card => {
    card.addEventListener('click', () => {
      styleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const kind = card.getAttribute('data-style') || card.getAttribute('data-kind');
      const layout = card.getAttribute('data-layout');
      const ratio = card.getAttribute('data-ratio');
      const kindEl = document.getElementById('vgKind');
      if (kindEl && kind) kindEl.value = kind;
      if (layout) {
        const layoutEl = document.getElementById('vgLayoutMode');
        if (layoutEl) layoutEl.value = layout;
      }
      if (ratio) {
        const ratioEl = document.getElementById('vgAspectRatio');
        if (ratioEl) ratioEl.value = ratio;
      }
      const badge = document.getElementById('selectedStyleBadge');
      if (badge) badge.innerText = card.querySelector('strong, h4')?.innerText || kind;
    });
  });

  // Keep dropdown and style cards in sync
  document.getElementById('vgKind')?.addEventListener('change', (e) => {
    const selectedKind = e.target.value;
    styleCards.forEach(c => {
      const s = c.getAttribute('data-style') || c.getAttribute('data-kind');
      c.classList.toggle('active', s === selectedKind);
    });
  });

  // Single vs Batch mode
  const btnSingle = document.getElementById('vgModeSingle') || document.getElementById('modeSingleBtn');
  const btnBatch = document.getElementById('vgModeBatchLines') || document.getElementById('modeBatchBtn');
  const scriptInput = document.getElementById('vgScriptInput');

  btnSingle?.addEventListener('click', () => {
    vgInputMode = 'single';
    btnSingle.classList.add('active');
    btnBatch?.classList.remove('active');
    const singleWrap = document.getElementById('singleScriptWrap');
    const batchWrap = document.getElementById('batchScriptWrap');
    if (singleWrap) singleWrap.hidden = false;
    if (batchWrap) batchWrap.hidden = true;
    if (scriptInput) {
      scriptInput.placeholder = 'Nhập kịch bản tiếng Việt (VD: Có một kiểu người, dù bạn nói gì đi nữa, phản xạ đầu tiên là cãi lại...)';
    }
  });

  btnBatch?.addEventListener('click', () => {
    vgInputMode = 'batch';
    btnBatch.classList.add('active');
    btnSingle?.classList.remove('active');
    const singleWrap = document.getElementById('singleScriptWrap');
    const batchWrap = document.getElementById('batchScriptWrap');
    if (singleWrap) singleWrap.hidden = true;
    if (batchWrap) batchWrap.hidden = false;
    if (scriptInput) {
      scriptInput.placeholder = 'Nhập danh sách kịch bản / prompt (Mỗi dòng 1 video ngắn)...';
    }
  });

  // Sample Psychology script button
  document.getElementById('btnFillSamplePsych')?.addEventListener('click', () => {
    const channelEl = document.getElementById('vgChannelName');
    if (channelEl) channelEl.value = 'LÀNH TÂM';
    const titleEl = document.getElementById('vgTitle');
    if (titleEl) titleEl.value = 'TÍNH CÁCH PHẢN BÁC';
    const lessonEl = document.getElementById('vgLessonText');
    if (lessonEl) lessonEl.value = 'Nhận diện cơ chế phòng vệ tâm lý để giao tiếp lành mạnh hơn.';
    const layoutEl = document.getElementById('vgLayoutMode');
    if (layoutEl) layoutEl.value = 'split';
    const kindEl = document.getElementById('vgKind');
    if (kindEl) {
      kindEl.value = 'psych_split';
      kindEl.dispatchEvent(new Event('change'));
    }
    if (scriptInput) {
      scriptInput.value =
        'Trong cuộc sống có một kiểu người luôn thích mở miệng bằng hai chữ: Không phải. ' +
        'Bạn nói hôm nay trời đẹp, họ liền đáp nắng thế này mà đẹp gì, tia cực tím mạnh lắm. ' +
        'Trong tâm lý học, đây gọi là tính cách phản bác thường trực (Habitual Contradiction). ' +
        'Họ dùng sự phủ định người khác như một chiếc khiên vô hình để che giấu sự bất an và khẳng định quyền kiểm soát.';
    }
    showToast('✨ Đã điền mẫu kịch bản Lành Tâm (Tính Cách Phản Bác)!');
  });

  // Upload .txt batch file
  (document.getElementById('vgTxtFile') || document.getElementById('vgTxtFileInput'))?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    btnBatch?.click();
    const batchInput = document.getElementById('vgBatchPromptsInput') || document.getElementById('vgScriptInput');
    if (batchInput) batchInput.value = text;
    showToast(`📂 Đã nạp file ${file.name}`);
  });

  // Upload up to 8 reference images
  document.getElementById('vgRefInput')?.addEventListener('change', handleVgRefUpload);

  // Studio Voice Preview Button
  document.getElementById('btnPreviewVoice')?.addEventListener('click', previewStudioVoice);

  // Topic Suggestion Popup Modal & Auto Script Generator
  document.getElementById('btnOpenTopicSuggestModal')?.addEventListener('click', openTopicSuggestModal);
  document.getElementById('btnCloseTopicModal')?.addEventListener('click', closeTopicSuggestModal);
  document.getElementById('topicSuggestModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'topicSuggestModal') closeTopicSuggestModal();
  });
  document.getElementById('btnGenerateCustomTopicScript')?.addEventListener('click', () => {
    const kw = (document.getElementById('customTopicKeywordInput')?.value || '').trim();
    if (!kw) return alert('Vui lòng nhập chủ đề hoặc từ khóa bạn muốn tự sinh kịch bản!');
    const activeKind = topicCatalogState.activeKind || document.getElementById('vgKind')?.value || 'psych_split';
    selectTopicAndGenerateScript(activeKind, '', kw, false);
  });
  document.getElementById('customTopicKeywordInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnGenerateCustomTopicScript')?.click();
    }
  });
  document.getElementById('btnQuickRandomTopic')?.addEventListener('click', () => {
    const activeKind = document.getElementById('vgKind')?.value || 'psych_split';
    selectTopicAndGenerateScript(activeKind, '', '', false);
  });

  // Video Gen Action Buttons
  document.getElementById('btnOpenMuseGeminiChrome')?.addEventListener('click', openMuseGeminiChromeHandler);
  document.getElementById('vgMusePrimaryGenBtn')?.addEventListener('click', vgMusePrimaryGenerateCurrent);
  document.getElementById('vgPlanBtn')?.addEventListener('click', vgPlanScenes);
  document.getElementById('vgAddBatchBtn')?.addEventListener('click', vgAddBatchToQueue);
  document.getElementById('vgInstantRenderBtn')?.addEventListener('click', vgInstantRenderCurrent);
  document.getElementById('vgGenerateBtn')?.addEventListener('click', vgGenerateAndRender);
  (document.getElementById('vgRenderOnlyBtn') || document.getElementById('vgRenderOnlyProjectBtn'))?.addEventListener('click', () => {
    if (vgCurrentProjectId) vgRenderOnlyById(vgCurrentProjectId);
  });
  (document.getElementById('vgSendRemakeBtn') || document.getElementById('vgSendToRemakeBtn'))?.addEventListener('click', () => {
    if (vgCurrentProjectId) vgSendToRemake(vgCurrentProjectId);
  });
  document.getElementById('vgPublishBtn')?.addEventListener('click', vgPublishToTikTok);

  // Queue controls
  (document.getElementById('vgSelectAll') || document.getElementById('vgSelectAllQueue'))?.addEventListener('change', (e) => {
    document.querySelectorAll('.vg-queue-check, #vgQueueRows input[type="checkbox"]').forEach(chk => {
      chk.checked = e.target.checked;
    });
  });
  document.getElementById('vgQueueStartRenderBtn')?.addEventListener('click', () => runBatchQueue('render-only'));
  document.getElementById('vgQueueStartVeoBtn')?.addEventListener('click', () => runBatchQueue('generate'));
  document.getElementById('vgQueueStopBtn')?.addEventListener('click', () => {
    vgBatchRunning = false;
    showToast('⏹ Đã yêu cầu dừng hàng đợi sau tác vụ hiện tại.');
  });
  document.getElementById('vgDeleteSelectedBtn')?.addEventListener('click', deleteSelectedQueueItems);

  // Film Studio Listeners
  document.getElementById('btnCreateFilmProject')?.addEventListener('click', createFilmProjectHandler);
  (document.getElementById('filmAssetFile') || document.getElementById('filmAssetRefInput'))?.addEventListener('change', handleFilmAssetFileSelect);
  (document.getElementById('btnAddFilmAsset') || document.getElementById('btnSaveFilmAsset'))?.addEventListener('click', saveFilmAssetHandler);
  (document.getElementById('btnSaveFilmGlobalRules') || document.getElementById('btnSaveFilmRules'))?.addEventListener('click', saveFilmRulesHandler);
  document.getElementById('btnAddFilmSceneRule')?.addEventListener('click', addFilmSceneRuleHandler);
  (document.getElementById('btnAddFilmScenesToQueue') || document.getElementById('btnFilmAddQueue'))?.addEventListener('click', addFilmScenesToQueueHandler);

  // Prompt Writer Listeners
  document.getElementById('pwTabSingle')?.addEventListener('click', () => {
    pwState.mode = 'single';
    document.getElementById('pwTabSingle').classList.add('active');
    document.getElementById('pwTabBulk')?.classList.remove('active');
    const singleBox = document.getElementById('pwSingleBox');
    const bulkBox = document.getElementById('pwBulkBox');
    if (singleBox) singleBox.hidden = false;
    if (bulkBox) bulkBox.hidden = true;
  });
  document.getElementById('pwTabBulk')?.addEventListener('click', () => {
    pwState.mode = 'bulk';
    document.getElementById('pwTabBulk').classList.add('active');
    document.getElementById('pwTabSingle')?.classList.remove('active');
    const singleBox = document.getElementById('pwSingleBox');
    const bulkBox = document.getElementById('pwBulkBox');
    if (singleBox) singleBox.hidden = true;
    if (bulkBox) bulkBox.hidden = false;
  });
  (document.getElementById('btnPwGenerateSingle') || document.getElementById('btnRunPromptWriter'))?.addEventListener('click', runPromptWriterHandler);
  (document.getElementById('btnPwSendToVideo') || document.getElementById('btnSendPromptsToVg'))?.addEventListener('click', sendPromptsToVideoGen);
  document.getElementById('btnSavePwProfile')?.addEventListener('click', savePwProfileHandler);
  document.getElementById('btnSavePwSkill')?.addEventListener('click', savePwSkillHandler);

  // Accounts & Proxy Pool Listeners
  document.getElementById('btnAddAccount')?.addEventListener('click', addAccountHandler);
  (document.getElementById('btnAssignBulkProxies') || document.getElementById('btnAssignProxies'))?.addEventListener('click', assignBulkProxiesHandler);
  document.getElementById('btnRefreshAccounts')?.addEventListener('click', loadAccounts);

  // Unified Library Listeners
  document.querySelectorAll('#libFilterGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#libFilterGroup .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLibFilter = btn.getAttribute('data-filter') || 'all';
      renderUnifiedLibrary();
    });
  });
  (document.getElementById('btnRefreshLibrary') || document.getElementById('btn-refresh-list'))?.addEventListener('click', loadUnifiedLibrary);

  // Existing Douyin / Remake / MinIO / Autopilot Listeners
  document.getElementById('btn-refresh-list')?.addEventListener('click', loadVideos);
  document.getElementById('btn-start-download')?.addEventListener('click', handleDownload);
  document.getElementById('btn-run-remake')?.addEventListener('click', handleRemake);
  document.getElementById('btn-test-minio')?.addEventListener('click', handleTestMinio);
  document.getElementById('btn-upload-minio')?.addEventListener('click', handleUploadMinio);

  document.getElementById('btn-toggle-autopilot')?.addEventListener('click', handleToggleAutopilot);
  document.getElementById('btn-save-tiktok-cookie')?.addEventListener('click', handleSaveTikTokCookie);
  document.getElementById('btn-open-tiktok-login')?.addEventListener('click', handleOpenTikTokLogin);
  document.getElementById('btn-close-tiktok-login')?.addEventListener('click', handleCloseTikTokLogin);
  document.getElementById('btn-manual-scan')?.addEventListener('click', handleManualScan);
  document.getElementById('btn-post-now')?.addEventListener('click', handlePostNow);
  document.getElementById('btn-add-target')?.addEventListener('click', handleAddTarget);
  document.getElementById('btn-refresh-logs')?.addEventListener('click', loadAutopilotData);

  document.getElementById('select-remake-video')?.addEventListener('change', (e) => {
    const video = videoLibrary.find(v => v.id === e.target.value);
    if (video) updateRemakeView(video);
  });
}

// ============================================================================
// TAB 1: AI VIDEO STUDIO PRO (8 Styles, Refs, Batch Queue, Instant Render)
// ============================================================================

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleVgRefUpload(e) {
  const files = Array.from(e.target.files || []).slice(0, 8 - vgUploadedRefs.length);
  if (files.length === 0) return;

  try {
    const payloadFiles = [];
    for (const f of files) {
      const dataUrl = await fileToDataUrl(f);
      payloadFiles.push({ name: f.name, dataUrl });
    }
    const res = await fetch('/api/uploads/base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: payloadFiles })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    vgUploadedRefs = [...vgUploadedRefs, ...json.data].slice(0, 8);
    renderVgRefThumbs();
    showToast(`🖼️ Đã tải lên ${vgUploadedRefs.length}/8 ảnh tham chiếu`);
  } catch (err) {
    alert('Lỗi tải ảnh tham chiếu: ' + err.message);
  }
}

function renderVgRefThumbs() {
  const wrap = document.getElementById('vgRefPreviewList');
  if (!wrap) return;
  wrap.innerHTML = vgUploadedRefs.map((ref, idx) => `
    <div class="ref-thumb-item">
      <img src="${escapeHtml(ref.url)}" alt="${escapeHtml(ref.name)}">
      <button type="button" onclick="removeVgRef(${idx})">✕</button>
    </div>
  `).join('');
}

function removeVgRef(idx) {
  vgUploadedRefs.splice(idx, 1);
  renderVgRefThumbs();
}

function getVgCommonPayload() {
  const kindEl = document.getElementById('vgKind');
  const layoutEl = document.getElementById('vgLayoutMode');
  const ratioEl = document.getElementById('vgAspectRatio');
  const durationEl = document.getElementById('vgDuration') || document.getElementById('vgTargetDuration');
  const continuityEl = document.getElementById('filmContinuityOffset') || document.getElementById('vgContinuityOffset');
  const channelEl = document.getElementById('vgChannelName');
  const titleEl = document.getElementById('vgTitle');
  const lessonEl = document.getElementById('vgLessonText');
  const projectEl = document.getElementById('vgFilmProjectSelect');
  const voiceEl = document.getElementById('vgVoice');
  const voiceRateEl = document.getElementById('vgVoiceRate');
  const aiEngineEl = document.getElementById('vgAiEngine');

  const voice = voiceEl?.value || 'vi-VN-NamMinhNeural';
  const voiceRate = voiceRateEl?.value || '+20%';
  const market = voice.startsWith('en-') ? 'US' : voice.startsWith('ja-') ? 'JP' : 'VI';
  const aiEngine = aiEngineEl?.value || 'muse_first';
  const mediaMode = aiEngine === 'gemini_first' ? 'gemini' : 'muse';

  return {
    kind: kindEl?.value || 'psych_split',
    layoutMode: layoutEl?.value || 'split',
    aspectRatio: ratioEl?.value || '9:16',
    targetDuration: Number(durationEl?.value) || 30,
    continuityOffset: Number(continuityEl?.value) || 0.3,
    channelName: channelEl?.value?.trim() || 'LÀNH TÂM',
    title: titleEl?.value?.trim() || 'TÍNH CÁCH PHẢN BÁC',
    lessonText: lessonEl?.value?.trim() || '',
    projectId: projectEl?.value || null,
    voice,
    voiceRate,
    market,
    aiEngine,
    mediaMode,
    refs: (vgUploadedRefs || []).map(r => r.ref || r.path || r.url).filter(Boolean)
  };
}

async function openMuseGeminiChromeHandler() {
  try {
    showToast('🌐 Đang mở Chrome AI (Cổng 9222) với Tab 1: Muse.ai (#1) & Tab 2: Gemini Ultra (#2)...');
    const res = await fetch('/api/muse/open-browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Không mở được Chrome');
    showToast('✅ ' + (json.message || 'Đã mở Chrome Muse.ai (#1) & Gemini Ultra (#2)!'));
  } catch (err) {
    alert('Lỗi mở trình duyệt Chrome AI: ' + err.message);
  }
}

let vgLastPlannedScript = '';

async function vgMusePrimaryGenerateCurrent() {
  const rawScript = (document.getElementById('vgScriptInput')?.value || '').trim();
  if (!rawScript && !vgCurrentProjectId) {
    return alert('Vui lòng nhập hoặc chọn chủ đề tự sinh kịch bản trước khi triển khai!');
  }

  const btn = document.getElementById('vgMusePrimaryGenBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang tạo hình ảnh 2D trên Muse.ai (#1) ➔ Gemini Ultra (#2) + Render...';
  }

  try {
    const common = getVgCommonPayload();
    if (common.aiEngine === 'remotion_only') {
      await vgInstantRenderCurrent();
      return;
    }

    if (!vgCurrentProjectId || vgLastPlannedScript !== rawScript) {
      showToast('🎬 Bước 1/2: Đang chia phân cảnh kịch bản...');
      const planRes = await fetch('/api/video-gen/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...common, rawScript })
      });
      const planJson = await planRes.json();
      if (!planJson.success) throw new Error(planJson.error);
      vgCurrentProjectId = planJson.data.id;
      vgLastPlannedScript = rawScript;
      const projView = document.getElementById('vgProjectView');
      if (projView) projView.hidden = false;
      vgRenderProject(planJson.data);
    }

    showToast('🎨 Bước 2/2: Đang tạo hình minh họa từng cảnh trên Muse.ai (#1) / Gemini Ultra (#2) + Giọng đọc & Render MP4...');
    await vgGenerateAndRender();
  } catch (err) {
    alert('Lỗi triển khai video Muse.ai / Gemini Ultra: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Triển Khai Video Qua Muse.ai (#1) ➔ Gemini Ultra (#2) + Render MP4';
    }
  }
}

async function previewStudioVoice() {
  const btn = document.getElementById('btnPreviewVoice');
  const player = document.getElementById('vgVoicePreviewPlayer');
  const common = getVgCommonPayload();
  const rawScript = (document.getElementById('vgScriptInput')?.value || '').trim();
  const firstSentence = rawScript.split(/(?<=[.!?…。！？])\s+/)[0] || '';

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang tạo giọng...';
  }
  try {
    const res = await fetch('/api/video-gen/tts-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: firstSentence.slice(0, 260),
        voice: common.voice,
        voiceRate: common.voiceRate
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Không tạo được giọng đọc thử');
    const audioUrl = json.audioUrl || json.data?.audioUrl;
    if (player && audioUrl) {
      player.src = audioUrl;
      player.hidden = false;
      player.play().catch(() => {});
    }
    showToast(`🔊 Đã tạo bản nghe thử Studio (${common.voice} • ${common.voiceRate})`);
  } catch (err) {
    alert('Lỗi nghe thử giọng đọc: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🔊 Nghe thử';
    }
  }
}

let topicCatalogState = {
  activeKind: 'psych_split',
  categories: []
};

async function openTopicSuggestModal() {
  const modal = document.getElementById('topicSuggestModal');
  if (!modal) return;
  const currentKind = document.getElementById('vgKind')?.value || 'psych_split';
  topicCatalogState.activeKind = currentKind;
  modal.hidden = false;

  try {
    const res = await fetch(`/api/video-gen/topic-suggestions?kind=${encodeURIComponent(currentKind)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Không tải được danh sách chủ đề');
    topicCatalogState.categories = json.data.categories || [];
    topicCatalogState.activeKind = json.data.activeKind || currentKind;
    renderTopicSuggestModal();
  } catch (err) {
    alert('Lỗi tải gợi ý chủ đề: ' + err.message);
  }
}

function closeTopicSuggestModal() {
  const modal = document.getElementById('topicSuggestModal');
  if (modal) modal.hidden = true;
}

function switchTopicModalStyle(kind) {
  topicCatalogState.activeKind = kind;
  renderTopicSuggestModal();
}

function renderTopicSuggestModal() {
  const tabsWrap = document.getElementById('topicModalStyleTabs');
  const cardsGrid = document.getElementById('topicModalCardsGrid');
  if (!tabsWrap || !cardsGrid) return;

  const categories = topicCatalogState.categories || [];
  const activeCat = categories.find(c => c.kind === topicCatalogState.activeKind) || categories[0];

  tabsWrap.innerHTML = categories.map(cat => `
    <button
      type="button"
      class="topic-style-tab ${cat.kind === activeCat?.kind ? 'active' : ''}"
      onclick="switchTopicModalStyle('${escapeHtml(cat.kind)}')"
    >
      ${escapeHtml(cat.label)} (${(cat.topics || []).length})
    </button>
  `).join('');

  if (!activeCat || !(activeCat.topics || []).length) {
    cardsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);">Chưa có chủ đề cho phong cách này.</div>`;
    return;
  }

  cardsGrid.innerHTML = activeCat.topics.map(topic => `
    <div class="topic-card" onclick="selectTopicAndGenerateScript('${escapeHtml(activeCat.kind)}', '${escapeHtml(topic.id)}', '', false)">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <span class="topic-card-badge">${escapeHtml(topic.badge || '🔥 Chủ đề Hot')}</span>
          <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(activeCat.defaultChannel || '')}</span>
        </div>
        <h4>${escapeHtml(topic.title)}</h4>
        <p>${escapeHtml(topic.summary)}</p>
      </div>
      <div class="topic-card-actions" onclick="event.stopPropagation();">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          style="flex:1;"
          onclick="selectTopicAndGenerateScript('${escapeHtml(activeCat.kind)}', '${escapeHtml(topic.id)}', '', false)"
        >
          ✍️ Chọn & Điền Kịch Bản
        </button>
        <button
          type="button"
          class="btn btn-emerald btn-sm"
          title="Tự điền kịch bản và chạy Render Nhanh luôn"
          onclick="selectTopicAndGenerateScript('${escapeHtml(activeCat.kind)}', '${escapeHtml(topic.id)}', '', true)"
        >
          ⚡ Render Luôn
        </button>
      </div>
    </div>
  `).join('');
}

async function selectTopicAndGenerateScript(kind, topicId = '', customTopic = '', autoRender = false) {
  try {
    const res = await fetch('/api/video-gen/generate-topic-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, topicId, customTopic })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Không thể sinh kịch bản từ chủ đề');

    const data = json.data;
    // Đồng bộ phong cách nếu người dùng chọn chủ đề ở tab phong cách khác
    const kindEl = document.getElementById('vgKind');
    if (kindEl && data.kind && kindEl.value !== data.kind) {
      kindEl.value = data.kind;
      kindEl.dispatchEvent(new Event('change'));
    }

    const channelEl = document.getElementById('vgChannelName');
    if (channelEl && data.channelName) channelEl.value = data.channelName;

    const titleEl = document.getElementById('vgTitle');
    if (titleEl && data.videoTitle) titleEl.value = data.videoTitle;

    const lessonEl = document.getElementById('vgLessonText');
    if (lessonEl && data.lessonText) lessonEl.value = data.lessonText;

    const scriptInput = document.getElementById('vgScriptInput');
    if (scriptInput) {
      if (vgInputMode === 'batch' && Array.isArray(data.batchLines) && data.batchLines.length > 0) {
        scriptInput.value = data.batchLines.join('\n');
      } else {
        scriptInput.value = data.script || '';
      }
    }

    // Reset current project ID so Instant Render plans fresh scenes for this new script
    vgCurrentProjectId = null;

    closeTopicSuggestModal();
    showToast(`💡 Đã tự sinh kịch bản chủ đề: "${data.topicTitle}"!`);

    if (autoRender) {
      await vgInstantRenderCurrent();
    }
  } catch (err) {
    alert('Lỗi tự sinh kịch bản: ' + err.message);
  }
}

async function vgPlanScenes() {
  const rawScript = (document.getElementById('vgScriptInput')?.value || '').trim();
  if (!rawScript) return alert('Vui lòng nhập kịch bản!');

  const btn = document.getElementById('vgPlanBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang chia Scene & phụ đề song ngữ...';
  }

  try {
    const payload = { ...getVgCommonPayload(), rawScript };
    const res = await fetch('/api/video-gen/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    vgCurrentProjectId = json.data.id;
    vgLastPlannedScript = rawScript;
    const projView = document.getElementById('vgProjectView');
    if (projView) projView.hidden = false;
    vgRenderProject(json.data);
    await loadVgQueue();
    showToast(`🎬 Đã chia ${(json.data.scenes || []).length} phân cảnh song ngữ!`);
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🎬 Chia Scene Chi Tiết';
    }
  }
}

async function vgInstantRenderCurrent() {
  const rawScript = (document.getElementById('vgScriptInput')?.value || '').trim();
  if (!rawScript && !vgCurrentProjectId) {
    return alert('Vui lòng nhập kịch bản trước khi Render Nhanh!');
  }

  const btn = document.getElementById('vgInstantRenderBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang tạo giọng đọc TTS + Render Remotion...';
  }

  try {
    if (!vgCurrentProjectId || vgLastPlannedScript !== rawScript) {
      const planRes = await fetch('/api/video-gen/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getVgCommonPayload(), rawScript })
      });
      const planJson = await planRes.json();
      if (!planJson.success) throw new Error(planJson.error);
      vgCurrentProjectId = planJson.data.id;
      vgLastPlannedScript = rawScript;
      const projView = document.getElementById('vgProjectView');
      if (projView) projView.hidden = false;
      vgRenderProject(planJson.data);
    }

    await vgRenderOnlyById(vgCurrentProjectId);
  } catch (err) {
    alert('Lỗi Render Nhanh: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ Tạo & Render Nhanh Ngay Bằng Remotion (Có Giọng Đọc + Phụ Đề Song Ngữ)';
    }
  }
}

async function vgRenderOnlyById(projectId) {
  const common = getVgCommonPayload();
  showToast(`⚡ Đang tạo giọng Neural Studio (${common.voiceRate}) + Remotion Render...`);
  const res = await fetch(`/api/video-gen/${projectId}/render-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice: common.voice,
      voiceRate: common.voiceRate
    })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);

  vgCurrentProjectId = projectId;
  const projView = document.getElementById('vgProjectView');
  if (projView) projView.hidden = false;
  vgRenderProject(json.data);
  await loadVgQueue();
  await loadUnifiedLibrary();
  showToast('✅ Đã Render MP4 hoàn tất với giọng đọc Studio!');
}

async function vgAddBatchToQueue() {
  const common = getVgCommonPayload();
  let items = [];

  if (vgInputMode === 'batch') {
    const rawText = (document.getElementById('vgBatchPromptsInput')?.value || document.getElementById('vgScriptInput')?.value || '').trim();
    const rawLines = rawText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (rawLines.length === 0) return alert('Vui lòng nhập ít nhất 1 dòng prompt/kịch bản!');
    items = rawLines.map((line, i) => ({
      title: `${common.title} #${i + 1}`,
      rawScript: line,
      sceneNo: i + 1
    }));
  } else {
    const rawScript = (document.getElementById('vgScriptInput')?.value || '').trim();
    if (!rawScript) return alert('Vui lòng nhập kịch bản!');
    items = [{ title: common.title, rawScript, sceneNo: 1 }];
  }

  const btn = document.getElementById('vgAddBatchBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang thêm vào hàng đợi...';
  }

  try {
    const res = await fetch('/api/video-gen/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...common,
        chainContinuity: document.getElementById('vgChainContinuity')?.checked !== false,
        items
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    await loadVgQueue();
    showToast(`📥 Đã thêm ${json.data.length} tác vụ vào Hàng Đợi Batch!`);
  } catch (err) {
    alert('Lỗi thêm hàng đợi: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '＋ Thêm Vào Hàng Đợi';
    }
  }
}

function vgRenderProject(project) {
  const grid = document.getElementById('vgSceneGrid');
  const countBadge = document.getElementById('vgSceneCountBadge');
  if (countBadge) countBadge.innerText = `${(project.scenes || []).length} cảnh`;
  const titleEl = document.getElementById('vgActiveProjectTitle');
  if (titleEl) titleEl.innerText = `Chi tiết phân cảnh (${(project.scenes || []).length} cảnh - ${project.title || ''})`;

  if (grid) {
    grid.innerHTML = (project.scenes || []).map((scene, idx) => {
      const mediaFileName = scene.mediaFile ? scene.mediaFile.split(/[\\/]/).pop() : '';
      const isImageMedia = /\.(png|jpe?g|webp)$/i.test(mediaFileName);
      const mediaPreviewHtml = !mediaFileName
        ? ''
        : isImageMedia
          ? `<img src="/media/${escapeHtml(mediaFileName)}?t=${Date.now()}" alt="Scene ${idx + 1}" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;margin-bottom:8px;background:#0f172a;border:1px solid rgba(255,255,255,0.12);" />`
          : `<video src="/media/${escapeHtml(mediaFileName)}?t=${Date.now()}" controls muted></video>`;
      return `
      <div class="vf-scene-card">
        <div class="vf-scene-status">
          <span>Cảnh #${idx + 1} (${escapeHtml(scene.visualMode || scene.type)})</span>
          <span>${escapeHtml(scene.mediaStatus || 'pending')}</span>
        </div>
        ${mediaPreviewHtml}
        <p style="color: #f8fafc; font-weight: 600;">🇻🇳 ${escapeHtml(scene.text)}</p>
        ${scene.textEn ? `<p style="font-size: 11.5px; color: #94a3b8;">🇬🇧 ${escapeHtml(scene.textEn)}</p>` : ''}
        ${scene.audioFile ? `<audio controls preload="none" src="/${escapeHtml(scene.audioFile)}?t=${Date.now()}" style="width:100%; height:28px; margin-top:4px;"></audio>` : ''}
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn btn-secondary btn-sm" onclick="vgRetryScene('${project.id}', '${scene.id}')">🔄 Tạo lại Media</button>
        </div>
      </div>
    `;
    }).join('');
  }

  const genBtn = document.getElementById('vgGenerateBtn');
  if (genBtn) genBtn.hidden = false;
  const renderBtn = document.getElementById('vgRenderOnlyBtn') || document.getElementById('vgRenderOnlyProjectBtn');
  if (renderBtn) renderBtn.hidden = false;

  if (project.status === 'done' && project.outputPath) {
    const video = document.getElementById('vgFinalVideo');
    if (video) {
      video.src = `/storage/video-gen/${project.id}/output.mp4?t=${Date.now()}`;
      video.hidden = false;
    }
    const pubBox = document.getElementById('vgPublishBox');
    if (pubBox) pubBox.hidden = false;
    const sendRemakeBtn = document.getElementById('vgSendRemakeBtn') || document.getElementById('vgSendToRemakeBtn');
    if (sendRemakeBtn) sendRemakeBtn.hidden = false;
  }
}

async function vgRetryScene(projectId, sceneId) {
  try {
    const common = getVgCommonPayload();
    showToast('🔄 Đang tạo lại media cho cảnh (Ưu tiên #1: Muse.ai ➔ Dự phòng #2: Gemini Ultra)...');
    const res = await fetch(`/api/video-gen/${projectId}/retry-scene/${sceneId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiEngine: common.aiEngine, mediaMode: common.mediaMode })
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
    await loadVgQueue();
    showToast('✅ Đã tạo lại media cho cảnh hoàn tất!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function vgGenerateAndRender() {
  if (!vgCurrentProjectId) return;
  const btn = document.getElementById('vgGenerateBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang sinh Video (Muse.ai #1 ➔ Gemini #2) + Render...';
  }

  const pollInterval = setInterval(async () => {
    try {
      const statusRes = await fetch(`/api/video-gen/${vgCurrentProjectId}`);
      const statusJson = await statusRes.json();
      if (statusJson.success) vgRenderProject(statusJson.data);
    } catch (_err) {}
  }, 4000);

  try {
    const common = getVgCommonPayload();
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiEngine: common.aiEngine,
        mediaMode: common.mediaMode,
        voice: common.voice,
        voiceRate: common.voiceRate
      })
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    vgRenderProject(json.data);
    await loadVgQueue();
    await loadUnifiedLibrary();
    showToast('🚀 Đã sinh Media qua Muse.ai / Gemini Ultra & Render hoàn tất!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    clearInterval(pollInterval);
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Sinh Video (Muse.ai #1 ➔ Gemini #2) + Render';
    }
  }
}

async function vgSendToRemake(projectId) {
  try {
    const res = await fetch(`/api/video-gen/${projectId}/send-to-remake`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    await loadVideos();
    showToast('⚡ Đã chuyển sang kho Remake FFmpeg!');
    switchToRemake(json.data.id);
  } catch (err) {
    alert('Lỗi chuyển sang Remake: ' + err.message);
  }
}

async function vgPublishToTikTok() {
  if (!vgCurrentProjectId) return;
  const btn = document.getElementById('vgPublishBtn');
  btn.disabled = true;
  btn.innerText = '⏳ Đang đăng...';
  try {
    const res = await fetch(`/api/video-gen/${vgCurrentProjectId}/publish/tiktok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: document.getElementById('vgCaption').value.trim() })
    });
    const json = await res.json();
    if (!json.success) return alert(json.error);
    showToast('📤 Đã đăng TikTok thành công!');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '📤 Đăng TikTok';
  }
}

async function loadVgQueue() {
  try {
    const res = await fetch('/api/video-gen');
    const json = await res.json();
    if (!json.success) return;
    vgQueueData = json.data || [];
    renderVgQueueTable();
    updateTopStats();
  } catch (e) {
    console.error('Lỗi tải hàng đợi:', e);
  }
}

function renderVgQueueTable() {
  const tbody = document.getElementById('vgQueueRows');
  const countBadge = document.getElementById('vgQueueCountBadge') || document.getElementById('vgQueueTotalBadge');
  if (countBadge) countBadge.innerText = `${vgQueueData.length}`;
  if (!tbody) return;

  if (vgQueueData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">Hàng đợi trống. Hãy bấm "Chia Scene" hoặc "Thêm Vào Hàng Đợi Batch".</td></tr>`;
    return;
  }

  tbody.innerHTML = vgQueueData.map((item, idx) => {
    const hasOutput = item.status === 'done' && item.outputPath;
    const statusColor = item.status === 'done' ? '#34d399' : item.status === 'failed' ? '#f87171' : '#38bdf8';
    return `
      <tr>
        <td><input type="checkbox" class="vg-queue-check" value="${item.id}"></td>
        <td><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight:700; color:#f8fafc;">${escapeHtml(item.title || 'Dự án')}</div>
          <div style="font-size:11px; color:var(--text-muted); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(item.rawScript || '')}
          </div>
        </td>
        <td>
          <span class="badge badge-accent">${escapeHtml(item.kind)}</span>
          <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">${escapeHtml(item.layoutMode || 'full')} • ${escapeHtml(item.aspectRatio)}</div>
        </td>
        <td>${item.targetDuration || 15}s (${(item.scenes || []).length} cảnh)</td>
        <td>${(item.refs || []).length} ảnh</td>
        <td>
          <span style="font-weight:700; color:${statusColor}; text-transform:uppercase; font-size:11px;">
            ${escapeHtml(item.status)}
          </span>
        </td>
        <td>
          ${hasOutput
            ? `<a href="/storage/video-gen/${item.id}/output.mp4" target="_blank" style="color:#34d399; font-weight:700; font-size:12px;">▶ Xem MP4</a>`
            : `<span style="color:var(--text-muted); font-size:11px;">Chưa render</span>`}
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="inspectQueueItem('${item.id}')">👁️</button>
            <button class="btn btn-emerald btn-sm" title="Render Nhanh Remotion" onclick="vgRenderOnlyById('${item.id}')">⚡ Render</button>
            ${hasOutput ? `<button class="btn btn-secondary btn-sm" title="Đẩy sang Remake" onclick="vgSendToRemake('${item.id}')">Remake</button>` : ''}
            <button class="btn btn-secondary btn-sm" style="color:#f87171;" onclick="deleteQueueItem('${item.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function inspectQueueItem(id) {
  const item = vgQueueData.find(x => x.id === id);
  if (!item) return;
  vgCurrentProjectId = item.id;
  const projView = document.getElementById('vgProjectView');
  if (projView) projView.hidden = false;
  vgRenderProject(item);
}

async function deleteQueueItem(id) {
  await fetch(`/api/video-gen/${id}`, { method: 'DELETE' });
  await loadVgQueue();
}

async function deleteSelectedQueueItems() {
  const ids = Array.from(document.querySelectorAll('.vg-queue-check:checked')).map(el => el.value);
  if (ids.length === 0) return alert('Chưa chọn tác vụ nào!');
  for (const id of ids) {
    await fetch(`/api/video-gen/${id}`, { method: 'DELETE' });
  }
  await loadVgQueue();
  showToast(`🗑️ Đã xóa ${ids.length} tác vụ!`);
}

async function runBatchQueue(mode = 'render-only') {
  const checkedIds = Array.from(document.querySelectorAll('.vg-queue-check:checked')).map(el => el.value);
  const targetItems = checkedIds.length > 0
    ? vgQueueData.filter(x => checkedIds.includes(x.id))
    : vgQueueData.filter(x => x.status !== 'done');

  if (targetItems.length === 0) {
    return alert('Không có tác vụ nào cần chạy! Hãy chọn tác vụ hoặc thêm mới.');
  }

  vgBatchRunning = true;
  showToast(`▶ Bắt đầu chạy hàng đợi (${targetItems.length} video)...`);

  for (const item of targetItems) {
    if (!vgBatchRunning) break;
    try {
      const common = getVgCommonPayload();
      const endpoint = mode === 'render-only'
        ? `/api/video-gen/${item.id}/render-only`
        : `/api/video-gen/${item.id}/generate`;
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiEngine: common.aiEngine,
          mediaMode: common.mediaMode,
          voice: common.voice,
          voiceRate: common.voiceRate
        })
      });
      await loadVgQueue();
    } catch (e) {
      console.error('Batch item error:', e);
    }
  }

  vgBatchRunning = false;
  await loadVgQueue();
  await loadUnifiedLibrary();
  showToast('🎉 Đã hoàn thành chạy hàng đợi Batch!');
}

function updateTopStats() {
  const total = vgQueueData.length;
  const done = vgQueueData.filter(x => x.status === 'done').length;
  const running = vgQueueData.filter(x => ['planning', 'generating', 'rendering'].includes(x.status)).length;
  const queued = vgQueueData.filter(x => ['planned', 'queued'].includes(x.status)).length;
  const failed = vgQueueData.filter(x => x.status === 'failed' || x.status === 'error').length;

  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  safeSet('stat-vg-total', total);
  safeSet('stat-vg-queued', queued + running);
  safeSet('stat-vg-done', done);
  safeSet('stat-vg-failed', failed);

  safeSet('statQueueTotal', total);
  safeSet('statRunning', running);
  safeSet('statDone', done);
  safeSet('statQueued', queued);
}

// ============================================================================
// TAB 2: FILM PROJECTS & CHARACTER CONTINUITY
// ============================================================================

async function loadFilmProjects() {
  try {
    const res = await fetch('/api/film-projects');
    const json = await res.json();
    if (!json.success) return;
    filmProjects = json.projects || json.data || [];
    renderFilmProjectsList();
    populateVgFilmSelect();
  } catch (e) {
    console.error('Lỗi tải dự án phim:', e);
  }
}

function populateVgFilmSelect() {
  const sel = document.getElementById('vgFilmProjectSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">-- Không gắn dự án phim --</option>` +
    filmProjects.map(p => `<option value="${p.id}">${escapeHtml(p.title)} (${p.id})</option>`).join('');
  sel.value = current;
}

function renderFilmProjectsList() {
  const grid = document.getElementById('filmFoldersGrid') || document.getElementById('filmProjectsList');
  if (!grid) return;
  if (filmProjects.length === 0) {
    grid.innerHTML = `<div style="color:var(--text-muted); padding:12px;">Chưa có dự án phim nào. Hãy tạo thư mục dự án ở trên!</div>`;
    return;
  }

  grid.innerHTML = filmProjects.map(p => `
    <div class="film-folder-card ${p.id === activeFilmProjectId ? 'active' : ''}" onclick="selectFilmProject('${p.id}')">
      <div>
        <strong style="color:#f8fafc;">📁 ${escapeHtml(p.title)}</strong>
        <div style="font-size:11px; color:var(--text-muted);">
          ${(p.assets || []).length} tài nguyên • ${(p.sceneRules || []).length} quy tắc
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="color:#f87171;" onclick="event.stopPropagation(); deleteFilmProject('${p.id}')">✕</button>
    </div>
  `).join('');
}

async function createFilmProjectHandler() {
  const input = document.getElementById('filmNewName') || document.getElementById('filmNewTitleInput');
  const title = input?.value?.trim();
  if (!title) return alert('Vui lòng nhập tên dự án phim!');

  const res = await fetch('/api/film-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, defaultStyle: 'cinematic' })
  });
  const json = await res.json();
  if (!json.success) return alert(json.error);

  if (input) input.value = '';
  activeFilmProjectId = json.data.id;
  await loadFilmProjects();
  selectFilmProject(activeFilmProjectId);
  showToast(`🎬 Đã tạo dự án phim "${title}"!`);
}

async function deleteFilmProject(id) {
  if (!confirm('Xóa dự án phim này?')) return;
  await fetch(`/api/film-projects/${id}`, { method: 'DELETE' });
  if (activeFilmProjectId === id) {
    activeFilmProjectId = null;
    const ws = document.getElementById('filmActiveWorkspace') || document.getElementById('filmWorkspaceCard');
    if (ws) ws.hidden = true;
  }
  await loadFilmProjects();
}

function selectFilmProject(id) {
  const proj = filmProjects.find(p => p.id === id);
  if (!proj) return;
  activeFilmProjectId = id;
  renderFilmProjectsList();

  const ws = document.getElementById('filmActiveWorkspace') || document.getElementById('filmWorkspaceCard');
  if (ws) ws.hidden = false;
  const titleEl = document.getElementById('filmActiveTitle');
  if (titleEl) titleEl.innerText = `Dự Án: ${proj.title}`;
  const badgeEl = document.getElementById('filmActiveIdBadge');
  if (badgeEl) badgeEl.innerText = proj.id;
  const ruleEl = document.getElementById('filmGlobalRules') || document.getElementById('filmGlobalRuleInput');
  if (ruleEl) ruleEl.value = proj.globalRules || '';

  const assetsList = document.getElementById('filmAssetsList');
  if (assetsList) {
    assetsList.innerHTML = (proj.assets || []).map(a => `
      <div class="film-asset-row">
        <div style="display:flex; align-items:center; gap:10px;">
          ${a.refs?.[0] ? `<img src="/storage/uploads/${escapeHtml(a.refs[0].split(/[\\/]/).pop())}" alt="">` : ''}
          <div>
            <strong>[${escapeHtml((a.kind || a.role || '').toUpperCase())}] ${escapeHtml(a.name)}</strong>
            <div style="font-size:11px; color:var(--text-muted);">Cảnh ${a.sceneStart} → ${a.sceneEnd} • ${escapeHtml(a.note || a.desc || '')}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" style="color:#f87171;" onclick="deleteFilmAsset('${proj.id}', '${a.id}')">✕</button>
      </div>
    `).join('');
  }

  const rulesList = document.getElementById('filmSceneRulesList');
  if (rulesList) {
    rulesList.innerHTML = (proj.sceneRules || []).map(r => `
      <div class="film-asset-row">
        <div>
          <strong>Cảnh ${r.sceneStart} → ${r.sceneEnd}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(r.rulePrompt || r.ruleText || '')}</div>
        </div>
      </div>
    `).join('');
  }
}

async function handleFilmAssetFileSelect(e) {
  const files = Array.from(e.target.files || []).slice(0, 4);
  filmPendingRefBase64 = [];
  for (const f of files) {
    const dataUrl = await fileToDataUrl(f);
    filmPendingRefBase64.push({ name: f.name, dataUrl });
  }
  const fileNameBadge = document.getElementById('filmAssetFileName');
  if (fileNameBadge) fileNameBadge.innerText = `${filmPendingRefBase64.length} file`;
  showToast(`📎 Đã chọn ${filmPendingRefBase64.length} ảnh cho nhân vật/bối cảnh`);
}

async function saveFilmAssetHandler() {
  if (!activeFilmProjectId) return;
  const nameEl = document.getElementById('filmAssetName');
  const name = nameEl?.value?.trim();
  if (!name) return alert('Vui lòng nhập tên nhân vật/bối cảnh!');

  const kindEl = document.getElementById('filmAssetRole') || document.getElementById('filmAssetKind');
  const noteEl = document.getElementById('filmAssetDesc') || document.getElementById('filmAssetNote');
  const startEl = document.getElementById('filmAssetStart');
  const endEl = document.getElementById('filmAssetEnd');

  const item = {
    kind: kindEl?.value || 'character',
    name,
    sceneStart: Number(startEl?.value) || 1,
    sceneEnd: Number(endEl?.value) || 99,
    note: noteEl?.value?.trim() || '',
    base64Files: filmPendingRefBase64
  };

  const res = await fetch(`/api/film-projects/${activeFilmProjectId}/assets/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [item] })
  });
  const json = await res.json();
  if (!json.success) return alert(json.error);

  if (nameEl) nameEl.value = '';
  if (noteEl) noteEl.value = '';
  filmPendingRefBase64 = [];
  await loadFilmProjects();
  selectFilmProject(activeFilmProjectId);
  showToast('👤 Đã lưu tài nguyên vào dự án phim!');
}

async function deleteFilmAsset(projectId, assetId) {
  await fetch(`/api/film-projects/${projectId}/assets/${assetId}`, { method: 'DELETE' });
  await loadFilmProjects();
  selectFilmProject(projectId);
}

async function saveFilmRulesHandler() {
  if (!activeFilmProjectId) return;
  const globalEl = document.getElementById('filmGlobalRules') || document.getElementById('filmGlobalRuleInput');
  const globalRules = (globalEl?.value || '').trim();
  await fetch(`/api/film-projects/${activeFilmProjectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ globalRules })
  });
  await loadFilmProjects();
  showToast('💾 Đã lưu quy tắc toàn cục cho dự án phim!');
}

async function addFilmSceneRuleHandler() {
  if (!activeFilmProjectId) return;
  const proj = filmProjects.find(p => p.id === activeFilmProjectId);
  const ruleEl = document.getElementById('filmRuleText') || document.getElementById('filmRulePrompt');
  const rulePrompt = (ruleEl?.value || '').trim();
  if (!rulePrompt) return;

  const startEl = document.getElementById('filmRuleStart');
  const endEl = document.getElementById('filmRuleEnd');

  const rules = [...(proj.sceneRules || []), {
    sceneStart: Number(startEl?.value) || 1,
    sceneEnd: Number(endEl?.value) || 5,
    rulePrompt
  }];

  await fetch(`/api/film-projects/${activeFilmProjectId}/scene-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules })
  });
  if (ruleEl) ruleEl.value = '';
  await loadFilmProjects();
  selectFilmProject(activeFilmProjectId);
}

async function addFilmScenesToQueueHandler() {
  if (!activeFilmProjectId) return;
  const proj = filmProjects.find(p => p.id === activeFilmProjectId);
  const promptsEl = document.getElementById('filmBatchPrompts') || document.getElementById('filmScenesBatchInput');
  const lines = (promptsEl?.value || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return alert('Vui lòng nhập các dòng cảnh phim!');

  const items = lines.map((line, idx) => ({
    title: `${proj.title} - Cảnh ${idx + 1}`,
    rawScript: line,
    sceneNo: idx + 1
  }));

  const chainEl = document.getElementById('filmChainMode') || document.getElementById('filmAutoContinuity');
  const offsetEl = document.getElementById('filmContinuityOffset');

  const res = await fetch('/api/video-gen/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: proj.defaultStyle || 'cinematic',
      projectId: proj.id,
      chainContinuity: chainEl ? (chainEl.value === 'chain' || chainEl.checked !== false) : true,
      continuityOffset: Number(offsetEl?.value) || 0.8,
      items
    })
  });
  const json = await res.json();
  if (!json.success) return alert(json.error);

  await loadVgQueue();
  showToast(`🚀 Đã đẩy ${json.data.length} cảnh phim nối tiếp sang Hàng Đợi!`);
  switchTab('tab-video-gen');
}

// ============================================================================
// TAB 3: AI PROMPT WRITER (Single & Bulk)
// ============================================================================

async function loadPromptWriterConfig() {
  try {
    const res = await fetch('/api/prompt-writer');
    const json = await res.json();
    if (!json.success) return;
    const data = json.data || json;
    pwState.skills = data.skills || [];
    pwState.profiles = data.profiles || [];

    const skillSel = document.getElementById('pwSkillSelect');
    if (skillSel) {
      skillSel.innerHTML = pwState.skills.map(s =>
        `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.description || '')}</option>`
      ).join('');
    }

    const profSel = document.getElementById('pwProfileSelect');
    if (profSel) {
      profSel.innerHTML = pwState.profiles.map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.model)})</option>`
      ).join('');
    }
  } catch (e) {
    console.error('Lỗi tải cấu hình Prompt Writer:', e);
  }
}

async function runPromptWriterHandler() {
  const btn = document.getElementById('btnPwGenerateSingle') || document.getElementById('btnRunPromptWriter');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Đang viết Prompt bằng AI...';
  }

  try {
    const skillSel = document.getElementById('pwSkillSelect');
    const profSel = document.getElementById('pwProfileSelect');
    const skillId = skillSel?.value;
    const profileId = profSel?.value;

    if (pwState.mode === 'single') {
      const ideaEl = document.getElementById('pwBriefInput') || document.getElementById('pwSingleIdea');
      const idea = (ideaEl?.value || '').trim();
      if (!idea) throw new Error('Vui lòng nhập ý tưởng!');
      const ctxEl = document.getElementById('pwSingleContext');
      const res = await fetch('/api/prompt-writer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          profileId,
          idea,
          context: (ctxEl?.value || '').trim()
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      pwState.lastPrompts = [json.data.prompt];
      const resCard = document.getElementById('pwResultCard');
      if (resCard) resCard.hidden = false;
      const resOut = document.getElementById('pwSingleOutput') || document.getElementById('pwResultOutput');
      if (resOut) resOut.value = json.data.prompt;
    } else {
      const rawIdeas = (document.getElementById('pwBulkBrief')?.value || document.getElementById('pwBulkIdeas')?.value || '').trim();
      if (!rawIdeas) throw new Error('Vui lòng nhập danh sách ý tưởng!');
      const varCount = Number(document.getElementById('pwBulkCount')?.value || document.getElementById('pwVariationCount')?.value) || 2;
      const res = await fetch('/api/prompt-writer/generate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          profileId,
          rawIdeas,
          variationCount: varCount
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const prompts = [];
      for (const item of json.data.items || []) {
        for (const v of item.variations || []) {
          prompts.push(v);
        }
      }
      pwState.lastPrompts = prompts;
      const resCard = document.getElementById('pwBulkResultSection') || document.getElementById('pwResultCard');
      if (resCard) resCard.hidden = false;
      const resOut = document.getElementById('pwResultOutput') || document.getElementById('pwSingleOutput');
      if (resOut) resOut.value = prompts.join('\n\n');
    }
    showToast(`✨ Đã tạo ${pwState.lastPrompts.length} prompt thành công!`);
  } catch (err) {
    alert('Lỗi Prompt Writer: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '✨ Tạo Prompt Bằng AI';
    }
  }
}

function sendPromptsToVideoGen() {
  const textEl = document.getElementById('pwSingleOutput') || document.getElementById('pwResultOutput');
  const text = (textEl?.value || '').trim();
  if (!text) return;
  switchTab('tab-video-gen');
  if (pwState.lastPrompts.length > 1) {
    const btnBatch = document.getElementById('vgModeBatchLines') || document.getElementById('modeBatchBtn');
    btnBatch?.click();
    const batchInput = document.getElementById('vgBatchPromptsInput') || document.getElementById('vgScriptInput');
    if (batchInput) batchInput.value = pwState.lastPrompts.join('\n');
  } else {
    const btnSingle = document.getElementById('vgModeSingle') || document.getElementById('modeSingleBtn');
    btnSingle?.click();
    const scriptInput = document.getElementById('vgScriptInput');
    if (scriptInput) scriptInput.value = text;
  }
  showToast('🚀 Đã đẩy Prompt sang Tab Tạo Video AI!');
}

async function savePwProfileHandler() {
  const nameEl = document.getElementById('pwProfileName') || document.getElementById('pwProfName');
  const name = (nameEl?.value || '').trim();
  const apiKeyEl = document.getElementById('pwApiKey') || document.getElementById('pwProfApiKey');
  const apiKey = (apiKeyEl?.value || '').trim();
  if (!name) return alert('Nhập tên cấu hình!');

  const provEl = document.getElementById('pwProvider') || document.getElementById('pwProfProvider');
  const modelEl = document.getElementById('pwModel') || document.getElementById('pwProfModel');
  const baseEl = document.getElementById('pwProfBaseUrl');

  await fetch('/api/prompt-writer/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      provider: provEl?.value || 'gemini',
      model: (modelEl?.value || '').trim() || 'gemini-2.5-flash',
      baseUrl: (baseEl?.value || '').trim(),
      apiKey
    })
  });
  await loadPromptWriterConfig();
  showToast('💾 Đã lưu cấu hình AI Profile!');
}

async function savePwSkillHandler() {
  const nameEl = document.getElementById('pwSkillName');
  const name = (nameEl?.value || '').trim();
  const promptEl = document.getElementById('pwSkillInstructions') || document.getElementById('pwSkillPrompt');
  const systemPrompt = (promptEl?.value || '').trim();
  if (!name || !systemPrompt) return alert('Vui lòng nhập tên và hướng dẫn hệ thống!');

  await fetch('/api/prompt-writer/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, systemPrompt })
  });
  if (nameEl) nameEl.value = '';
  if (promptEl) promptEl.value = '';
  await loadPromptWriterConfig();
  showToast('🎯 Đã thêm kỹ năng viết Prompt mới!');
}

// ============================================================================
// TAB 4: MULTI-ACCOUNT & PROXY POOL
// ============================================================================

async function loadAccounts() {
  try {
    const res = await fetch('/api/accounts');
    const json = await res.json();
    if (!json.success) return;
    const data = json.data || json;
    accountsList = data.accounts || [];
    const stats = data.stats || {};

    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    safeSet('statAccountsReady', `${stats.activeAccounts || 0}/${stats.totalAccounts || 0}`);
    safeSet('accStatTotal', stats.totalAccounts || accountsList.length);
    safeSet('accStatValid', stats.activeAccounts || accountsList.filter(a => a.status === 'ready').length);
    safeSet('accStatProxy', stats.proxyAccounts || accountsList.filter(a => a.proxy).length);
    safeSet('accStatExpired', stats.expiredAccounts || accountsList.filter(a => a.status !== 'ready').length);

    renderAccountsTable();
  } catch (e) {
    console.error('Lỗi tải tài khoản:', e);
  }
}

function renderAccountsTable() {
  const tbody = document.getElementById('accountsTableBody') || document.getElementById('accountsTableRows');
  if (!tbody) return;
  if (accountsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Chưa có tài khoản nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = accountsList.map(acc => `
    <tr>
      <td>
        <strong>${escapeHtml(acc.name)}</strong>
        <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(acc.email || acc.id)}</div>
      </td>
      <td><span class="badge">${escapeHtml(acc.provider)}</span></td>
      <td style="font-family:var(--font-mono); font-size:11.5px; color:#38bdf8;">
        ${acc.proxy ? escapeHtml(acc.proxy) : '<span style="color:var(--text-muted);">Direct IP</span>'}
      </td>
      <td>${acc.cookieCount || 0} cookies</td>
      <td>
        <span class="badge" style="color:${acc.status === 'ready' ? '#34d399' : '#fbbf24'};">
          ${escapeHtml(acc.status)}
        </span>
      </td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="checkAccountHealth('${acc.id}')">🔍 Check</button>
          <button class="btn btn-secondary btn-sm" onclick="openAccountChrome('${acc.id}')">🌐 Mở Chrome</button>
          <button class="btn btn-secondary btn-sm" style="color:#f87171;" onclick="deleteAccount('${acc.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function addAccountHandler() {
  const nameEl = document.getElementById('accNewName') || document.getElementById('accNameInput');
  const name = nameEl?.value?.trim();
  if (!name) return alert('Nhập tên gợi nhớ cho tài khoản!');

  const proxyEl = document.getElementById('accNewProxy') || document.getElementById('accProxyInput');
  const cookieEl = document.getElementById('accNewCookie') || document.getElementById('accCookieInput');
  const emailEl = document.getElementById('accEmailInput');
  const providerEl = document.getElementById('accProviderInput');

  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email: emailEl?.value?.trim() || '',
      provider: providerEl?.value || 'gemini',
      proxy: proxyEl?.value?.trim() || ''
    })
  });
  const json = await res.json();
  if (!json.success) return alert(json.error);

  const cookieRaw = cookieEl?.value?.trim();
  if (cookieRaw) {
    await fetch(`/api/accounts/${json.data.id}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies: cookieRaw })
    });
  }

  if (nameEl) nameEl.value = '';
  if (proxyEl) proxyEl.value = '';
  if (cookieEl) cookieEl.value = '';
  if (emailEl) emailEl.value = '';
  await loadAccounts();
  showToast('➕ Đã thêm tài khoản vào Pool!');
}

async function assignBulkProxiesHandler() {
  const rawProxies = (document.getElementById('bulkProxyText')?.value || document.getElementById('bulkProxyInput')?.value || '').trim();
  if (!rawProxies) return alert('Vui lòng dán danh sách Proxy!');

  const res = await fetch('/api/accounts/assign-proxies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawProxies })
  });
  const json = await res.json();
  if (!json.success) return alert(json.error);

  await loadAccounts();
  showToast(`🌐 Đã gán tự động ${json.data.assignedCount} Proxy vào các tài khoản!`);
}

async function checkAccountHealth(id) {
  const res = await fetch(`/api/accounts/${id}/check`, { method: 'POST' });
  const json = await res.json();
  await loadAccounts();
  if (json.data) showToast(`🔍 ${json.data.message}`);
}

async function openAccountChrome(id) {
  showToast('🌐 Đang mở Chrome Profile riêng cho tài khoản...');
  await fetch(`/api/accounts/${id}/login`, { method: 'POST' });
}

async function deleteAccount(id) {
  if (!confirm('Xóa tài khoản này?')) return;
  await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  await loadAccounts();
}

// ============================================================================
// TAB 5: UNIFIED OUTPUT LIBRARY
// ============================================================================

async function loadUnifiedLibrary() {
  try {
    const res = await fetch('/api/library');
    const json = await res.json();
    if (!json.success) return;
    unifiedLibrary = json.items || json.data || [];
    renderUnifiedLibrary();
  } catch (e) {
    console.error('Lỗi tải thư viện hợp nhất:', e);
  }
}

function renderUnifiedLibrary() {
  const grid = document.getElementById('unifiedLibraryGrid');
  const countBadge = document.getElementById('libTotalCount');
  if (!grid) return;

  const filtered = unifiedLibrary.filter(item => {
    if (activeLibFilter === 'all') return true;
    return item.source === activeLibFilter;
  });

  if (countBadge) countBadge.innerText = `${filtered.length}`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:32px; color:var(--text-muted);">Chưa có video nào trong phân mục này.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(v => `
    <div class="video-card">
      <div class="video-player-wrap">
        <video controls preload="metadata" src="${escapeHtml(v.videoUrl)}"></video>
      </div>
      <div class="video-info-box">
        <div class="video-title">${escapeHtml(v.title)}</div>
        <div class="video-meta">
          <span class="badge badge-accent">${escapeHtml(v.source.toUpperCase())} • ${escapeHtml(v.style || '')}</span>
          <span>${escapeHtml(v.aspectRatio || '9:16')}</span>
        </div>
        <div class="video-card-actions">
          <a class="btn btn-secondary" href="${escapeHtml(v.videoUrl)}" download style="text-decoration:none;">⬇️ Tải MP4</a>
          ${v.source !== 'douyin'
            ? `<button class="btn btn-secondary" onclick="vgSendToRemake('${v.id}')">⚡ Remake</button>`
            : `<button class="btn btn-secondary" onclick="switchToRemake('${v.id}')">⚡ Remake</button>`}
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// TABS 6–9: EXISTING DOUYIN DOWNLOAD, FFMPEG REMAKE, AUTOPILOT & MINIO
// ============================================================================

async function loadVideos() {
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    if (data.success) {
      videoLibrary = data.videos || [];
      renderVideoGrid();
      updateSelectDropdowns();
      const statEl = document.getElementById('statDouyinCount');
      if (statEl) statEl.innerText = videoLibrary.length;
    }
  } catch (err) {
    console.error('Lỗi load video:', err);
  }
}

function renderVideoGrid() {
  const grid = document.getElementById('video-grid');
  const countEl = document.getElementById('video-count');
  if (countEl) countEl.innerText = videoLibrary.length;
  if (!grid) return;

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
            MD5: ${(isRemade ? v.remadeMd5 : v.originalMd5)?.slice(0, 16) || 'N/A'}...
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

  if (remakeSelect) remakeSelect.innerHTML = options;
  if (minioSelect) minioSelect.innerHTML = options;
}

async function handleDownload() {
  const input = document.getElementById('input-douyin-url');
  const rawUrl = input.value.trim();
  if (!rawUrl) return alert('Vui lòng dán link video Douyin!');

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
    if (!res.ok || !data.success) throw new Error(data.error || 'Tải video thất bại');

    progressText.innerText = 'Tải video thành công!';
    input.value = '';
    await loadVideos();
    setTimeout(() => progressBox.classList.add('hidden'), 2000);
  } catch (err) {
    alert('Lỗi: ' + err.message);
    progressBox.classList.add('hidden');
  } finally {
    btnDownload.disabled = false;
  }
}

function switchToRemake(id) {
  switchTab('tab-remake');
  const select = document.getElementById('select-remake-video');
  if (select) select.value = id;
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
  if (!id) return alert('Vui lòng chọn video cần remake!');

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
    if (!res.ok || !data.success) throw new Error(data.error || 'Remake thất bại');

    showToast('✅ Đã Remake video thành công!');
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

function switchToMinio(id) {
  switchTab('tab-minio');
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
    alertBox.classList.add(data.success ? 'success' : 'error');
    alertBox.innerText = (data.success ? '✓ ' : '✗ ') + data.message;
  } catch (err) {
    alertBox.classList.add('error');
    alertBox.innerText = '✗ Lỗi kết nối: ' + err.message;
  }
}

async function handleUploadMinio() {
  const select = document.getElementById('select-minio-video');
  const id = select.value;
  if (!id) return alert('Vui lòng chọn video cần đẩy lên MinIO!');

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
    if (!res.ok || !data.success) throw new Error(data.error || 'Upload MinIO thất bại');

    const resultBox = document.getElementById('minio-upload-result');
    resultBox.classList.remove('hidden');
    document.getElementById('res-s3-key').innerText = data.data.key;
    const link = document.getElementById('res-presigned-url');
    link.href = data.data.presignedUrl;
    link.innerText = 'Xem video trực tiếp (Presigned URL)';
    showToast('☁️ Đã đẩy video lên MinIO thành công!');
    await loadVideos();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '☁️ Upload Lên MinIO Bucket';
  }
}

async function deleteVideo(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa video này?')) return;
  await fetch(`/api/videos/${id}`, { method: 'DELETE' });
  await loadVideos();
}

// Autopilot functions
let autopilotState = { isRunning: false };

async function loadAutopilotData() {
  try {
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
      queueList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Hàng đợi trống.</div>`;
    }

    const logsBox = document.getElementById('autopilot-logs-box');
    if (statusData.recentLogs && statusData.recentLogs.length > 0) {
      logsBox.innerHTML = statusData.recentLogs.map(l => `
        <div style="margin-bottom: 6px;">
          <span style="color: var(--text-muted);">[${l.time}]</span>
          <strong style="color: ${l.type === 'SUCCESS' ? '#34d399' : l.type === 'ERROR' ? '#f87171' : '#38bdf8'};">[${l.type}]</strong>
          <span>${escapeHtml(l.message)}</span>
        </div>
      `).join('');
    }

    checkTikTokLoginStatus();
    loadTargets();
  } catch (err) {
    console.error('Lỗi load Autopilot data:', err);
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
  } catch (_e) {
    badge.innerText = 'Chưa Kết Nối';
  }
}

async function handleToggleAutopilot() {
  const nextState = !autopilotState.isRunning;
  const res = await fetch('/api/autopilot/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: nextState })
  });
  const data = await res.json();
  if (data.success) await loadAutopilotData();
}

async function handleSaveTikTokCookie() {
  const input = document.getElementById('input-tiktok-cookie');
  const val = input.value.trim();
  if (!val) return alert('Vui lòng dán chuỗi cookie hoặc mã sessionid từ TikTok!');
  const res = await fetch('/api/tiktok/save-cookie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie: val })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Lỗi lưu cookie');
  showToast('💾 ' + data.message);
  input.value = '';
  await checkTikTokLoginStatus();
}

async function handleOpenTikTokLogin() {
  const res = await fetch('/api/tiktok/login-window', { method: 'POST' });
  const data = await res.json();
  alert(data.message || 'Cửa sổ đăng nhập TikTok đã mở!');
  setTimeout(checkTikTokLoginStatus, 5000);
}

async function handleCloseTikTokLogin() {
  const res = await fetch('/api/tiktok/close-login', { method: 'POST' });
  const data = await res.json();
  showToast('💾 ' + (data.message || 'Đã lưu phiên làm việc!'));
  await checkTikTokLoginStatus();
}

async function handleManualScan() {
  await fetch('/api/autopilot/scan-channels', { method: 'POST' });
  showToast('🔄 Đã kích hoạt quét kênh mục tiêu!');
  setTimeout(loadAutopilotData, 3000);
}

async function handlePostNow() {
  if (!confirm('Bạn có muốn tự động lấy 1 video trong hàng đợi và đăng ngay lên TikTok?')) return;
  const res = await fetch('/api/autopilot/post-now', { method: 'POST' });
  const data = await res.json();
  showToast(data.success ? '✓ Đã đăng video lên TikTok!' : (data.message || data.error));
  await loadAutopilotData();
}

async function loadTargets() {
  try {
    const res = await fetch('/api/targets');
    const data = await res.json();
    const list = document.getElementById('targets-list');
    if (list && data.targets) {
      list.innerHTML = data.targets.map(t => `
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
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}
