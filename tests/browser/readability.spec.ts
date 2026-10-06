import { openMore } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialState } from '../../shared/seed';
import { localDate, validateTransaction } from '../../shared/model';
import { validateAction } from '../../shared/actions';

type TextAudit = { label: string; count: number; min: number; sizes: number[]; undersized: { text: string; size: number; className: string }[] };
async function audit(page: Page, label: string, scale: number): Promise<TextAudit> {
  const result = await page.evaluate(({ label, scale }) => {
    const root = document.querySelector('[role="dialog"]') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rows: { text: string; size: number; className: string; floor: number }[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement; if (!el || !node.textContent?.trim() || el.closest('svg, script, style, option, [aria-hidden="true"]')) continue;
      const style = getComputedStyle(el), range = document.createRange(); range.selectNodeContents(node);
      if (style.visibility !== 'visible' || ![...range.getClientRects()].some(r => r.width > 0 && r.height > 0)) continue;
      rows.push({ text: node.textContent.trim().slice(0, 100), size: parseFloat(style.fontSize), className: el.className, floor: (el.closest('.mobile-nav') ? 12 : 14) * scale });
    }
    for (const el of root.querySelectorAll('input:not([type="checkbox"]), select, textarea')) {
      if (!(el as HTMLElement).offsetWidth) continue;
      rows.push({ text: el.getAttribute('aria-label') ?? el.id, size: parseFloat(getComputedStyle(el).fontSize), className: el.className, floor: 16 * scale });
    }
    return { label, count: rows.length, min: Math.min(...rows.map(r => r.size)), sizes: [...new Set(rows.map(r => r.size))].sort((a, b) => a - b), undersized: rows.filter(r => r.size + .1 < r.floor) };
  }, { label, scale });
  const overflow = await page.evaluate(() => [...document.body.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'absolute' && !el.closest('.extension-nav'); }).slice(0, 12).map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent?.slice(0, 70), right: el.getBoundingClientRect().right })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': page width ' + JSON.stringify(overflow)).toBe(true);
  const clippedTabs = await page.locator('.scope-picker button, .mobile-nav button span').evaluateAll(elements => elements.filter(el => {
    const box = el.getBoundingClientRect(); if (!box.width || !box.height) return false;
    const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].some(r => r.left < box.left - 1 || r.right > box.right + 1);
  }).map(el => el.textContent));
  expect(clippedTabs, label + ': full tab labels').toEqual([]);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': dialog width').toBe(true);
  return result;
}
for(const {width,scale} of [{width:320,scale:1},{width:390,scale:1},{width:768,scale:1},{width:1440,scale:1},{width:370,scale:1.25},{width:320,scale:2}]) test(`all core views and entry forms respect text size ${width}px ${scale}`,async({page})=>{
 test.setTimeout(90000); await page.setViewportSize({width,height:844}); await page.goto('/?preview=simple'); await page.evaluate(scale=>document.documentElement.style.fontSize=`${scale*100}%`,scale);
 for(const name of ['Home','Activity','Budget','Accounts','Advanced']) { await page.getByRole('button',{name,exact:true}).filter({visible:true}).click(); const result=await audit(page,name,scale); expect(result.undersized).toEqual([]); }
 await page.getByRole('button',{name:'Add entry',exact:true}).filter({visible:true}).click(); for(const type of ['Spent','Got paid','Move money']) { await page.getByRole('dialog').getByRole('button',{name:type,exact:true}).click(); expect((await audit(page,type,scale)).undersized).toEqual([]); } await page.getByRole('button',{name:'More options'}).click(); expect((await audit(page,'Entry details',scale)).undersized).toEqual([]);
});
for (const scale of [1, 2]) test(`sign-in and connection errors remain readable at 320px, ${scale * 100}% font size`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/status', route => route.fulfill({ json: { configured: true, authenticated: false, aiEnabled: false } }));
  await page.goto('/'); await expect(page.getByLabel('Your password')).toBeVisible();
  await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
  expect((await audit(page, 'Sign-in', scale)).undersized).toEqual([]);
  await page.unroute('**/api/status');
  await page.route('**/api/status', route => route.fulfill({ status: 503, json: { error: 'Connection unavailable. Your records have not been changed.' } }));
  await page.reload(); await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
  expect((await audit(page, 'Connection error', scale)).undersized).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('cash-flow-tracker-v1'))).toBeNull();
});
