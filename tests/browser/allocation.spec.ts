import { openMore } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { dateLabel } from '../../src/financialActions';
import { shiftDate } from '../../shared/allocation';
const today = localDate();
async function open(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible(); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
async function entry(page: Page, type: string, amount: string, name: string, account: string, scope = 'Personal', to = '') {
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const form = page.getByRole('dialog');
  await form.getByRole('button', { name: type, exact: true }).click(); await form.locator('#amount').fill(amount); await form.locator('#merchant').fill(name); await form.locator('#account').selectOption(account); await form.locator('#transaction-scope').selectOption(scope); if (to) await form.locator('#to-account').selectOption(to);
  await form.getByRole('button', { name: 'Save transaction', exact: true }).click(); await expect(form).toBeHidden();
}
async function snapshot(page: Page, name: string, amount: string) { const card = page.locator('.account-card').filter({ has: page.getByRole('heading', { name, exact: true }) }); await card.getByRole('button', { name: 'Update balance' }).click(); const form = page.getByRole('dialog'); await form.locator('#edit-value').fill(amount); await form.getByRole('button', { name: 'Save changes' }).click(); await expect(form).toBeHidden(); }
for (const width of [320, 390, 768, 1024, 1440, 1920]) test(`allocation, daily history, review and settings fit at ${width}px`, async ({ page }) => {
  const state = initialState();
  state.transactions = [
    validateTransaction({ id: 'pay', date: today, time: '09:00', type: 'Income', amountCents: 130000, merchant: 'Employment', description: '', category: 'Employment', subcategory: '', accountId: 'capital-one-checking', toAccountId: '', scope: 'Personal', classification: '', notes: 'Recorded pay' }, state),
    validateTransaction({ id: 'move', date: today, time: '10:00', type: 'Transfer', amountCents: 30000, merchant: 'Business funding', description: '', category: '', subcategory: '', accountId: 'capital-one-checking', toAccountId: 'chase-savings', scope: 'Personal', classification: '', notes: '' }, state),
    validateTransaction({ id: 'bill', date: today, time: '11:00', type: 'Expense', amountCents: 5000, merchant: 'A subscription merchant with a long name for mobile wrapping', description: '', category: 'Subscriptions / AI', subcategory: 'LLM', accountId: 'chase-savings', toAccountId: '', scope: 'Business', classification: 'Need', notes: '' }, state),
  ];
  await page.addInitScript(data => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)); }, state);
  await page.setViewportSize({ width, height: width < 600 ? 844 : 900 }); await open(page);
  await openMore(page, 'View money flow'); await page.getByRole('button', { name: 'All', exact: true }).click(); await expect(page.locator('.flow-list li')).toHaveCount(3); await noOverflow(page);
  if (width === 390) { await mkdir('.local/screenshots', { recursive: true }); await page.screenshot({ path: '.local/screenshots/money-flow-390.png', fullPage: true }); }
  await openMore(page, 'Review check-in history'); await noOverflow(page);
  await openMore(page, 'View month-end review'); await noOverflow(page);
  await openMore(page, 'Tracker settings'); let form = page.getByRole('dialog'); expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Budget', exact: true }).click(); await page.getByText('Payment accounts & due dates', { exact: true }).click(); await noOverflow(page); await page.locator('.funding-list article').first().getByRole('button', { name: 'Assign funding' }).click(); form = page.getByRole('dialog'); expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: 'All', exact: true }).click(); await page.locator('.account-card').first().getByRole('button', { name: 'Update balance' }).click(); form = page.getByRole('dialog'); expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await expect(form.locator('#balance-as-of')).toBeVisible(); await page.keyboard.press('Escape');
  await noOverflow(page); await page.locator('.account-card').first().getByRole('button', { name: 'Compare actual balance' }).click(); form = page.getByRole('dialog'); await form.locator('#actual-balance').fill('123.45'); expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await expect(form.getByRole('button', { name: 'Save comparison' })).toBeVisible(); await page.keyboard.press('Escape');
});
test('cross-account classifications, income destinations and internal transfers retain correct balances', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: 'All', exact: true }).click();
  await snapshot(page, 'Capital One Personal Checking', '1000.00'); await snapshot(page, 'Chase Business Savings', '500.00');
  await entry(page, 'Expense', '50.00', 'Personal bill paid by business', 'chase-savings');
  await entry(page, 'Transfer', '300.00', 'Operating transfer', 'capital-one-checking', 'Personal', 'chase-savings');
  await entry(page, 'Income', '1300.00', 'Client payment', 'capital-one-checking', 'Business');
  const checking = page.locator('.account-card').filter({ hasText: 'Capital One Personal Checking' }), business = page.locator('.account-card').filter({ hasText: 'Chase Business Savings' });
  await expect(checking.locator('.account-balance strong')).toHaveText('$2,000.00'); await expect(business.locator('.account-balance strong')).toHaveText('$750.00');
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await expect(page.locator('.check-in-card')).toContainText('$50.00');
  await page.getByRole('button', { name: 'Personal', exact: true }).click(); await expect(page.locator('.money-card').filter({ has: page.getByText('Money spent', { exact: true }) }).getByRole('heading')).toHaveText('$50.00');
  await page.getByRole('button', { name: 'Business', exact: true }).click(); await expect(page.locator('.money-card').filter({ has: page.getByText('Money spent', { exact: true }) }).getByRole('heading')).toHaveText('$0.00');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: 'All', exact: true }).click(); await snapshot(page, 'Chase Business Savings', '750.00'); await expect(business.locator('.account-balance strong')).toHaveText('$750.00');
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const late = page.getByRole('dialog'); await late.locator('#amount').fill('25.00'); await late.locator('#merchant').fill('Yesterday’s missed purchase'); await late.locator('#account').selectOption('chase-savings'); await late.getByRole('button', { name: /Date, time/ }).click(); await late.locator('#date').fill(shiftDate(today, -1)); await late.getByRole('button', { name: 'Save transaction' }).click(); await expect(late).toBeHidden(); await expect(business.locator('.account-balance strong')).toHaveText('$750.00');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(stored.transactions[0].scope).toBe('Personal'); expect(stored.transactions[0].accountId).toBe('chase-savings'); expect(stored.transactions).toHaveLength(4);
});
test('funding is an explicit recurring plan and fills the account without changing classification', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Budget', exact: true }).click(); await page.getByText('Payment accounts & due dates', { exact: true }).click();
  const row = page.locator('.funding-list article').filter({ has: page.getByRole('heading', { name: 'Rent', exact: true }) }); await expect(row).toContainText('UNASSIGNED'); await row.getByRole('button', { name: 'Assign funding' }).click(); const form = page.getByRole('dialog');
  await form.locator('#funding-account').selectOption('chase-savings'); await form.locator('#funding-day').fill('5'); await form.locator('#funding-autopay').selectOption('true'); await form.getByRole('button', { name: 'Save funding' }).click(); await expect(form).toBeHidden(); await expect(row).toContainText('0366'); await expect(row).toContainText('Autopay: Yes');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible(); await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const transaction = page.getByRole('dialog'); await transaction.locator('#category').selectOption('Housing'); await transaction.locator('#subcategory').selectOption('Rent'); await expect(transaction.locator('#account')).toHaveValue('chase-savings'); await expect(transaction.locator('#transaction-scope')).toHaveValue('Personal'); await page.keyboard.press('Escape');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(stored.expenseFunding).toHaveLength(1); expect(stored.transactions).toHaveLength(0); expect(stored.budgets[0].amountCents).toBe(121000);
});
test('in-app reminder, yesterday review and calendar confirmation persist without completing automatically', async ({ page }) => {
  await open(page); await openMore(page, 'Tracker settings'); const settings = page.getByRole('dialog'); await settings.locator('#reminder-time').fill('00:00'); await settings.locator('#small-threshold').fill('5.00'); await settings.getByRole('button', { name: 'Save settings' }).click(); await expect(settings).toBeHidden();
  await expect(page.locator('.check-status')).toHaveText('Review due');
  await openMore(page, 'Review check-in history'); await page.getByRole('button', { name: new RegExp(dateLabel(shiftDate(today, -1))) }).click(); await page.getByRole('button', { name: 'Review Transactions', exact: true }).click(); await expect(page.getByLabel('Filter ledger date')).toHaveValue(shiftDate(today, -1));
  await openMore(page, 'Review check-in history'); const date = shiftDate(today, -1); if (!date.startsWith(today.slice(0, 7))) await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: `${dateLabel(date)}: Missing`, exact: true }).click(); await page.locator('.day-review').getByRole('button', { name: 'Confirm entries', exact: true }).click(); await expect(page.locator('.day-review').getByRole('button', { name: 'Complete', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await expect(page.getByRole('button', { name: 'Review Yesterday', exact: true })).toBeHidden(); await expect(page.locator('.check-status')).toHaveText('Review due');
  await page.locator('.check-in-card').getByRole('button', { name: 'Confirm entries', exact: true }).click(); await expect(page.locator('.check-status')).toHaveText('Complete'); await page.reload(); await expect(page.locator('.check-status')).toHaveText('Complete');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(stored.settings[0].smallPurchaseThresholdCents).toBe(500); expect(stored.dailyCheckIns).toHaveLength(2); expect(stored.dailyCheckIns.every((c: any) => c.completed && c.transactionsReviewed === 0)).toBe(true);
});
test('saved income sources fill independent defaults and monthly notes carry forward with an audit trail', async ({ page }) => {
  await open(page); await openMore(page, 'View money flow'); await page.getByRole('button', { name: 'Add income source', exact: true }).click(); let form = page.getByRole('dialog'); await form.locator('#source-name').fill('Client invoices'); await form.locator('#source-scope').selectOption('Business'); await form.locator('#source-category').selectOption('Business income'); await form.locator('#source-account').selectOption('capital-one-checking'); await form.getByRole('button', { name: 'Save income source' }).click(); await expect(form).toBeHidden();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); form = page.getByRole('dialog'); await form.getByRole('button', { name: 'Income', exact: true }).click(); await form.locator('#income-source').selectOption({ label: 'Client invoices · Business' }); await expect(form.locator('#transaction-scope')).toHaveValue('Business'); await expect(form.locator('#account')).toHaveValue('capital-one-checking'); await page.keyboard.press('Escape');
  await openMore(page, 'View month-end review'); await page.getByRole('button', { name: 'All', exact: true }).click(); await page.locator('#month-review-note').fill('Compare insurance quotes and assign remaining bills.'); await page.getByRole('button', { name: 'Save review notes', exact: true }).click(); await expect(page.getByText('Notes saved for next month.', { exact: true })).toBeVisible();
  await page.locator('#month-review-note').fill('Compare insurance quotes and assign rent funding.'); await page.getByRole('button', { name: 'Save review notes', exact: true }).click(); await expect(page.getByText('Notes saved for next month.', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Next month' }).click(); await expect(page.locator('.carried-note')).toContainText('assign rent funding');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(stored.monthReviews).toHaveLength(1); expect(stored.monthReviews[0].revision).toBe(2); expect(stored.audit.filter((a: any) => a.entity === 'month-reviews')).toHaveLength(2);
});
