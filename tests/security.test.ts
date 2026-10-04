import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

test('private Sheets endpoints require authentication and reject cross-origin writes', async () => {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', GOOGLE_SHEET_ID: 'test-sheet', GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@example.invalid', GOOGLE_PRIVATE_KEY: 'not-a-real-key', APP_PASSWORD: 'test-password-only', SESSION_SECRET: 'a-test-only-session-secret-with-32-characters' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test server did not start.')), 15000);
      child.stdout!.on('data', chunk => { if (String(chunk).includes('running at')) { clearTimeout(timeout); resolve(); } });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { if (code) { clearTimeout(timeout); reject(new Error(`Test server exited: ${code}`)); } });
    });
    const root = `http://127.0.0.1:${port}/api/`;
    assert.equal((await fetch(`${root}state`)).status, 401);
    for (const endpoint of ['actions', 'check-ins', 'leak-reviews', 'expense-funding', 'income-sources', 'settings', 'month-reviews']) {
      assert.equal((await fetch(root + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    }
    const invalid = await fetch(`${root}login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) });
    assert.equal(invalid.status, 401);
    const cross = await fetch(`${root}login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: JSON.stringify({ password: 'test-password-only' }) });
    assert.equal(cross.status, 403);
    const form = await fetch(`${root}login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=test-password-only' });
    assert.equal(form.status, 415);
    const login = await fetch(`${root}login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` }, body: JSON.stringify({ password: 'test-password-only' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    const authenticated = await fetch(`${root}status`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal((await authenticated.json()).authenticated, true);
    const tampered = await fetch(`${root}status`, { headers: { Cookie: cookie.split(';')[0] + 'tampered' } });
    assert.equal((await tampered.json()).authenticated, false);
    const logout = await fetch(`${root}logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.match(logout.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
  } finally { child.kill(); }
});
