import { test, expect } from '@playwright/test';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { contrastAudit } from './water-contrast';

async function go(page: any, name: string) { await page.getByRole('button', { name, exact: true }).filter({ visible: true }).click(); }
test.beforeEach(async ({ page }) => {
  await page.addInitScript(s => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(s)); }, initialState());
});

test('monthly Paid records partial and full payments once and opens records instead of deleting them', async ({ page }) => {
  await page.goto('/'); await go(page, 'Expenses');
  const rent = page.locator('.expense-row').filter({ has: page.getByText('Rent', { exact: true }) });
  await rent.getByRole('checkbox').click(); await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('1210.00');
  await page.getByLabel('Amount', { exact: true }).fill('200'); await page.getByLabel('Paid from').selectOption('capital-one-checking'); await go(page, 'Save');
  await expect(rent.getByRole('checkbox')).not.toBeChecked(); await expect(rent).toContainText('$1,010.00 left');
  await rent.getByRole('checkbox').click(); await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('1010.00');
  await go(page, 'Save'); await expect(rent.getByRole('checkbox')).toBeChecked();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(saved.transactions).toHaveLength(2);
  await rent.getByRole('checkbox').click(); await expect(page.getByRole('dialog')).toHaveAccessibleName('Rent payments');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!).transactions)).toEqual(saved.transactions);
  await page.keyboard.press('Escape'); await go(page, 'Next month'); await expect(rent.getByRole('checkbox')).not.toBeChecked();
  await rent.getByRole('checkbox').click(); await page.getByLabel('Paid from').selectOption('capital-one-checking'); await go(page, 'Save');
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); const following = new Date(); following.setDate(15); following.setMonth(following.getMonth() + 1); expect(next.transactions.at(-1).date).toBe(`${localDate(following).slice(0, 7)}-01`);
  await go(page, 'Previous month'); await expect(rent.getByRole('checkbox')).toBeChecked();
});

test('a personal bill paid from a business account stays a personal expense', async ({ page }) => {
  await page.goto('/'); await go(page, 'Expenses');
  const phone = page.locator('.expense-row').filter({ has: page.getByText('Phone', { exact: true }) });
  await phone.getByRole('checkbox').click(); await page.getByLabel('Paid from').selectOption('chase-savings'); await go(page, 'Save');
  await expect(phone.getByRole('checkbox')).toBeChecked();
  const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!).transactions[0]);
  expect(entry.scope).toBe('Personal'); expect(entry.accountId).toBe('chase-savings'); expect(entry.amountCents).toBe(4500);
});

test('income sources follow scope and fill the actual receiving account', async ({ page }) => {
  await page.goto('/'); await go(page, 'Income'); await go(page, 'Business'); await go(page, 'Add source');
  await expect(page.getByLabel('Personal or Business')).toHaveValue('Business'); await expect(page.getByLabel('Group', { exact: true })).toHaveValue('Business income');
  await page.getByLabel('Name', { exact: true }).fill('Client work'); await page.getByLabel('Paid into').selectOption('chase-savings'); await go(page, 'Save source');
  const source = page.locator('.source-row').filter({ hasText: 'Client work' }); await source.getByRole('button', { name: 'Add pay' }).click();
  await expect(page.getByLabel('From whom')).toHaveValue('Client work'); await expect(page.getByLabel('Paid into')).toHaveValue('chase-savings');
  await page.getByLabel('Amount', { exact: true }).fill('500'); await go(page, 'Save'); await expect(page.locator('.water-value')).toContainText('$500.00');
  await go(page, 'Personal'); await expect(page.locator('.source-row')).not.toContainText('Client work'); await expect(page.locator('.water-value')).toContainText('$0.00');
  await go(page, 'Business'); await go(page, 'Expenses'); await expect(page.locator('.expense-row')).toHaveCount(0);
});

test('cash flow makes card purchases, income destinations and transfers touchable without double-counting spending', async ({ page }) => {
  await page.goto('/'); await go(page, 'Cash flow'); await go(page, 'Move money');
  await page.getByLabel('Amount', { exact: true }).fill('50'); await page.getByLabel('From account').selectOption('capital-one-checking'); await page.getByLabel('To account').selectOption('capital-one-savor'); await go(page, 'Pay card');
  await expect(page.locator('.movement-row')).toContainText('1637'); await expect(page.locator('.movement-row')).toContainText('1567'); await page.locator('.movement-row').click(); await expect(page.getByRole('dialog')).toHaveAccessibleName('Edit entry'); await page.keyboard.press('Escape');
  await go(page, 'Advanced'); await page.getByText('Income statement', { exact: true }).click(); const report = page.getByText('Income statement', { exact: true }).locator('..'); await expect(report).toContainText('Money spent$0.00');
  await page.getByText('Cash flow statement', { exact: true }).click(); const cash = page.getByText('Cash flow statement', { exact: true }).locator('..'); await cash.locator('.statement-account > summary').first().click(); await expect(cash).toContainText('Money out$50.00');
  await page.locator('.advanced-ledger > summary').click(); await expect(page.locator('.advanced-ledger .entry-row')).toHaveCount(1);
});

for (const width of [320, 390, 768, 1440, 1920]) test(`water card text and expense controls fit at ${width}px and enlarged text`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.goto('/?preview=simple');
  for (const scale of [1, 2]) {
    await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
    for (const name of ['Home', 'Income', 'Expenses', 'Cash flow', 'Advanced']) {
      await go(page, name); await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${scale}`).toBe(true);
      expect((await contrastAudit(page)).failures, `${name} ${scale}`).toEqual([]);
      if (width <= 760) {
        const tabs = await page.locator('.mobile-nav button').evaluateAll(items => items.map(el => {
          const box = el.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, clipped: el.scrollWidth > el.clientWidth + 1 };
        }));
        expect(tabs).toHaveLength(5);
        const navTop = await page.locator('.mobile-nav').evaluate(el => el.getBoundingClientRect().top);
        const addBottom = await page.locator('.mobile-add').evaluate(el => el.getBoundingClientRect().bottom);
        expect(addBottom).toBeLessThan(navTop);
        for (const tab of tabs) { expect(tab.left).toBeGreaterThanOrEqual(0); expect(tab.right).toBeLessThanOrEqual(width); expect(tab.width).toBeGreaterThanOrEqual(44); expect(tab.clipped).toBe(false); }
      }

      for (const label of await page.locator('.paid-check span').all()) {
        await expect(label).toHaveText('Paid');
        expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      for (const copy of await page.locator('.water-copy').all()) {
        expect(await copy.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
    }
  }
});

test('water image text passes contrast against the darkest and brightest possible photo pixels', async ({ page }) => {
  await page.goto('/?preview=simple');
  const ratios = await page.evaluate(() => {
    const linear = (n: number) => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
    const lum = (c: number[]) => c.reduce((n, v, i) => n + linear(v) * [.2126, .7152, .0722][i], 0);
    const dark = [249, 253, 251].map(n => n * .96), bright = [249, 253, 251].map(n => n * .96 + 255 * .04);
    return [[20, 46, 45], [72, 98, 95], [20, 92, 87]].flatMap(color => [dark, bright].map(bg => (lum(bg) + .05) / (lum(color) + .05)));
  });
  expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  for (const name of ['Home', 'Income', 'Expenses', 'Cash flow']) {
    await go(page, name); await expect(page.locator('.water-copy').first()).toHaveCSS('background-color', 'rgba(249, 253, 251, 0.96)');
  }
});
