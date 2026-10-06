import { test, expect } from '@playwright/test';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { contrastAudit } from './water-contrast';
async function nav(page: any, name: string) { const target = page.getByRole('button', { name, exact: true }).filter({ visible: true }); if (['My spending', 'Money in & out', 'Daily checks', 'Monthly review', 'Notes & reminders'].includes(name) && !await target.count()) await page.getByText('Advanced', { exact: true }).click(); await target.click(); }

test('the common entry path stays short, keyboard focus stays in the task, and optional entry still works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?preview=simple');
  await nav(page, 'Add entry'); await expect(page.getByLabel('Amount', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Quick entry', { exact: true })).toHaveCount(0);
  expect(await page.locator('.sidebar').evaluate(el => (el as HTMLElement).inert)).toBe(true);
  await nav(page, 'More options'); await page.getByLabel('Quick entry', { exact: true }).fill('.05 other'); await page.getByLabel('Quick entry', { exact: true }).press('Enter'); await nav(page, 'Save');
  await expect(page.getByRole('dialog')).toBeHidden(); expect(await page.locator('.sidebar').evaluate(el => (el as HTMLElement).inert)).toBe(false);
  await nav(page, 'More'); await page.getByText('Advanced',{exact:true}).click(); await page.getByText('Past changes & other tools',{exact:true}).click(); await nav(page, 'Change history');
  const dialog = page.getByRole('dialog'); await dialog.locator('.audit-list > details > summary').first().click(); await expect(dialog).toContainText('$0.05'); await expect(dialog.locator('pre').first()).toBeHidden();
  const before = await page.evaluate(() => localStorage.getItem('cash-flow-water-preview'));
  await dialog.locator('.original-record > summary').first().click(); await expect(dialog.locator('pre').last()).toContainText('amountCents'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-water-preview'))).toBe(before);
});

test('an invalid bill day opens its hidden field and keeps the financial plan intact', async ({ page }) => {
  await page.goto('/?preview=simple'); await nav(page, 'Plan'); await nav(page, 'Add item');
  const before = await page.evaluate(() => localStorage.getItem('cash-flow-water-preview'));
  await page.getByLabel('Name', { exact: true }).fill('New bill'); await page.getByLabel('Monthly amount', { exact: true }).fill('10'); await page.getByText('Bill details', { exact: true }).click(); await page.getByLabel('Due day (optional)').fill('32'); await page.getByText('Bill details', { exact: true }).click(); await nav(page, 'Save');
  await expect(page.getByLabel('Due day (optional)')).toBeVisible(); await expect(page.getByLabel('Due day (optional)')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-water-preview'))).toBe(before);
});

test('income breakdown follows Personal and Business and extra reports start collapsed', async ({ page }) => {
  const state = initialState();
  state.transactions = (['Personal', 'Business'] as const).map((scope, i) => validateTransaction({ id: `income-${i}`, type: 'Income', amountCents: i ? 70000 : 2500, merchant: i ? 'Business client' : 'Personal pay', description: '', category: i ? 'Business income' : 'Employment', subcategory: '', accountId: state.accounts.find(a => a.scope === scope)!.id, toAccountId: '', scope, classification: '', date: localDate(), time: '09:00', notes: '' }, state));
  await page.addInitScript(s => localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(s)), state); await page.goto('/');
  await nav(page, 'More'); await nav(page, 'Money in & out');
  await expect(page.locator('.income-allocation')).toBeHidden(); await page.getByText('Where my income goes', { exact: true }).filter({ visible: true }).click(); await expect(page.locator('.income-allocation')).toContainText('$25.00'); await expect(page.locator('.income-allocation')).not.toContainText('$700.00');
  await nav(page, 'Business'); await expect(page.locator('.income-allocation')).toContainText('$700.00'); await expect(page.locator('.income-allocation')).not.toContainText('$25.00');
  await nav(page, 'More'); await nav(page, 'Monthly review'); await expect(page.locator('.review-values')).toBeHidden(); await expect(page.locator('.simple-metrics > *')).toHaveCount(3);
});

for (const mode of ['dark', 'light']) test(`${mode}: optional screens use readable rows and disclosures on a small phone`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.addInitScript(mode => localStorage.setItem('cash-flow-appearance', mode), mode); await page.goto('/?preview=simple');
  for (const name of ['My spending', 'Money in & out', 'Daily checks', 'Monthly review', 'Notes & reminders']) {
    await nav(page, 'More'); await nav(page, name); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect((await contrastAudit(page)).failures, name).toEqual([]);
  }
  await nav(page, 'More'); await nav(page, 'Backup & devices'); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Download backup' })).toBeVisible(); expect((await contrastAudit(page)).failures).toEqual([]); await expect(dialog.locator('.plain-disclosure').first()).not.toHaveAttribute('open', '');
});

