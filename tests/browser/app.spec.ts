import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
}
async function add(page: Page, amount: string, merchant: string, type = 'Expense', account?: string, destination?: string) {
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Add a transaction' });
  await dialog.getByRole('button', { name: type, exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Amount', exact: true }).fill(amount);
  await dialog.locator('#merchant').fill(merchant);
  await dialog.locator('#account').selectOption(account ?? 'capital-one-checking');
  if (destination) await dialog.locator('#to-account').selectOption(destination);
  await dialog.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(dialog).toBeHidden();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`all screens and quick entry fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await open(page);
    for (const name of ['Dashboard', 'Transactions', 'Budget', 'Accounts', 'Insights']) {
      await page.getByRole('button', { name, exact: true }).click();
      await noOverflow(page);
      await expect(page.getByRole('button', { name: 'Add transaction', exact: true }).last()).toBeVisible();
    }
    await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click();
    const dialog = page.getByRole('dialog', { name: 'Add a transaction' });
    for (const type of ['Expense', 'Income', 'Transfer']) {
      await dialog.getByRole('button', { name: type, exact: true }).click();
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    if (width === 390 || width === 1440) { await mkdir('.local/screenshots', { recursive: true }); await page.screenshot({ path: `.local/screenshots/dashboard-${width}.png`, fullPage: true }); }
  });
}
test('ten-cent expense, income, transfer, edit and browser persistence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page);
  await add(page, '0.10', 'Tiny purchase');
  await add(page, '1300.00', 'Paycheck', 'Income');
  await add(page, '25.00', 'Savings transfer', 'Transfer', 'capital-one-checking', 'capital-one-savings');
  await expect(page.locator('.money-card').filter({ has: page.getByText('Income received', { exact: true }) }).getByRole('heading')).toHaveText('$1,300.00');
  await expect(page.locator('.money-card').filter({ has: page.getByText('Money spent', { exact: true }) }).getByRole('heading')).toHaveText('$0.10');
  await expect(page.locator('.money-card').filter({ has: page.getByText('Net cash flow', { exact: true }) }).getByRole('heading')).toHaveText('$1,299.90');
  await page.reload(); await expect(page.getByRole('button', { name: 'Edit Tiny purchase, $0.10' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Tiny purchase, $0.10' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Amount', exact: true }).fill('0.20');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(stored.transactions).toHaveLength(3);
  expect(stored.audit).toHaveLength(4);
  expect(stored.audit.at(-1).before.amountCents).toBe(10);
  expect(stored.audit.at(-1).after.amountCents).toBe(20);
  expect(stored.transactions.find((t: any) => t.merchant === 'Tiny purchase').revision).toBe(2);
  await page.getByRole('button', { name: 'Transactions', exact: true }).click(); await noOverflow(page);
  await page.getByRole('button', { name: 'Business', exact: true }).click();
  await expect(page.getByText('Tiny purchase', { exact: true })).toBeHidden();
});
test('monthly budget edits and manually maintained account balances', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(page.locator('.money-card').filter({ has: page.getByText('Planned expenses', { exact: true }) }).getByRole('heading')).toHaveText('$2,569.30');
  await page.getByRole('button', { name: 'Edit Grocery budget' }).click();
  await page.getByRole('dialog').getByLabel('Planned amount ($)').fill('300.00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.money-card').filter({ has: page.getByText('Planned expenses', { exact: true }) }).getByRole('heading')).toHaveText('$2,619.30');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.locator('.money-card').filter({ has: page.getByText('Planned expenses', { exact: true }) }).getByRole('heading')).toHaveText('$2,569.30');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.account-card')).toHaveCount(5);
  const account = page.locator('.account-card').filter({ hasText: 'Capital One Personal Checking' });
  await expect(account.locator('.account-balance strong')).toHaveText('Not set');
  await account.getByRole('button', { name: 'Update balance' }).click();
  await page.getByRole('dialog').locator('#edit-value').fill('123.45');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(account.locator('.account-balance strong')).toHaveText('$123.45');
});
test('populated ledger handles long labels, cents, and every screen on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await open(page);
  await add(page, '6.42', 'A merchant with a very long name that needs to wrap on phones');
  for (const name of ['Dashboard', 'Transactions', 'Budget', 'Accounts', 'Insights']) { await page.getByRole('button', { name, exact: true }).click(); await noOverflow(page); }
  await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: 'Business', exact: true }).click();
  await noOverflow(page); await expect(page.locator('.account-card')).toHaveCount(2);
});
test('entries from another browser tab stay in the shared on-device ledger', async ({ page, context }) => {
  await open(page);
  const second = await context.newPage(); await open(second);
  await page.bringToFront();
  await add(page, '0.10', 'First tab entry');
  await second.bringToFront();
  await expect(second.getByRole('button', { name: 'Edit First tab entry, $0.10' })).toBeVisible();
  await add(second, '0.20', 'Second tab entry');
  await page.bringToFront();
  await expect(page.getByRole('button', { name: 'Edit Second tab entry, $0.20' })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(stored.transactions).toHaveLength(2); expect(stored.audit).toHaveLength(2);
});
