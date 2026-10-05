import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { shiftDate } from '../../shared/allocation';
async function open(page: Page, known = false) {
  const state = initialState(), today = localDate(), asOf = `${shiftDate(today, -1)}T00:00`;
  if (known) {
    const balances: Record<string, number> = { 'capital-one-checking': 100000, 'capital-one-savings': 50000, 'chase-savings': 30000, 'capital-one-savor': 900000, 'chase-unlimited': 500000 };
    state.accounts = state.accounts.map(a => ({ ...a, balanceCents: balances[a.id], balanceAsOf: asOf, balanceUpdatedAt: new Date(asOf).toISOString(), balanceIncludedTransactionIds: '[]' }));
    state.transactions = [
      validateTransaction({ id: 'pay', date: today, time: '00:01', type: 'Income', amountCents: 90000, category: 'Business income', subcategory: '', merchant: 'Client payment', description: '', accountId: 'capital-one-checking', toAccountId: '', scope: 'Business', classification: '', notes: '' }, state),
      validateTransaction({ id: 'purchase', date: today, time: '00:02', type: 'Expense', amountCents: 2000, category: 'Food', subcategory: 'Grocery', merchant: 'Groceries', description: '', accountId: 'chase-savings', toAccountId: '', scope: 'Personal', classification: 'Need', notes: '' }, state),
      validateTransaction({ id: 'transfer', date: today, time: '00:03', type: 'Transfer', amountCents: 15000, category: '', subcategory: '', merchant: 'Move to savings', description: '', accountId: 'capital-one-checking', toAccountId: 'capital-one-savings', scope: 'Personal', classification: '', notes: '' }, state),
      validateTransaction({ id: 'card-purchase', date: today, time: '00:04', type: 'Expense', amountCents: 10000, category: 'Miscellaneous', subcategory: '', merchant: 'Supplies', description: '', accountId: 'capital-one-savor', toAccountId: '', scope: 'Personal', classification: 'Want', notes: '' }, state),
    ];
  }
  await page.addInitScript(data => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)); }, state);
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible(); return state;
}
for (const width of [390, 1440]) test(`balance hero and quick drafts preserve financial data at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); const before = await open(page, true);
  const hero = page.getByRole('region', { name: 'Current cash balance' }); await expect(hero.locator('.hero-total > strong')).toHaveText('$2,680.00');
  await expect(hero).toContainText('Checking & savings');
  await expect(page.locator('.recent-panel .transaction-main strong')).toHaveText(['Supplies', 'Move to savings', 'Groceries']);
  await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toHaveCount(1);
  await mkdir('.local/screenshots', { recursive: true }); await page.screenshot({ path: `.local/screenshots/design-dashboard-${width}.png`, fullPage: false });
  for (const type of ['Expense', 'Income', 'Transfer']) {
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: type, exact: true }).click(); await expect(dialog.getByRole('button', { name: type, exact: true })).toHaveAttribute('aria-pressed', 'true');
    if (type === 'Income') await expect(dialog.locator('#category')).toHaveValue('Employment'); if (type === 'Transfer') await expect(dialog.locator('#to-account')).toBeVisible();
    if (type === 'Expense' && width === 390) await page.screenshot({ path: '.local/screenshots/design-entry-390.png', fullPage: false });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toBeHidden();
  }
  await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: 'All', exact: true }).click(); await expect(page.locator('.account-card')).toHaveCount(5); await expect(page.locator('.scope-picker').getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(after).toEqual(before);
});
test('small phones with enlarged text and landscape keep transaction entry accessible and balances unknown', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await open(page); await expect(page.locator('.hero-total > strong')).toHaveText('Not set');
  await page.evaluate(() => { document.documentElement.style.zoom = '1.25'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click(); let form = page.getByRole('dialog');
  await form.locator('#amount').fill('0.10'); await form.locator('#merchant').fill('Mobile display check'); await form.locator('#account').selectOption('capital-one-checking');
  let save = form.getByRole('button', { name: 'Save transaction', exact: true }), bounds = await save.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await save.click(); await expect(form).toBeHidden();
  await expect(page.locator('.hero-total > strong')).toHaveText('Not set'); const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(stored.transactions[0].amountCents).toBe(10); expect(stored.accounts.every((a: { balanceCents: number | null }) => a.balanceCents === null)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; }); await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click(); form = page.getByRole('dialog'); await form.getByRole('button', { name: 'Transfer', exact: true }).click(); save = form.getByRole('button', { name: 'Save transaction', exact: true }); bounds = await save.boundingBox(); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(376); expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await page.keyboard.press('Escape'); await expect(form).toBeHidden();
});

test('one mobile add control remains accessible before and after scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const before = await open(page, true);
  await expect(page.locator('.mobile-add')).toBeVisible(); await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await expect(page.locator('.mobile-add')).toBeVisible();
  await page.locator('.mobile-add').click(); const form = page.getByRole('dialog'); await expect(form.getByRole('button', { name: 'Expense', exact: true })).toHaveAttribute('aria-pressed', 'true'); await page.keyboard.press('Escape'); await expect(form).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0)); await expect(page.locator('.mobile-add')).toBeVisible(); await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Income', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Income', exact: true })).toHaveAttribute('aria-pressed', 'true'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(before);
});
