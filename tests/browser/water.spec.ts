import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { waterPreviewState } from '../../shared/waterPreview';
import { openMore } from './helpers';
test.beforeEach(async ({ page }) => { await page.addInitScript(state => { if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1', JSON.stringify(state)); }, waterPreviewState()); });
test('appearance switch persists without modifying financial records; preview makes no cloud requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()); });
  await page.goto('/?preview=water'); await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!))).toEqual(original);
});

test('reduce motion has no animations or ripples, including during tab changes and Add', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Plan', exact: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Add entry', exact: true }).filter({ visible: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
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
  await page.getByRole('button', { name: 'Add entry', exact: true }).filter({ visible: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'I got paid', exact: true }).click(); expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

for (const type of ['I spent', 'I got paid', 'Move money'] as const) test(`${type}: one save ripple, Saved with Undo, and no duplicate financial entry`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  await page.getByRole('button', { name: 'Add entry', exact: true }).click(); const form = page.getByRole('dialog');
  await form.getByRole('button', { name: type, exact: true }).click(); await form.locator('#amount').fill('0.05'); if (type === 'I spent') { await form.getByRole('combobox', { name: 'What for' }).fill('Grocery'); await page.keyboard.press('Tab'); } await form.locator('#account').selectOption('capital-one-checking');
  if (type === 'Move money') await form.locator('#to-account').selectOption('capital-one-savor');
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
