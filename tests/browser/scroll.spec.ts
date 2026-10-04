import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible(); }
async function swipe(page: Page, x: number, y: number, distance = 350) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance * i / 12 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
for (const width of [320, 390, 497, 768, 1440]) test(`pages and forms respond to scrolling at ${width}px`, async ({ page }) => {
  test.setTimeout(60000); await page.setViewportSize({ width, height: 842 }); await open(page);
  for (const name of ['Dashboard', 'Budget', 'Accounts', 'Insights']) {
    await page.getByRole('button', { name, exact: true }).last().click(); await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(Math.round(width / 2), 600); await page.mouse.wheel(0, 600); await expect.poll(() => page.evaluate(() => scrollY), { message: name + ' scrolls with wheel' }).toBeGreaterThan(100);
  }
  await page.getByRole('button', { name: 'Budget', exact: true }).last().click(); await page.evaluate(() => { window.scrollTo(0, 0); document.body.style.overflow = 'hidden'; });
  await swipe(page, Math.round(width / 2), 630); await expect.poll(() => page.evaluate(() => scrollY), { message: 'Budget scrolls with touch' }).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Add transaction', exact: true }).last().click(); const form = page.getByRole('dialog');
  await form.getByRole('button', { name: /Date, time/ }).click();
  const before = await page.evaluate(() => scrollY); await form.evaluate(el => el.scrollTop = 0);
  const box = await form.boundingBox(); const x = box!.x + box!.width * .5, y = box!.y + box!.height * .6;
  await page.mouse.move(x, y); await page.mouse.wheel(0, 500); await expect.poll(() => form.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await form.evaluate(el => el.scrollTop = 0); await swipe(page, x, y, Math.min(250, box!.height * .4)); await expect.poll(() => form.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
  await page.keyboard.press('Escape'); await expect(form).toBeHidden(); await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(width / 2, 600); await page.mouse.wheel(0, 500); await expect.poll(() => page.evaluate(() => scrollY), { message: 'Page unlocks after closing form' }).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Tracker settings', exact: true }).click(); await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.move(width / 2, 600); await page.mouse.wheel(0, 500); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
});

test('horizontal review menu still allows vertical page scrolling and touch starting on controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 842 }); await open(page);
  await page.getByRole('button', { name: 'Budget', exact: true }).last().click();
  const menu = page.getByRole('navigation', { name: 'Financial review navigation' }); await menu.evaluate(el => el.scrollLeft = 0);
  await menu.scrollIntoViewIfNeeded(); let box = await menu.boundingBox(); await page.mouse.move(box!.x + 70, box!.y + 20); await page.mouse.wheel(500, 0);
  await expect.poll(() => menu.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  const before = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 350); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 50);
  await page.evaluate(() => window.scrollTo(0, 0)); box = await page.locator('.scope-picker').boundingBox();
  await swipe(page, box!.x + 60, box!.y + box!.height / 2, 180); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
