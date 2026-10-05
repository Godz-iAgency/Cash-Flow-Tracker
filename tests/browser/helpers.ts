import { expect, type Page } from '@playwright/test';

export async function openMore(page: Page, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'More', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name, exact: true }).click();
}
