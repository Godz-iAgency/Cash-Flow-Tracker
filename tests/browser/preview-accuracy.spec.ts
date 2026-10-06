import { test, expect } from '@playwright/test';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { waterPreviewState as oldFixture } from './reviewFixture';

test('preview shows no invented records or balances, labels every page, preserves old storage and never contacts cloud', async ({ page }) => {
  const old = oldFixture();
  await page.addInitScript(state => { localStorage.setItem('cash-flow-water-preview', JSON.stringify(state)); localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(state)); }, old);
  const requests: string[] = []; page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api')) requests.push(r.url()); });
  await page.goto('/?preview=simple');
  for (const name of ['Home', 'Income', 'Expenses', 'Cash flow', 'Advanced']) {
    await page.getByRole('button', { name, exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('note', { name: 'Preview mode' })).toContainText('Not your saved records');
    await expect(page.getByRole('link', { name: 'Open my saved tracker' })).toHaveAttribute('href', 'https://cash-flow-tracker-godz-i.vercel.app/');
    await expect(page.locator('main')).not.toContainText('Coffee with a friend');
    await expect(page.locator('main')).not.toContainText('$5,617.32');
    await expect(page.locator('.entry-row, .movement-row')).toHaveCount(0);
  }
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(old);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-water-preview')!))).toEqual(old);
  await page.getByRole('button', { name: 'Expenses', exact: true }).filter({ visible: true }).click();
  expect(await page.locator('.expense-name strong').allTextContents()).toEqual(initialState().budgets.map(b => b.label));
  await page.getByRole('button', { name: 'Add entry', exact: true }).filter({ visible: true }).click();
  await page.getByLabel('Amount', { exact: true }).fill('1'); await page.getByRole('combobox', { name: 'What for' }).fill('My typed entry'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden(); await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-plan-preview-v2')!));
  expect(saved.transactions).toHaveLength(1); expect(saved.transactions[0].merchant).toBe('My typed entry');
  expect(saved.accounts.every((a: any) => a.balanceCents === null)).toBe(true);
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Advanced', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Backup & devices', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Preview only');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^cash-flow-preview-/);
});

test('normal signed-in Firestore route displays only the returned records and identifies online storage', async ({ page }) => {
  const source = initialState(); source.transactions = [validateTransaction({ id: 'actual-response', type: 'Expense', amountCents: 1234, date: localDate(), time: '09:00', merchant: 'Receipt already saved', category: 'Food', subcategory: 'Grocery', accountId: 'capital-one-checking', toAccountId: '', scope: 'Personal', classification: 'Need', description: '', notes: '' }, source)];
  await page.addInitScript(state => localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(state)), oldFixture());
  let reads = 0, writes = 0;
  await page.route('**/api/status', r => r.fulfill({ json: { configured: true, authenticated: true, backend: 'firestore' } }));
  await page.route('**/api/cloud/info', r => r.fulfill({ json: { initialized: true } }));
  await page.route('**/api/state', r => { reads++; return r.fulfill({ json: source }); });
  page.on('request', r => { if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes++; });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Record storage' })).toHaveText('Saved online');
  await expect(page.locator('.entry-row')).toHaveCount(1); await expect(page.locator('.entry-row')).toContainText('Receipt already saved'); await expect(page.locator('.entry-row')).toContainText('$12.34');
  await expect(page.locator('main')).not.toContainText('Coffee with a friend'); expect(reads).toBe(1); expect(writes).toBe(0);
});
