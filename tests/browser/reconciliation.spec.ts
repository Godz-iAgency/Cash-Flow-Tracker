import { openMore } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { shiftDate } from '../../shared/allocation';
const today = localDate();
async function open(page: Page, unknown = false, expense = false) {
  const state = initialState(), asOf = `${shiftDate(today, -1)}T00:00`;
  if (!unknown) state.accounts = state.accounts.map(a => ({ ...a, balanceCents: a.type === 'Credit card' ? 20000 : 100000, balanceAsOf: asOf, balanceUpdatedAt: new Date(asOf).toISOString(), balanceIncludedTransactionIds: '[]' }));
  if (expense) state.transactions = [validateTransaction({ id: 'purchase', date: today, time: '00:01', type: 'Expense', amountCents: 2500, category: 'Food', subcategory: 'Grocery', merchant: 'Existing groceries', description: '', accountId: 'capital-one-checking', toAccountId: '', scope: 'Personal', classification: 'Need', notes: '' }, state)];
  await page.addInitScript(data => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)); }, state);
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible(); await page.getByRole('button', { name: 'Accounts', exact: true }).click();
}
const card = (page: Page, name = 'Capital One Personal Checking') => page.locator('.account-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
async function compare(page: Page, value: string, note = '') { await card(page).getByRole('button', { name: 'Compare actual balance' }).click(); const form = page.getByRole('dialog'); await form.locator('#actual-balance').fill(value); await form.locator('#comparison-note').fill(note); if (note) { await mkdir('.local/screenshots', { recursive: true }); await page.screenshot({ path: '.local/screenshots/reconciliation-390.png', fullPage: false }); } await form.getByRole('button', { name: 'Save comparison' }).click(); await expect(form).toBeHidden(); }

test('discrepancies and matching comparisons persist without altering financial data; changes request review', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page, false, true); const before = await stored(page);
  await expect(card(page).locator('.account-balance strong')).toHaveText('$975.00');
  await compare(page, '970.00', 'Review the bank statement for a missing charge.');
  await expect(card(page).locator('.saved-comparison').first()).toContainText('Discrepancy — review needed'); await expect(card(page).locator('.saved-comparison').first()).toContainText('-$5.00');
  const saved = await stored(page); expect(saved.transactions).toEqual(before.transactions); expect(saved.accounts).toEqual(before.accounts); expect(saved.budgets).toEqual(before.budgets); expect(saved.balanceReconciliations).toHaveLength(1); expect(saved.audit.at(-1).entity).toBe('balance-reconciliations');
  await page.reload(); await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await expect(card(page).locator('.saved-comparison').first()).toContainText('missing charge');
  await compare(page, '975.00'); await expect(card(page).locator('.saved-comparison').first()).toContainText('Balances match'); const capturedComparisons = (await stored(page)).balanceReconciliations;
  await card(page).locator('.comparison-history > summary').click(); await expect(card(page).locator('.comparison-history > details')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const form = page.getByRole('dialog'); await form.getByRole('button', { name: 'Income', exact: true }).click(); await form.locator('#amount').fill('50.00'); await form.locator('#merchant').fill('Additional income'); await form.locator('#account').selectOption('capital-one-checking'); await form.getByRole('button', { name: /Date, time/ }).click(); await form.locator('#date').fill(today); await form.locator('#time').fill('00:02'); await form.getByRole('button', { name: 'Save transaction' }).click(); await expect(form).toBeHidden();
  await expect(card(page).locator('.saved-comparison').first()).toContainText('Ledger changed; compare again'); await expect(card(page).locator('.account-balance strong')).toHaveText('$1,025.00'); expect((await stored(page)).balanceReconciliations).toEqual(capturedComparisons);
  await openMore(page, 'Storage & backup'); await page.getByRole('button', { name: 'Audit history' }).click(); await expect(page.getByRole('dialog')).toContainText('Balance comparison saved');
});

test('unknown opening balance is flagged and saving actual balance does not fabricate a baseline', async ({ page }) => {
  await open(page, true); const before = await stored(page); await compare(page, '123.45'); await expect(card(page).locator('.saved-comparison').first()).toContainText('Opening balance needed'); await expect(card(page).locator('.account-balance strong')).toHaveText('Not set'); const after = await stored(page); expect(after.accounts).toEqual(before.accounts); expect(after.transactions).toEqual([]); expect(after.balanceReconciliations[0].calculatedBalanceCents).toBeNull(); expect(after.balanceReconciliations[0].differenceCents).toBeNull();
});

test('card purchase and payment change the correct balances and count the expense only once', async ({ page }) => {
  await open(page);
  async function entry(type: string, amount: string, account: string, to = '') { await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const form = page.getByRole('dialog'); await form.getByRole('button', { name: type, exact: true }).click(); await form.locator('#amount').fill(amount); await form.locator('#merchant').fill(type === 'Transfer' ? 'Credit card payment' : 'Credit card purchase'); await form.locator('#account').selectOption(account); if (to) await form.locator('#to-account').selectOption(to); await form.getByRole('button', { name: 'Save transaction' }).click(); await expect(form).toBeHidden(); }
  await entry('Expense', '50.00', 'capital-one-savor'); await expect(card(page).locator('.account-balance strong')).toHaveText('$1,000.00'); await expect(card(page, 'Capital One Savor Credit Card').locator('.account-balance strong')).toHaveText('$250.00');
  await entry('Transfer', '80.00', 'capital-one-checking', 'capital-one-savor'); await expect(card(page).locator('.account-balance strong')).toHaveText('$920.00'); await expect(card(page, 'Capital One Savor Credit Card').locator('.account-balance strong')).toHaveText('$170.00'); await expect(card(page, 'Capital One Savor Credit Card').locator('.balance-equation')).toContainText('Opening owed + charges');
  await card(page, 'Capital One Savor Credit Card').getByRole('button', { name: 'Compare actual balance' }).click(); const comparison = page.getByRole('dialog'); await comparison.locator('#actual-balance').fill('170.00'); await expect(comparison.locator('.reconciliation-status')).toContainText('Balances match'); await mkdir('.local/screenshots', { recursive: true }); await page.screenshot({ path: '.local/screenshots/reconciliation-desktop.png', fullPage: false }); await comparison.getByRole('button', { name: 'Save comparison' }).click(); await expect(comparison).toBeHidden();
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await expect(page.locator('.money-card').filter({ has: page.getByText('Money spent', { exact: true }) }).getByRole('heading')).toHaveText('$50.00'); const after = await stored(page); expect(after.transactions.map((t: { type: string }) => t.type)).toEqual(['Expense', 'Transfer']); expect(after.accounts[0].balanceCents).toBe(100000);
});
