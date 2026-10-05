import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { waterPreviewState } from '../../shared/waterPreview';
import { openMore } from './helpers';
import { contrastAudit } from './water-contrast';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(state => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(state)); }, waterPreviewState());
});
for (const mode of ['dark', 'light'] as const) test(`${mode}: text contrast on every page and form, with unchanged responsive layout`, async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(mode => localStorage.setItem('cash-flow-appearance', mode), mode);
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const results: { screen: string; count: number; failures: unknown[] }[] = [];
  const audit = async (screen: string) => { await page.waitForTimeout(200); results.push({ screen, ...await contrastAudit(page) }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); };
  await audit('Home');
  for (const name of ['Transactions', 'Budget', 'Accounts', 'Insights']) { await page.getByRole('button', { name, exact: true }).click(); await audit(name); }
  for (const name of ['Notes & Reminders', 'View money flow', 'Review check-in history', 'View month-end review']) { await openMore(page, name); await audit(name); }
  await openMore(page, 'Tracker settings'); await audit('Settings'); await page.keyboard.press('Escape');
  await openMore(page, 'Storage & backup'); await audit('Storage'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Advanced', exact: true }).click(); await audit('Advanced and appearance'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  for (const type of ['Expense', 'Income', 'Transfer']) { await page.getByRole('dialog').getByRole('button', { name: type, exact: true }).click(); await audit('Add ' + type); }
  await page.getByRole('dialog').getByRole('button', { name: /Date, time/ }).click(); await audit('Add details'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click(); await page.locator('.account-card').first().getByRole('button', { name: 'Compare actual balance' }).click(); await audit('Bank comparison'); await page.keyboard.press('Escape');
  await page.locator('.account-card').first().getByRole('button', { name: 'Update balance' }).click(); await audit('Balance edit'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Budget', exact: true }).click(); await page.getByRole('button', { name: 'Edit Rent budget' }).click(); await audit('Budget edit'); await page.keyboard.press('Escape');
  await page.getByText('Payment accounts & due dates', { exact: true }).click(); await page.locator('.funding-list article').first().getByRole('button', { name: 'Assign funding' }).click(); await audit('Payment details'); await page.keyboard.press('Escape');
  await mkdir('.local/water', { recursive: true }); await writeFile(`.local/water/contrast-${mode}.json`, JSON.stringify(results, null, 2));
  expect(results.flatMap(result => result.failures.map(failure => ({ screen: result.screen, ...failure as object })))).toEqual([]);
});

test('appearance switch persists without modifying financial records; preview makes no cloud requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()); });
  await page.goto('/?preview=water'); await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  await page.getByRole('button', { name: 'Advanced', exact: true }).click(); await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(original);
});

test('reduce motion has no animations or ripples, including during tab changes and Add', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Budget', exact: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Add transaction', exact: true }).filter({ visible: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cash-flow-saved', { detail: { x: 100, y: 200 } })));
  await expect(page.locator('.save-ripple')).toHaveCount(0);
});

test('only the Home wave repeats, it pauses in the background, and Add is completely still', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.home-wave')).toBeVisible(); await page.waitForTimeout(400);
  const animations = await page.evaluate(() => document.getAnimations().map(animation => ({ iterations: animation.effect?.getTiming().iterations, duration: animation.effect?.getTiming().duration })));
  expect(animations).toEqual([{ iterations: Infinity, duration: 28000 }]);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.home-wave')).toHaveCSS('animation-play-state', 'paused');
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.home-wave')).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Add transaction', exact: true }).filter({ visible: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Income', exact: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

for (const type of ['Expense', 'Income', 'Transfer'] as const) test(`${type}: one save ripple, Saved with Undo, and no duplicate financial entry`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click(); const form = page.getByRole('dialog');
  await form.getByRole('button', { name: type, exact: true }).click(); await form.locator('#amount').fill('0.05'); await form.locator('#merchant').fill('Water test'); await form.locator('#account').selectOption('capital-one-checking');
  if (type === 'Transfer') await form.locator('#to-account').selectOption('capital-one-savor');
  await form.evaluate(element => { const form = element.querySelector('form')!; form.requestSubmit(); form.requestSubmit(); }); await expect(form).toBeHidden(); await expect(page.locator('.toast')).toContainText('Saved');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(saved.transactions.length).toBe(before.transactions.length + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('.toast')).toContainText('Undone');
  const undone = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!)); expect(undone.transactions).toEqual(before.transactions); expect(undone.audit.length).toBe(before.audit.length + 2);
  await expect(page.locator('.save-ripple')).toHaveCount(0);
});

test('phone scrolling stays smooth with the wave and a single ripple', async ({ page }) => {
  test.setTimeout(60000); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.home-wave')).toBeVisible();
  const session = await page.context().newCDPSession(page); await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const sample = async (effects: boolean) => page.evaluate(async effects => {
    document.querySelector<SVGElement>('.home-wave')!.style.animationPlayState = effects ? 'running' : 'paused';
    const intervals: number[] = []; const start = performance.now(); let previous = start, rippled = false;
    await new Promise<void>(resolve => { function frame(now: number) {
      const elapsed = now - start;
      if (elapsed > 250) intervals.push(now - previous);
      previous = now; window.scrollTo(0, 200 + Math.sin(now / 400) * 150);
      if (effects && !rippled && elapsed > 1400) { rippled = true; window.dispatchEvent(new CustomEvent('cash-flow-saved', { detail: { x: 280, y: 600 } })); }
      if (elapsed < 4250) requestAnimationFrame(frame); else resolve();
    } requestAnimationFrame(frame); });
    return intervals;
  }, effects);
  // Alternate order over longer windows to avoid a two-second host scheduling spike
  // deciding the result. The limits remain strict and the effects add no timers per frame.
  const baselineFrames: number[] = [], effectFrames: number[] = [];
  for (const order of [[false, true], [true, false], [false, true]]) for (const enabled of order) (enabled ? effectFrames : baselineFrames).push(...await sample(enabled));
  const metrics = (frames: number[]) => { frames.sort((a, b) => a - b); return { frames: frames.length, p95: frames[Math.floor(frames.length * .95)], stalled: frames.filter(value => value > 50).length / frames.length }; };
  const baseline = metrics(baselineFrames), effects = metrics(effectFrames); await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await mkdir('.local/water', { recursive: true }); await writeFile('.local/water/scroll-timing.json', JSON.stringify({ baseline, effects }, null, 2));
  expect(effects.p95).toBeLessThanOrEqual(Math.max(24, baseline.p95 + 4)); expect(effects.stalled).toBeLessThanOrEqual(Math.max(.03, baseline.stalled + .015));
});
