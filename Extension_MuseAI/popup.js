const $ = (id) => document.getElementById(id);
let currentPayload = null;

function showLog(msg) {
  const el = $('log');
  el.className = 'show';
  el.innerText = msg;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || '';
  let domain = 'google.com';
  let platform = 'Gemini Ultra (Google)';
  if (url.includes('tiktok.com')) {
    domain = 'tiktok.com';
    platform = 'TikTok Studio';
  } else if (url.includes('muse.ai')) {
    domain = 'muse.ai';
    platform = 'Muse.ai';
  }
  $('platformName').innerText = platform;
  const all = await chrome.cookies.getAll({ domain });
  $('cookieCount').innerText = `${all.length} cookies`;
  const defaultLabel = `${platform.split(' ')[0]}_${new Date().toISOString().slice(11, 16).replace(':', '')}`;
  $('labelInput').value = defaultLabel;

  const cookies = {};
  const cookieEditorList = all.map((c) => {
    cookies[c.name] = c.value;
    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
    };
  });

  currentPayload = {
    label: defaultLabel,
    platform,
    domain,
    status: all.length > 0 ? 'LIVE' : 'EMPTY',
    balance: `${platform} · LIVE`,
    cookies,
    cookie_editor: cookieEditorList,
    exported_at: new Date().toISOString(),
  };
}

$('btnSync').addEventListener('click', async () => {
  if (!currentPayload) return;
  currentPayload.label = $('labelInput').value.trim() || currentPayload.label;
  try {
    const res = await fetch('http://127.0.0.1:3050/api/accounts/sync-extension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPayload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showLog(`✓ Đã đồng bộ "${currentPayload.label}" (${currentPayload.cookie_editor.length} cookies) vào Studio cổng 3050!`);
    } else {
      showLog('⚠️ Lỗi đồng bộ: ' + (data.error || res.status));
    }
  } catch (e) {
    showLog('⚠️ Không kết nối được localhost:3050. Hãy bật server trước!');
  }
});

$('btnCopy').addEventListener('click', async () => {
  if (!currentPayload) return;
  currentPayload.label = $('labelInput').value.trim() || currentPayload.label;
  await navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
  showLog('📋 Đã sao chép Cookie JSON vào Clipboard!');
});

$('btnExport').addEventListener('click', () => {
  if (!currentPayload) return;
  currentPayload.label = $('labelInput').value.trim() || currentPayload.label;
  const blob = new Blob([JSON.stringify(currentPayload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cookies_${currentPayload.label}.json`;
  a.click();
  showLog('💾 Đã tải xuống file JSON!');
});

init();