test('a failed server response gives a useful connection message without technical output', async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 500, contentType: 'text/html', body: 'FUNCTION_INVOCATION_FAILED: unexpected server output' }));
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText('Check your connection and try again'); await expect(page.locator('body')).not.toContainText('FUNCTION_INVOCATION_FAILED'); await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('everyday tabs and choices stay plain, and reports open only when requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?preview=simple');
  const navBar = page.getByRole('navigation', { name: 'Mobile navigation' });
  expect(await navBar.getByRole('button').allTextContents()).toEqual(['Home', 'History', 'Plan', 'My money', 'More']);
  await expect(page.getByRole('button', { name: 'I spent', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I got paid', exact: true })).toBeVisible();
  await nav(page, 'Plan'); await expect(page.locator('.simple-metrics')).toContainText('Plan to spend'); await expect(page.locator('.simple-metrics')).toContainText('Spent so far'); await expect(page.locator('.simple-metrics')).toContainText('Left to spend');
  await expect(page.getByRole('button', { name: /Money I expect/ })).toBeHidden();
  await page.getByText('Money coming in', { exact: true }).click(); await expect(page.getByRole('button', { name: /Money I expect/ })).toBeVisible();
  await nav(page, 'More'); await expect(page.getByRole('button', { name: 'Backup & devices' })).toBeVisible(); await expect(page.getByRole('button', { name: 'My spending', exact: true })).toBeHidden();
  await page.getByText('Advanced', { exact: true }).click(); await expect(page.getByRole('button', { name: 'My spending', exact: true })).toBeVisible();
});

test('a plan over its limit gives the amount over, with its original spending still editable', async ({ page }) => {
  const state = initialState();
  state.transactions = [validateTransaction({ id: 'over-plan', type: 'Expense', amountCents: 300000, merchant: 'Large purchase', description: '', category: 'Miscellaneous', subcategory: '', accountId: state.accounts[0].id, toAccountId: '', scope: 'Personal', classification: 'Need', date: localDate(), time: '09:00', notes: '' }, state)];
  await page.addInitScript(s => localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(s)), state); await page.goto('/'); await nav(page, 'Plan');
  await expect(page.locator('.simple-metric').filter({ hasText: 'Over my plan' })).toContainText('$430.70');
  await page.getByRole('button', { name: /Spent so far/ }).click(); await expect(page.getByRole('dialog')).toContainText('Large purchase');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!).transactions[0].amountCents)).toBe(300000);
});

test('a purchase outside the plan keeps the words I type without requiring more fields', async ({ page }) => {
  await page.goto('/?preview=simple'); await nav(page, 'I spent'); await page.getByLabel('Amount', { exact: true }).fill('7.50');
  await page.getByRole('combobox', { name: 'What for' }).fill('Pizza with a friend'); await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'What for' })).toHaveValue('Pizza with a friend'); await nav(page, 'Save');
  await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.locator('.entry-row').filter({ hasText: 'Pizza with a friend' })).toBeVisible();
  const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-water-preview')!).transactions.find((t: any) => t.merchant === 'Pizza with a friend'));
  expect(entry.amountCents).toBe(750); expect(entry.subcategory).toBe('Pizza with a friend'); expect(entry.type).toBe('Expense');
});
