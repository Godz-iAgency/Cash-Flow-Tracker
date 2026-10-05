import { expect, type Page } from '@playwright/test';

export async function openMore(page: Page, name: string) {
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Advanced', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name, exact: true }).click();
}
