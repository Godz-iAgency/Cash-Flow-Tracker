import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
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
  const content = form.locator('.modal-content'); const before = await page.evaluate(() => scrollY); await content.evaluate(el => el.scrollTop = 0);
  const box = await form.boundingBox(); const x = box!.x + box!.width * .5, y = box!.y + box!.height * .6;
  await page.mouse.move(x, y); await page.mouse.wheel(0, 500); await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await content.evaluate(el => el.scrollTop = 0); await swipe(page, x, y, Math.min(250, box!.height * .4)); await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
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

for (const width of [320, 497, 768, 1440]) test(`Settings scrolls to backup without changing records at ${width}px`, async ({ page }) => {
  const state = initialState();
  await page.addInitScript(data => localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(data)), state);
  await page.setViewportSize({ width, height: 450 }); await open(page);
  await page.getByRole('button', { name: 'Tracker settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tracker settings', exact: true });
  const content = dialog.getByRole('region', { name: 'Tracker settings content' });
  const before = await page.evaluate(() => scrollY);
  expect(await content.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
  const box = await content.boundingBox(); const x = box!.x + box!.width / 2, y = box!.y + box!.height * .8;
  await page.mouse.move(x, y); await page.mouse.wheel(0, 600);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await content.evaluate(el => el.scrollTop = 0);
  await swipe(page, x, y, Math.min(160, box!.height * .6));
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(30);
  await content.focus(); await page.keyboard.press('End');
  await expect.poll(() => content.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(3);
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export full backup' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^cash-flow-backup-.*\.json$/);
  const { exportedAt, ...exportedState } = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(Number.isFinite(Date.parse(exportedAt))).toBe(true);
  expect(exportedState).toEqual(state);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(state);
  await dialog.getByRole('button', { name: 'Storage & connection' }).click();
  await expect(page.getByRole('dialog', { name: 'Storage & backup', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(width / 2, 280); await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
});

test('Settings backup is reachable in the supplied 497px tablet layout', async ({ page }) => {
  await page.setViewportSize({ width: 497, height: 842 }); await open(page);
  await page.getByRole('button', { name: 'Tracker settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Export full backup' }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Export full backup' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  await page.screenshot({ path: '.local/screenshots/settings-backup-497.png' });
});
