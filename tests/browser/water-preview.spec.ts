import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
for (const width of [320, 390, 768, 1440]) test(`clear water: five pages and Add at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
  await page.goto('/?preview=simple'); await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  await mkdir('.local/clear-water/screenshots', { recursive: true });
  for (const name of ['Home', 'Income', 'Expenses', 'Cash flow', 'Advanced']) {
    await page.getByRole('button', { name, exact: true }).filter({ visible: true }).click();
    await page.screenshot({ path: `.local/clear-water/screenshots/${name}-${width}.png`, animations: 'disabled', fullPage: true });
    if (width < 760) await page.screenshot({ path: `.local/clear-water/screenshots/${name}-${width}-viewport.png`, animations: 'disabled' });
  }
  await page.getByRole('button', { name: 'Add entry', exact: true }).filter({ visible: true }).click();
  await page.screenshot({ path: `.local/clear-water/screenshots/Add-${width}.png`, animations: 'disabled' });
});
