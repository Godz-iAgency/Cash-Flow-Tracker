import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {initialState} from '../../shared/seed';
import {waterPreviewState} from './reviewFixture';
import {contrastAudit} from './water-contrast';

async function openCurrent(page:Page) {
 await page.getByRole('button',{name:'Advanced',exact:true}).filter({visible:true}).click();
 await page.getByRole('button',{name:'Current',exact:true}).click();
 return page.getByRole('dialog',{name:'Current',exact:true});
}

test('Current uses only copied account labels and never reads or writes the real cloud records',async({page})=>{
 const source=waterPreviewState(); source.accounts[0].name='My renamed checking';
 let reads=0,writes=0,requests=0;
 await page.route('**/api/status',r=>r.fulfill({json:{configured:true,authenticated:true,backend:'firestore'}}));
 await page.route('**/api/cloud/info',r=>r.fulfill({json:{initialized:true}}));
 await page.route('**/api/state',r=>{reads++;return r.fulfill({json:source});});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) {requests++;if(r.method()!=='GET')writes++;}});
 await page.goto('/'); await expect(page.getByRole('note',{name:'Record storage'})).toHaveText('Saved online');
 const before=await page.evaluate(()=>JSON.stringify({...localStorage})); const count=requests;
 const dialog=await openCurrent(page); await expect(dialog).toContainText('Sandbox'); await expect(dialog).toContainText('Never saved');
 await expect(dialog.locator('.current-cash')).toHaveText('$2,359,971.17');
 await expect(dialog.locator('.current-account')).toHaveCount(5); await expect(dialog).toContainText('My renamed checking');
 const amounts=await dialog.locator('.current-account-money').allTextContents();expect(new Set(amounts).size).toBe(5);
 await dialog.locator('.current-income > summary').click();await expect(dialog).toContainText('$100,000.00');await expect(dialog).toContainText('$60,000.00');await expect(dialog).toContainText('$40,000.00');
 await dialog.getByRole('button',{name:'Business',exact:true}).click();await expect(dialog.locator('.current-account')).toHaveCount(2);await expect(dialog).toContainText('$1,247,890.36');
 await dialog.getByRole('button',{name:'Personal',exact:true}).click();await expect(dialog.locator('.current-account')).toHaveCount(3);
 await dialog.locator('.current-account > summary').first().click();await expect(dialog).toContainText('made-up balance');
 await expect(dialog.getByRole('button',{name:/Save|Move money|Export|Pay card/})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Back to my tracker'}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Current',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(before);expect(reads).toBe(1);expect(writes).toBe(0);expect(requests).toBe(count);
 await page.getByRole('button',{name:'Home',exact:true}).filter({visible:true}).click();await expect(page.locator('.cash-number')).toContainText('$5,617.32');
 await expect(page.locator('main')).not.toContainText('$2,359,971.17'); await expect(page.locator('.entry-row')).toHaveCount(source.transactions.length);
});

for(const {width,scale} of [{width:320,scale:1},{width:390,scale:1},{width:768,scale:1},{width:1440,scale:1},{width:320,scale:2}]) test(`Current is readable, still and isolated at ${width}px, text ${scale}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?preview=simple');await page.evaluate(scale=>document.documentElement.style.fontSize=`${16*scale}px`,scale);
 const before=await page.evaluate(()=>localStorage.getItem('cash-flow-plan-preview-v2')); const requests:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api')) requests.push(r.url());});
 const dialog=await openCurrent(page);await expect(dialog.locator('.current-account')).toHaveCount(initialState().accounts.length);
 const labels=await dialog.locator('.current-scope button').evaluateAll(buttons=>buttons.map(button=>{const range=document.createRange();range.selectNodeContents(button);const text=range.getBoundingClientRect(),box=button.getBoundingClientRect();return {label:button.textContent,fits:text.left>=box.left&&text.right<=box.right&&text.top>=box.top&&text.bottom<=box.bottom,lines:range.getClientRects().length};}));
 expect(labels.map(l=>l.label)).toEqual(['All','Personal','Business']);expect(labels.every(l=>l.fits&&l.lines===1)).toBe(true);
 expect((await contrastAudit(page)).failures).toEqual([]);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
 await dialog.getByRole('button',{name:'Business',exact:true}).click();await dialog.locator('.current-account > summary').first().click();
 expect((await contrastAudit(page)).failures).toEqual([]);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await dialog.getByRole('button',{name:'All',exact:true}).click();
 if(scale===1){ await mkdir('.local/current',{recursive:true});await dialog.locator('.modal-content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`.local/current/Current-${width}.png`,animations:'disabled'});await dialog.locator('.current-account').last().scrollIntoViewIfNeeded();await page.screenshot({path:`.local/current/Accounts-${width}.png`,animations:'disabled'});}
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>localStorage.getItem('cash-flow-plan-preview-v2'))).toBe(before);expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Home',exact:true}).filter({visible:true}).click();await expect(page.locator('.cash-number')).toContainText('$0.00');
});
