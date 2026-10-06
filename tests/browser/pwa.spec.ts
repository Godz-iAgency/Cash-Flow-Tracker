import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('manifest, home-screen icons and service worker are valid; private responses stay out of caches', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Cash Flow Tracker'); expect(manifest.display).toBe('standalone'); expect(manifest.start_url).toBe('/');
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const size = await page.evaluate(async src => { const image = new Image(); image.src = src; await image.decode(); return `${image.naturalWidth}x${image.naturalHeight}`; }, icon.src);
    expect(size).toBe(icon.sizes);
  }
  const session = await page.context().newCDPSession(page);
  // Playwright's isolated contexts are incognito, where Chrome prohibits installation.
  // Every application-related installability check must still pass.
  const result = await session.send('Page.getInstallabilityErrors');
  expect(result.installabilityErrors.filter(error => error.errorId !== 'in-incognito')).toEqual([]);
  await page.evaluate(async () => { await fetch('/api/status'); await fetch('/api/state'); });
  const urls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(r => r.url)))).flat());
  expect(urls.length).toBe(6); expect(urls.every(url => !url.includes('/api/'))).toBe(true);
  await page.context().setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Connect to open your tracker' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Connect to the internet');
  await page.context().setOffline(false); await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
});

test('iPhone installation help fits small screens and does not submit the Google sign-in form', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  try {
    const page = await context.newPage();
    await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: false, backend: 'firestore', firebase: { projectId: 'test', apiKey: 'test', appId: 'test', authDomain: 'test.firebaseapp.com' } } }));
    await page.goto('/'); await page.getByRole('button', { name: 'Install app', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Install Cash Flow' }); await expect(dialog).toBeVisible(); await expect(dialog).toContainText('Add to Home Screen');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.locator('.form-error')).toHaveCount(0);
  } finally { await context.close(); }
});

test('a new version waits while a financial draft is open and updates only on request', async ({ page, context }) => {
  let version = 1;
  const worker = await readFile('dist/sw.js', 'utf8');
  await context.route('**/sw.js', route => route.fulfill({ contentType: 'application/javascript', headers: { 'Cache-Control': 'no-store' }, body: worker + `\n// test version ${version}\n` }));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  const form = page.getByRole('dialog'); await form.locator('#amount').fill('12.34'); await form.getByRole('combobox', { name: 'What for' }).fill('Unsaved draft');
  const before = await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'));
  version = 2;
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
  await expect(form.getByRole('combobox', { name: 'What for' })).toHaveValue('Unsaved draft'); expect(await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'))).toBe(before);
  await form.getByRole('button', {name:'Close dialog'}).click();
  await page.getByRole('button', {name:'Advanced',exact:true}).click(); await page.getByRole('button', { name: 'Update app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration())?.waiting);
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'))).toBe(before);
});
