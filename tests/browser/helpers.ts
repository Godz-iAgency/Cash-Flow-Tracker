import { expect, type Page } from '@playwright/test';

export async function openMore(page: Page, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  const menu = page.locator('main');
  await expect(menu).toBeVisible();
  const target = menu.getByRole('button', { name, exact: true }); if (!await target.isVisible()) await menu.getByText('Advanced', { exact: true }).click(); await target.click();
}
export async function openDetailedEntry(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  const advanced = page.locator('.advanced-tools');
  if (!await advanced.evaluate(el => (el as HTMLDetailsElement).open)) await advanced.locator(':scope > summary').click();
  const section = page.getByText('Past changes & other tools', { exact: true }).locator('..');
  if (!(await section.evaluate(el => (el as HTMLDetailsElement).open))) await section.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'More entry options', exact: true }).click();
}
