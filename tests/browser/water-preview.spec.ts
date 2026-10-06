import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const mode of ['dark', 'light'] as const) test(`${mode}: Home, Budget and Add review screenshots`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(mode => localStorage.setItem('cash-flow-appearance', mode), mode);
  await page.goto('/?preview=water'); await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  await mkdir('.local/water/screenshots', { recursive: true });
  await page.screenshot({ path: `.local/water/screenshots/home-${mode}.png`, animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await page.screenshot({ path: `.local/water/screenshots/budget-${mode}.png`, animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Add entry', exact: true }).filter({ visible: true }).click();
  await page.screenshot({ path: `.local/water/screenshots/add-${mode}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape'); await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.screenshot({ path: `.local/water/screenshots/phone-home-${mode}.png`, animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await page.screenshot({ path: `.local/water/screenshots/phone-budget-${mode}.png`, animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.screenshot({ path: `.local/water/screenshots/phone-add-${mode}.png`, animations: 'disabled' });
});
