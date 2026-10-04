import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { validateAction } from '../../shared/actions';

type TextAudit = { label: string; count: number; min: number; sizes: number[]; undersized: { text: string; size: number; className: string }[] };
async function audit(page: Page, label: string, scale: number): Promise<TextAudit> {
  const result = await page.evaluate(({ label, scale }) => {
    const root = document.querySelector('[role="dialog"]') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rows: { text: string; size: number; className: string; floor: number }[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement; if (!el || !node.textContent?.trim() || el.closest('svg, script, style, option, [aria-hidden="true"]')) continue;
      const style = getComputedStyle(el), range = document.createRange(); range.selectNodeContents(node);
      if (style.visibility !== 'visible' || ![...range.getClientRects()].some(r => r.width > 0 && r.height > 0)) continue;
      rows.push({ text: node.textContent.trim().slice(0, 100), size: parseFloat(style.fontSize), className: el.className, floor: (el.closest('.mobile-nav') ? 12 : 14) * scale });
    }
    for (const el of root.querySelectorAll('input:not([type="checkbox"]), select, textarea')) {
      if (!(el as HTMLElement).offsetWidth) continue;
      rows.push({ text: el.getAttribute('aria-label') ?? el.id, size: parseFloat(getComputedStyle(el).fontSize), className: el.className, floor: 16 * scale });
    }
    return { label, count: rows.length, min: Math.min(...rows.map(r => r.size)), sizes: [...new Set(rows.map(r => r.size))].sort((a, b) => a - b), undersized: rows.filter(r => r.size + .1 < r.floor) };
  }, { label, scale });
  const overflow = await page.evaluate(() => [...document.body.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'absolute' && !el.closest('.extension-nav'); }).slice(0, 12).map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent?.slice(0, 70), right: el.getBoundingClientRect().right })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': page width ' + JSON.stringify(overflow)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': dialog width').toBe(true);
  return result;
}
for (const { width, scale } of [{ width: 320, scale: 1 }, { width: 370, scale: 1 }, { width: 390, scale: 1 }, { width: 768, scale: 1 }, { width: 1440, scale: 1 }, { width: 370, scale: 1.25 }, { width: 320, scale: 2 }]) {
  test(`text audit across screens and forms at ${width}px, ${scale * 100}% font size`, async ({ page }) => {
    test.setTimeout(90000);
    const state = initialState(), today = localDate();
    state.transactions = [validateTransaction({ id: 'audit-expense', date: today, time: '09:00', type: 'Expense', amountCents: 2310, category: 'Food', subcategory: 'Grocery', merchant: 'Sample merchant with a longer mobile label', description: '', accountId: 'capital-one-checking', toAccountId: '', scope: 'Personal', classification: 'Need', notes: 'Typography sample only' }, state)];
    state.notesReminders = [validateAction({ id: 'audit-action', title: 'Review a sample recurring bill', note: 'Sample note for readability checks.', category: 'Bill Review', scope: 'Personal', priority: 'High', status: 'Open', reminderDate: today, relatedExpenseId: '', relatedAccountId: '', amountAffectedCents: 9000, previousCostCents: 9000, newCostCents: 7000, monthlySavingsCents: null }, state)];
    await page.addInitScript(data => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)); }, state);
    await page.setViewportSize({ width, height: 844 }); await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
    const rows: TextAudit[] = [];
    const inspect = async (name: string) => rows.push(await audit(page, name, scale));
    const navigate = async (name: string) => { await page.getByRole('button', { name, exact: true }).last().click(); };
    const close = async () => { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); };
    await inspect('Dashboard');
    for (const name of ['Transactions', 'Budget', 'Accounts', 'Insights', 'Notes & Reminders', 'View money flow', 'Review check-in history', 'View month-end review']) { await navigate(name); await inspect(name); }
    await navigate('Tracker settings'); await inspect('Settings form'); await close();
    await navigate('Notes & Reminders'); await page.getByRole('button', { name: 'Add financial action', exact: true }).first().click(); await inspect('Financial action form'); await close();
    await navigate('View money flow'); await page.getByRole('button', { name: 'Add income source', exact: true }).click(); await inspect('Income source form'); await close();
    await navigate('Budget'); await page.locator('.funding-list article').first().getByRole('button', { name: 'Assign funding' }).click(); await inspect('Funding form'); await close();
    await page.getByRole('button', { name: 'Edit Rent budget', exact: true }).click(); await inspect('Budget form'); await close();
    await navigate('Accounts'); await page.locator('.account-card').first().getByRole('button', { name: 'Update balance' }).click(); await inspect('Opening balance form'); await close();
    await page.locator('.account-card').first().getByRole('button', { name: 'Compare actual balance' }).click(); await inspect('Balance comparison form'); await close();
    await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click();
    const form = page.getByRole('dialog');
    for (const type of ['Expense', 'Income', 'Transfer']) { await form.getByRole('button', { name: type, exact: true }).click(); await inspect(type + ' form'); }
    await form.getByRole('button', { name: /Date, time/ }).click(); await inspect('Transaction details'); await close();
    await page.locator('.connection-button').click(); await inspect('Storage and backup help'); await close();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(state);
    await mkdir('.local/screenshots', { recursive: true });
    await writeFile(`.local/text-audit-${width}-${scale}.json`, JSON.stringify(rows, null, 2));
    expect(rows.flatMap(r => r.undersized.map(t => ({ screen: r.label, ...t })))).toEqual([]);
    if (width === 370 && scale === 1) {
      await navigate('Insights'); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '.local/screenshots/readability-insights-370.png' });
      await navigate('Dashboard'); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '.local/screenshots/readability-dashboard-370.png' });
      await page.locator('.hero-actions').getByRole('button', { name: 'Add transaction', exact: true }).click(); await page.screenshot({ path: '.local/screenshots/readability-entry-370.png' });
    }
  });
}

for (const scale of [1, 2]) test(`sign-in and connection errors remain readable at 320px, ${scale * 100}% font size`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: false, aiEnabled: false } }));
  await page.goto('/'); await expect(page.getByLabel('Your password')).toBeVisible();
  await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
  expect((await audit(page, 'Sign-in', scale)).undersized).toEqual([]);
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ status: 503, json: { error: 'Connection unavailable. Your records have not been changed.' } }));
  await page.reload(); await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
  expect((await audit(page, 'Connection error', scale)).undersized).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'))).toBeNull();
});
