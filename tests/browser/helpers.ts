import { expect, type Page } from '@playwright/test';

export async function openMore(page: Page, name: string) {
  await page.getByRole('button', { name: 'Advanced', exact: true }).filter({ visible: true }).click();
  const menu = page.locator('main');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name, exact: true }).click();
}
export async function openDetailedEntry(page: Page) {
  await page.getByRole('button', { name: 'Advanced', exact: true }).filter({ visible: true }).click();
  const section = page.locator('details').filter({ has: page.getByText('Account history & extra tools', { exact: true }) });
  if (!(await section.evaluate(el => (el as HTMLDetailsElement).open))) await section.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'Detailed entry form', exact: true }).click();
}
