import { test, expect } from '@playwright/test';
import { localDate, validateTransaction } from '../../shared/model';
import { initialState } from '../../shared/seed';
import { currentBalance } from '../../shared/allocation';
import { contrastAudit } from './water-contrast';

for (const width of [320, 390, 768, 1440]) test(`direct balance editing preserves entries and other accounts at ${width}`, async ({page}) => {
  const source = initialState();
  source.transactions.push(validateTransaction({id:'preserved-test-receipt',type:'Expense',amountCents:111,merchant:'Test-only receipt',description:'',notes:'',toAccountId:'',category:'Miscellaneous',subcategory:'',accountId:'capital-one-checking',scope:'Personal',classification:'Need',date:localDate(),time:'00:00'},source));
  await page.setViewportSize({width, height: 900});
  await page.addInitScript(s => {if (!localStorage.getItem('cash-flow-tracker-v1')) localStorage.setItem('cash-flow-tracker-v1',JSON.stringify(s));}, source);
  await page.goto('/'); await page.locator('.cash-number').click();
  await expect(page.getByRole('heading',{name:'Cash flow',level:1})).toBeVisible();
  const pencil = page.getByRole('button',{name:'Edit balance for Capital One Personal Checking',exact:true});
  await expect(pencil).toBeVisible();
  await expect(page.locator('.account-row').first()).not.toHaveAttribute('open','');
  await pencil.click(); await expect(page.getByRole('dialog',{name:'Edit balance'})).toBeVisible();
  await page.getByLabel('Balance in your bank app',{exact:true}).fill('1234.56');
  await page.getByRole('button',{name:'Save balance',exact:true}).dblclick();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(state.transactions).toEqual(source.transactions); expect(state.budgets).toEqual(source.budgets);
  expect(currentBalance(state,state.accounts[0])).toBe(123456);
  expect(state.accounts.slice(1)).toEqual(source.accounts.slice(1));
  // Each correction keeps the before observation and the confirmed corrected balance.
  expect(state.balanceReconciliations).toHaveLength(2); expect(state.audit).toHaveLength(1);
  const firstHistory = state.balanceReconciliations;
  await pencil.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Balance in your bank app',{exact:true})).toHaveValue('1234.56');
  await page.getByLabel('Balance in your bank app',{exact:true}).fill('1200.01'); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await page.locator('.cash-number').click();
  await expect(page.locator('.account-row').first().locator('summary')).toContainText('$1,200.01');
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-flow-tracker-v1')!));
  expect(state.transactions).toEqual(source.transactions); expect(state.balanceReconciliations).toHaveLength(4); expect(state.audit).toHaveLength(2);
  expect(state.balanceReconciliations.slice(0,2)).toEqual(firstHistory);
  expect(state.balanceReconciliations[0].actualBalanceCents).toBe(123456);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  expect((await contrastAudit(page)).failures).toEqual([]);
});

test('expanded accounts and water headings fit with doubled text and high contrast',async({page})=>{
  await page.setViewportSize({width:320,height:900}); await page.emulateMedia({reducedMotion:'reduce',contrast:'more'});
  await page.goto('/?preview=simple'); await page.evaluate(() => document.documentElement.style.fontSize='32px');
  for (const name of ['Home','Income','Expenses','Cash flow','Advanced']) {
    await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();
    if(name==='Cash flow') {await page.locator('.account-row').first().locator('summary').click();}
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), name).toBe(true);
    expect((await contrastAudit(page)).failures,name).toEqual([]);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  }
});
