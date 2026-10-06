import { expect, type Page } from '@playwright/test';

// Existing financial regression cases still exercise the deeper monthly plan.
// The everyday expense list has its own receipt/payment tests in clear-water.spec.
export async function navigateTest(page: Page, name: string): Promise<void> {
  const direct = async (label: string) => page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).click();
  if (name === 'More') return direct('Advanced');
  if (name === 'History') { await direct('Advanced'); await page.locator('.advanced-ledger > summary').click(); return; }
  if (name === 'Plan') { await direct('Advanced'); if (!await page.locator('.advanced-tools').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.advanced-tools > summary').click(); const plan = page.getByText('Monthly plan', { exact: true }).locator('..'); if (!await plan.evaluate(el => (el as HTMLDetailsElement).open)) await plan.locator(':scope > summary').click(); return; }
  if (name === 'My money') return openMore(page, 'Banks & cards');
  if (name === 'Money in & out') return direct('Cash flow');
  if (['My spending', 'Daily checks', 'Monthly review', 'Notes & reminders'].includes(name)) {
    const tools = page.locator('.advanced-tools');
    if (await tools.count() && !await tools.evaluate(el => (el as HTMLDetailsElement).open)) await tools.locator(':scope > summary').click();
  }
  return direct(name);
}

export async function openMore(page: Page, name: string): Promise<void> {
  if (name === 'Money in & out') return navigateTest(page, name);
  await page.getByRole('button', { name: 'Advanced', exact: true }).filter({ visible: true }).click();
  const menu = page.locator('main');
  await expect(menu).toBeVisible();
  const target = menu.getByRole('button', { name, exact: true }); if (!await target.isVisible()) await menu.getByText('More tools', { exact: true }).click(); await target.click();
}
export async function openDetailedEntry(page: Page) {
  await page.getByRole('button', { name: 'Advanced', exact: true }).filter({ visible: true }).click();
  const advanced = page.locator('.advanced-tools');
  if (!await advanced.evaluate(el => (el as HTMLDetailsElement).open)) await advanced.locator(':scope > summary').click();
  const section = page.getByText('Past changes & other tools', { exact: true }).locator('..');
  if (!(await section.evaluate(el => (el as HTMLDetailsElement).open))) await section.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'More entry options', exact: true }).click();
}
