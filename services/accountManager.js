// services/accountManager.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DEFAULT_PROFILE_DIR = path.join(__dirname, '..', 'storage', 'chrome-muse-profile');

function createAccountManager(dataFile) {
  const activeLoginBrowsers = new Map();

  function getDb() {
    if (fs.existsSync(dataFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          return parsed;
        }
      } catch (e) {
        // fallback below
      }
    }
    const now = new Date().toISOString();
    return {
      accounts: [
        {
          id: 'acc_muse_primary',
          name: 'Muse.ai Chính (Ưu tiên #1 · CDP 9222)',
          provider: 'muse',
          profile_path: DEFAULT_PROFILE_DIR,
          cdp_port: 9222,
          proxy: null,
          enabled: true,
          auth_status: 'valid',
          auth_checked_at: now,
          auth_error: null,
          balance: '🚀 Ưu tiên #1 · Muse.ai Video Studio',
          cookies_count: 0,
          created_at: now,
        },
        {
          id: 'acc_default',
          name: 'Gemini Ultra (Dự phòng #2 · CDP 9222)',
          provider: 'gemini',
          profile_path: DEFAULT_PROFILE_DIR,
          cdp_port: 9222,
          proxy: null,
          enabled: true,
          auth_status: 'valid',
          auth_checked_at: now,
          auth_error: null,
          balance: '⚡ Ưu tiên #2 · Gemini Ultra Veo',
          cookies_count: 0,
          created_at: now,
        },
      ],
    };
  }

  function saveDb(db) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
  }

  function listAccounts() {
    return getDb().accounts;
  }

  function getAccount(id) {
    return getDb().accounts.find((a) => a.id === id) || null;
  }

  function getNextAvailableAccount() {
    const accounts = getDb().accounts.filter((a) => a.enabled);
    return accounts[0] || getDb().accounts[0] || null;
  }

  function addAccount({ name, profile_path = null, proxy = null, cdp_port = null }) {
    const db = getDb();
    const index = db.accounts.length + 1;
    const cleanName = (name || `Gemini Acc #${index}`).trim();
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const resolvedProfile =
      profile_path && profile_path.trim()
        ? profile_path.trim()
        : path.join(__dirname, '..', 'storage', 'profiles', id);

    const now = new Date().toISOString();
    const account = {
      id,
      name: cleanName,
      profile_path: resolvedProfile,
      cdp_port: cdp_port || 9222 + index,
      proxy: proxy ? formatProxyString(proxy) : null,
      enabled: true,
      auth_status: 'unknown',
      auth_checked_at: null,
      auth_error: null,
      balance: 'Chưa quét số dư',
      cookies_count: 0,
      created_at: now,
    };
    db.accounts.push(account);
    saveDb(db);
    return account;
  }

  function updateAccount(id, updates) {
    const db = getDb();
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
    if (updates.name !== undefined) acc.name = String(updates.name).trim() || acc.name;
    if (updates.proxy !== undefined) acc.proxy = updates.proxy ? formatProxyString(updates.proxy) : null;
    if (updates.profile_path !== undefined && updates.profile_path) acc.profile_path = updates.profile_path;
    if (updates.enabled !== undefined) acc.enabled = Boolean(updates.enabled);
    if (updates.auth_status !== undefined) acc.auth_status = updates.auth_status;
    if (updates.balance !== undefined) acc.balance = updates.balance;
    saveDb(db);
    return acc;
  }

  function toggleAccount(id) {
    const db = getDb();
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
    acc.enabled = !acc.enabled;
    saveDb(db);
    return acc;
  }

  function deleteAccounts(ids = []) {
    const db = getDb();
    const set = new Set(ids);
    db.accounts = db.accounts.filter((a) => !set.has(a.id));
    if (db.accounts.length === 0) {
      const now = new Date().toISOString();
      db.accounts.push({
        id: 'acc_default',
        name: 'Gemini Ultra Chính (CDP 9222)',
        profile_path: DEFAULT_PROFILE_DIR,
        cdp_port: 9222,
        proxy: null,
        enabled: true,
        auth_status: 'valid',
        auth_checked_at: now,
        auth_error: null,
        balance: 'Gemini Ultra · Unlimited Web',
        cookies_count: 0,
        created_at: now,
      });
    }
    saveDb(db);
    return { deleted: ids.length };
  }

  function formatProxyString(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/^(https?|socks5):\/\//i.test(s)) return s;
    const parts = s.split(':');
    if (parts.length === 4) {
      const [host, port, user, pass] = parts;
      return `http://${user}:${pass}@${host}:${port}`;
    }
    if (parts.length === 2) {
      return `http://${parts[0]}:${parts[1]}`;
    }
    return s;
  }

  function assignProxiesBulk({ account_ids = [], proxies_text = '', create_missing = true }) {
    const lines = String(proxies_text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) throw new Error('Danh sách Proxy trống');

    const db = getDb();
    let targets = account_ids.length
      ? db.accounts.filter((a) => account_ids.includes(a.id))
      : db.accounts;

    let assigned = 0;
    let created = 0;

    for (let i = 0; i < lines.length; i++) {
      const formatted = formatProxyString(lines[i]);
      if (i < targets.length) {
        targets[i].proxy = formatted;
        assigned++;
      } else if (create_missing) {
        const index = db.accounts.length + 1;
        const id = `acc_${Date.now()}_${i}`;
        db.accounts.push({
          id,
          name: `Gemini Proxy Acc #${index}`,
          profile_path: path.join(__dirname, '..', 'storage', 'profiles', id),
          cdp_port: 9222 + index,
          proxy: formatted,
          enabled: true,
          auth_status: 'unknown',
          auth_checked_at: null,
          auth_error: null,
          balance: 'Chưa đăng nhập',
          cookies_count: 0,
          created_at: new Date().toISOString(),
        });
        created++;
        assigned++;
      }
    }

    saveDb(db);
    return { assigned, created, accounts: db.accounts };
  }

  function saveAccountCookies(id, rawCookieInput, extraMeta = {}) {
    const db = getDb();
    let acc = db.accounts.find((a) => a.id === id);
    if (!acc && extraMeta.createIfMissing) {
      acc = {
        id: id || `acc_${Date.now()}`,
        name: extraMeta.label || `Account ${db.accounts.length + 1}`,
        profile_path: path.join(__dirname, '..', 'storage', 'profiles', `acc_${Date.now()}`),
        cdp_port: 9222 + db.accounts.length + 1,
        proxy: null,
        enabled: true,
        auth_status: 'valid',
        auth_checked_at: new Date().toISOString(),
        auth_error: null,
        balance: extraMeta.balance || 'Sẵn sàng (LIVE)',
        cookies_count: 0,
        created_at: new Date().toISOString(),
      };
      db.accounts.push(acc);
    }
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);

    let cookiesList = [];
    const text = typeof rawCookieInput === 'string' ? rawCookieInput.trim() : JSON.stringify(rawCookieInput);
    if (!text) throw new Error('Dữ liệu Cookie trống');

    if (text.startsWith('[') || text.startsWith('{')) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        cookiesList = parsed;
      } else if (parsed.cookie_editor && Array.isArray(parsed.cookie_editor)) {
        cookiesList = parsed.cookie_editor;
        if (parsed.balance) acc.balance = parsed.balance;
        if (parsed.label) acc.name = parsed.label;
      } else if (parsed.cookies && typeof parsed.cookies === 'object') {
        cookiesList = Object.entries(parsed.cookies).map(([name, value]) => ({
          name,
          value: String(value),
          domain: '.google.com',
          path: '/',
        }));
        if (parsed.balance) acc.balance = parsed.balance;
      }
    } else {
      cookiesList = text
        .split(';')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const eq = pair.indexOf('=');
          const name = eq > -1 ? pair.slice(0, eq).trim() : pair;
          const value = eq > -1 ? pair.slice(eq + 1).trim() : '';
          return { name, value, domain: '.google.com', path: '/' };
        });
    }

    fs.mkdirSync(acc.profile_path, { recursive: true });
    fs.writeFileSync(
      path.join(acc.profile_path, 'imported_cookies.json'),
      JSON.stringify(cookiesList, null, 2)
    );

    acc.cookies_count = cookiesList.length;
    acc.auth_status = cookiesList.length > 0 ? 'valid' : 'expired';
    acc.auth_checked_at = new Date().toISOString();
    if (!acc.balance || acc.balance === 'Chưa quét số dư' || acc.balance === 'Chưa đăng nhập') {
      acc.balance = '⚡ Sẵn sàng (LIVE)';
    }
    saveDb(db);
    return { authenticated: acc.auth_status === 'valid', account: acc, cookiesCount: cookiesList.length };
  }

  async function checkAccountHealth(id) {
    const db = getDb();
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);

    acc.auth_checked_at = new Date().toISOString();
    const cookieFile = path.join(acc.profile_path || '', 'imported_cookies.json');
    if (acc.id === 'acc_default' || fs.existsSync(cookieFile) || fs.existsSync(acc.profile_path || '')) {
      acc.auth_status = 'valid';
      acc.auth_error = null;
      if (!acc.balance || acc.balance.includes('Chưa')) {
        acc.balance = '⚡ Gemini Ultra · LIVE';
      }
    } else {
      acc.auth_status = 'expired';
      acc.auth_error = 'Chưa có phiên đăng nhập hoặc cookie trong profile';
    }
    saveDb(db);
    return { status: acc.auth_status, account: acc };
  }

  async function openAccountLoginWindow(id) {
    const acc = getAccount(id);
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
    fs.mkdirSync(acc.profile_path, { recursive: true });

    const launchOpts = {
      headless: false,
      args: [`--remote-debugging-port=${acc.cdp_port || 9222}`],
    };
    if (acc.proxy) {
      launchOpts.proxy = { server: acc.proxy };
    }

    const context = await chromium.launchPersistentContext(acc.profile_path, launchOpts);
    activeLoginBrowsers.set(id, context);
    const page1 = context.pages()[0] || (await context.newPage());
    await page1.goto('https://muse.ai', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const page2 = await context.newPage();
    await page2.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page1.bringToFront().catch(() => {});
    updateAccount(id, { auth_status: 'valid', balance: '🚀 Muse.ai #1 + Gemini Ultra #2 · LIVE' });
    return { opened: true, accountId: id };
  }

  async function closeAccountLoginWindow(id) {
    const ctx = activeLoginBrowsers.get(id);
    if (ctx) {
      await ctx.close().catch(() => {});
      activeLoginBrowsers.delete(id);
    }
    return { closed: true };
  }

  function getAccountDetails(id, allProjects = []) {
    const acc = getAccount(id);
    if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
    const tasks = allProjects.filter((p) => (p.accountId || 'acc_default') === id);
    const dailyMap = new Map();
    for (const t of tasks) {
      const day = (t.createdAt || new Date().toISOString()).slice(0, 10);
      const row = dailyMap.get(day) || { day, done_count: 0, error_count: 0 };
      if (t.status === 'done') row.done_count++;
      if (['failed', 'media_failed', 'needs_review'].includes(t.status)) row.error_count++;
      dailyMap.set(day, row);
    }
    return {
      account: acc,
      daily: Array.from(dailyMap.values()),
      recent: tasks.slice(0, 20).map((t) => ({
        id: t.id,
        kind: 'video',
        prompt: t.rawScript || t.title,
        status: t.status,
        thread_url: t.threadUrl || null,
        updated_at: t.updatedAt || t.createdAt,
      })),
    };
  }

  return {
    listAccounts,
    getAccount,
    getNextAvailableAccount,
    addAccount,
    updateAccount,
    toggleAccount,
    deleteAccounts,
    formatProxyString,
    assignProxiesBulk,
    saveAccountCookies,
    checkAccountHealth,
    openAccountLoginWindow,
    closeAccountLoginWindow,
    getAccountDetails,
  };
}

const defaultAccFile = path.join(__dirname, '..', 'storage', 'accounts.json');
const defaultAccManager = createAccountManager(defaultAccFile);

module.exports = { createAccountManager, ...defaultAccManager };
