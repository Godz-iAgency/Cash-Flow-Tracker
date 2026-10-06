import { test, expect } from '@playwright/test';
import { waterPreviewState } from '../../shared/waterPreview';
for (const width of [320,390,768,1024,1440,1920]) test(`interactive layout and five tabs at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844}); await page.goto('/?preview=simple'); await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 for(const name of ['Home','Income','Expenses','Cash flow','Advanced']) { await page.getByRole('button',{name,exact:true}).filter({visible:true}).click(); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true); const nav=page.getByRole('navigation',{name:width<=760?'Mobile navigation':'Main navigation'}); await expect(nav.getByRole('button')).toHaveCount(5); await expect(nav.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page'); }
 await page.getByRole('button',{name:'Add entry',exact:true}).filter({visible:true}).click(); const form=page.getByRole('dialog'); for(const name of ['I spent','I got paid','Move money']) { await form.getByRole('button',{name,exact:true}).click(); expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true); } await page.keyboard.press('Escape');
});
test('unknown balances show known money and never a giant Not set',async({page})=>{
 const state=waterPreviewState(); state.accounts[1].balanceCents=null; await page.addInitScript(state=>localStorage.setItem('cash-flow-tracker-v1',JSON.stringify(state)),state); await page.goto('/'); await expect(page.locator('.cash-number')).not.toContainText('Not set'); await expect(page.locator('.missing-balances')).toContainText('1 bank balance to add'); await page.locator('.missing-balances summary').click(); await page.getByRole('button',{name:/Add balance for Capital One Personal Savings/}).click(); await expect(page.getByRole('dialog',{name:'Check my bank'})).toBeVisible();
});
