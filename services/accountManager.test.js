// services/accountManager.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAccountManager } = require('./accountManager');

function tempAccFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-acc-')), 'accounts.json');
}

test('initializes with default Gemini Ultra account and supports bulk proxy assignment + cookie import', () => {
  const mgr = createAccountManager(tempAccFile());
  const initial = mgr.listAccounts();
  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'acc_default');

  const bulk = mgr.assignProxiesBulk({
    account_ids: [],
    proxies_text: '103.1.2.3:8080:user1:pass1\n103.1.2.4:9090:user2:pass2',
    create_missing: true,
  });
  assert.equal(bulk.assigned, 2);
  assert.equal(bulk.created, 1);
  assert.equal(bulk.accounts[0].proxy, 'http://user1:pass1@103.1.2.3:8080');
  assert.equal(bulk.accounts[1].proxy, 'http://user2:pass2@103.1.2.4:9090');

  const cookieRes = mgr.saveAccountCookies(bulk.accounts[1].id, 'SID=abc123xyz; HSID=def456');
  assert.equal(cookieRes.authenticated, true);
  assert.equal(cookieRes.cookiesCount, 2);
});
