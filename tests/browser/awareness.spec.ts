import { openMore, openDetailedEntry } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
const today = localDate();
async function open(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible(); }
async function notes(page: Page) { await openMore(page, 'Notes & Reminders'); await expect(page.getByRole('heading', { name: 'Notes & Reminders', exact: true })).toBeVisible(); }
async function addAction(page: Page) {
  await notes(page);
  await page.getByRole('button', { name: 'Add financial action', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Add financial action' });
  await form.getByLabel('Title', { exact: true }).fill('Negotiate Spectrum bill');
  await form.getByRole('textbox', { name: 'Note', exact: true }).fill('Bill fluctuates. Call to check the terms.');
  await form.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('High');
  await form.locator('#action-reminder').fill(today);
  await form.getByLabel('Amount potentially affected ($, optional)', { exact: true }).fill('90.00');
  await form.getByLabel('Previous monthly cost ($)', { exact: true }).fill('90.00');
  await form.getByLabel('New monthly cost ($)', { exact: true }).fill('70.00');
  await expect(form.locator('#monthly-savings')).toHaveValue('20.00');
  await expect(form.locator('.savings-preview')).toContainText('$240.00');
  await form.getByRole('button', { name: 'Save action' }).click(); await expect(form).toBeHidden();
}
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`notes, reminders, and awareness cards fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 }); await open(page);
    await expect(page.getByRole('heading', { name: 'Daily Financial Axiom' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await notes(page);
    await page.getByRole('button', { name: 'Add financial action', exact: true }).first().click();
    const form = page.getByRole('dialog', { name: 'Add financial action' });
    expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const bounds = await form.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape'); await expect(form).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
test('financial action saves, completes, stays in history, and leaves cash flow unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page); await addAction(page);
  const card = page.locator('.action-card').filter({ hasText: 'Negotiate Spectrum bill' });
  await expect(card).toBeVisible(); await expect(card).toContainText('$20.00 / month');
  await page.reload(); await notes(page); await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Mark completed' }).click(); await expect(card).toBeHidden();
  await page.getByLabel('Filter action status').selectOption('Completed'); await expect(card).toBeVisible();
  await expect(card).toContainText('Completed'); await expect(page.locator('.actions-overview')).toContainText('$240.00');
  await card.getByRole('button', { name: 'Edit action' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Note', exact: true }).fill('New terms confirmed with provider.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save action' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(stored.notesReminders).toHaveLength(1); expect(stored.notesReminders[0].revision).toBe(3);
  expect(stored.notesReminders[0].completedAt).toBe(stored.audit[1].after.completedAt);
  expect(stored.audit[1].before.status).toBe('Open'); expect(stored.audit[1].after.status).toBe('Completed');
  expect(stored.transactions).toHaveLength(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.locator('.month-strip')).toContainText('Received $0.00');
  await page.getByRole('button', { name: 'Business', exact: true }).click(); await notes(page);
  await page.getByLabel('Filter action status').selectOption('Completed'); await expect(card).toBeHidden();
});
test('check-in persists, becomes unconfirmed after a new entry, and opens today’s ledger', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Advanced', exact: true }).click(); await page.getByText('Entry review & reminders', { exact: true }).click();
  const checkIn = page.locator('.check-in-card'); await checkIn.getByRole('button', { name: 'Confirm entries', exact: true }).click();
  await expect(checkIn.getByRole('button', { name: 'Complete', exact: true })).toBeDisabled();
  await page.reload(); await page.getByRole('button', { name: 'Advanced', exact: true }).click(); await page.getByText('Entry review & reminders', { exact: true }).click(); await expect(checkIn.getByRole('button', { name: 'Complete', exact: true })).toBeDisabled();
  await openDetailedEntry(page);
  const form = page.getByRole('dialog'); await form.getByRole('textbox', { name: 'Amount', exact: true }).fill('0.10'); await form.locator('#merchant').fill('New recorded purchase'); await form.locator('#account').selectOption('capital-one-checking');
  await form.getByRole('button', { name: 'Save transaction' }).click(); await expect(form).toBeHidden();
  await expect(checkIn.getByRole('button', { name: 'Confirm entries', exact: true })).toBeEnabled();
  await expect(checkIn).toContainText('Today’s entries changed');
  await expect(checkIn.locator('.check-in-summary')).toContainText('$0.10');
  await checkIn.getByRole('button', { name: 'Review Today', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp('Showing ' + today) })).toBeVisible();
  await expect(page.getByText('New recorded purchase', { exact: true })).toBeVisible();
});
test('legacy data survives migration, and a bill flag creates an editable reminder and persists dismissal', async ({ page }) => {
  const seed = initialState(), month = today.slice(0, 7);
  seed.transactions = [0, 1, 2, 3].map(i => {
    const date = new Date(`${month}-15T12:00:00`); date.setMonth(date.getMonth() - i);
    return validateTransaction({ id: `spectrum-${i}`, date: localDate(date).slice(0, 7) + '-01', time: '12:00', type: 'Expense', amountCents: i === 0 ? 9200 : 7000, merchant: 'Spectrum', description: '', category: 'Utilities', subcategory: 'Internet', accountId: 'capital-one-checking', toAccountId: '', classification: 'Need', scope: 'Personal', notes: '' }, seed);
  });
  const { notesReminders, dailyCheckIns, leakReviews, ...legacy } = seed;
  await page.addInitScript(data => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)); }, legacy);
  await open(page); await openMore(page, 'Spending insights'); await page.getByText('Things to review', { exact: true }).click();
  const flag = page.locator('.leak-item').filter({ has: page.getByRole('heading', { name: 'Recurring cost increased', exact: true }) });
  await expect(flag).toContainText('$70.00'); await expect(flag).toContainText('$92.00');
  await flag.getByRole('button', { name: 'Review Bill' }).click();
  const review = page.getByRole('dialog', { name: 'Review recorded charges' }); await expect(review.locator('.transaction-row')).toHaveCount(4);
  await review.getByRole('button', { name: 'Create Reminder' }).click();
  const form = page.getByRole('dialog', { name: 'Add financial action' }); await expect(form.getByLabel('Title', { exact: true })).toHaveValue('Review: Spectrum');
  await expect(form.getByLabel('Amount potentially affected ($, optional)', { exact: true })).toHaveValue('22.00');
  await form.getByRole('button', { name: 'Save action' }).click(); await expect(form).toBeHidden();
  await flag.getByRole('button', { name: 'Dismiss', exact: true }).click(); await expect(flag).toBeHidden();
  await page.reload(); await openMore(page, 'Spending insights'); await page.getByText('Things to review', { exact: true }).click(); await expect(flag).toBeHidden();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(stored.transactions).toHaveLength(4); expect(stored.notesReminders).toHaveLength(1); expect(stored.leakReviews).toHaveLength(1);
  expect(stored.accounts).toEqual(legacy.accounts); expect(stored.budgets).toEqual(legacy.budgets);
});
