import { test, expect, type Page } from '@playwright/test';
import { initialState } from '../../shared/seed';

const confirmation = 'I have kept a backup and reviewed these records.';
const importButton = 'Import & open tracker';
function backupFile(name = 'cash-flow-backup.json') { return { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initialState())) }; }
async function emptyCloud(page: Page) {
  await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: true, backend: 'firestore', aiEnabled: false } }));
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: false } }));
}

for (const width of [320, 497, 1440]) test(`reviewed cloud import preserves device data and requires confirmation at ${width}px`, async ({ page }) => {
  const source = initialState(); let imported = false; let payload: any;
  await page.addInitScript(data => localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)), source);
  await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: true, backend: 'firestore', aiEnabled: false } }));
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: imported } }));
  await page.route('**/api/cloud/import', async route => { payload = route.request().postDataJSON(); imported = true; await route.fulfill({ json: payload.state }); });
  await page.route('**/api/state', route => route.fulfill({ json: source }));
  await page.setViewportSize({ width, height: 650 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Set up cloud storage' })).toBeVisible();
  expect(imported).toBe(false);
  await page.getByRole('button', { name: 'Review this device' }).click();
  const submit = page.getByRole('button', { name: importButton });
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I have kept a backup and reviewed these records.' }).check();
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(payload).toEqual({ confirmed: true, state: source });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(source);
});

test('invalid backup stays in review and sends no import request', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: true, backend: 'firestore' } }));
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: false } }));
  await page.route('**/api/cloud/import', route => { writes++; return route.fulfill({ status: 400, json: { error: 'Invalid backup.' } }); });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"accounts":[]}') });
  await expect(page.getByRole('alert')).toContainText('saved financial data');
  expect(writes).toBe(0); await expect(page.getByRole('button', { name: importButton })).toHaveCount(0);
});

for (const { width, scale } of [{ width: 320, scale: 1 }, { width: 497, scale: 1 }, { width: 1440, scale: 1 }, { width: 320, scale: 2 }]) test(`JSON picker opens tracker after review at ${width}px and ${scale * 100}% text`, async ({ page }) => {
  const source = initialState(); let imported = false; let payload: unknown;
  await emptyCloud(page);
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: imported } }));
  await page.route('**/api/cloud/import', async route => { payload = route.request().postDataJSON(); imported = true; await route.fulfill({ json: source }); });
  await page.route('**/api/state', route => route.fulfill({ json: source }));
  await page.setViewportSize({ width, height: 450 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Set up cloud storage' })).toBeVisible();
  await page.evaluate(value => document.documentElement.style.fontSize = `${value * 100}%`, scale);
  await expect(page.getByText('No records are saved in this browser at this address.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review this device' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: importButton })).toHaveCount(0);
  expect(imported).toBe(false);
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose JSON backup' }).click();
  await (await picker).setFiles(backupFile('cash-flow-backup-2026-10-04.json'));
  await expect(page.getByRole('heading', { name: 'Review your backup' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'cash-flow-backup-2026-10-04.json' })).toBeVisible();
  const submit = page.getByRole('button', { name: importButton });
  await expect(submit).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('.cloud-setup .field-hint').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14 * scale);
  expect(await submit.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16 * scale);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.move(width / 2, 300); await page.mouse.wheel(0, 1000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.getByRole('checkbox', { name: confirmation }).check();
  await submit.scrollIntoViewIfNeeded(); await expect(submit).toBeInViewport();
  if (width === 497) await page.screenshot({ path: '.local/screenshots/cloud-backup-review-497.png', fullPage: true });
  await submit.click(); await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(payload).toEqual({ confirmed: true, state: source });
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'))).toBeNull();
});

test('changing the backup clears review confirmation and allows selecting the same file again', async ({ page }) => {
  await emptyCloud(page); await page.goto('/');
  const input = page.locator('input[type=file]');
  await input.setInputFiles(backupFile());
  await page.getByRole('checkbox', { name: confirmation }).check();
  await page.getByRole('button', { name: 'Choose different records' }).click();
  await expect(page.getByRole('heading', { name: 'Set up cloud storage' })).toBeVisible();
  await input.setInputFiles(backupFile());
  await expect(page.getByRole('checkbox', { name: confirmation })).not.toBeChecked();
  await expect(page.getByRole('button', { name: importButton })).toBeDisabled();
  await page.getByRole('button', { name: 'Choose different records' }).click();
  await input.setInputFiles({ name: 'too-large.json', mimeType: 'application/json', buffer: Buffer.alloc(2_000_001, ' ') });
  await expect(page.getByRole('alert')).toContainText('smaller than 2 MB');
  await expect(page.getByRole('button', { name: importButton })).toHaveCount(0);
  await input.setInputFiles(backupFile());
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Review your backup' })).toBeVisible();
});

test('failed import retains the reviewed backup and retry opens the tracker once', async ({ page }) => {
  let attempts = 0, imported = false;
  await emptyCloud(page);
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: imported } }));
  await page.route('**/api/cloud/import', route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Connection interrupted. Try again.' } });
    imported = true; return route.fulfill({ json: initialState() });
  });
  await page.route('**/api/state', route => route.fulfill({ json: initialState() }));
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles(backupFile());
  await page.getByRole('checkbox', { name: confirmation }).check();
  const submit = page.getByRole('button', { name: importButton }); await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Connection interrupted. Try again.');
  await expect(page.getByRole('checkbox', { name: confirmation })).toBeChecked();
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('tracker load failure after a successful import retries the read without re-importing', async ({ page }) => {
  let writes = 0, reads = 0, imported = false;
  await emptyCloud(page);
  await page.route('**/api/cloud/info', route => route.fulfill({ json: { initialized: imported } }));
  await page.route('**/api/cloud/import', route => { writes++; imported = true; return route.fulfill({ json: initialState() }); });
  await page.route('**/api/state', route => { reads++; return reads === 1 ? route.fulfill({ status: 503, json: { error: 'Records saved. Reconnect to open tracker.' } }) : route.fulfill({ json: initialState() }); });
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles(backupFile());
  await page.getByRole('checkbox', { name: confirmation }).check();
  await page.getByRole('button', { name: importButton }).click();
  await expect(page.getByRole('heading', { name: 'Connection unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(writes).toBe(1); expect(reads).toBe(2);
});
