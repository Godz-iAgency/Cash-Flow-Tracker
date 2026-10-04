import { test, expect } from '@playwright/test';
import { initialState } from '../../shared/seed';

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
  const submit = page.getByRole('button', { name: 'Copy reviewed records to Firestore' });
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I have kept a backup and reviewed these records.' }).check();
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
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
  expect(writes).toBe(0); await expect(page.getByRole('button', { name: 'Copy reviewed records to Firestore' })).toHaveCount(0);
});
