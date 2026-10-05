import type { Page } from '@playwright/test';

export async function contrastAudit(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    type RGBA = number[];
    const rgba = (color: string): RGBA => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const values = [...ctx.getImageData(0, 0, 1, 1).data]; return [...values.slice(0, 3), values[3] / 255]; };
    const over = (fg: RGBA, bg: RGBA): RGBA => [...fg.slice(0, 3).map((value, i) => value * fg[3] + bg[i] * (1 - fg[3])), 1];
    const luminance = (values: RGBA) => values.slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const ratio = (fg: RGBA, bg: RGBA) => { const a = luminance(over(fg, bg)), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const backgrounds = (element: Element) => {
      const ancestors: Element[] = []; for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      let backgrounds: RGBA[] = [rgba(getComputedStyle(document.documentElement).getPropertyValue('--canvas'))];
      for (const ancestor of ancestors) {
        const style = getComputedStyle(ancestor), solid = rgba(style.backgroundColor);
        backgrounds = backgrounds.map(background => over(solid, background));
        const stops = style.backgroundImage.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g);
        if (stops) backgrounds = backgrounds.flatMap(background => stops.map(stop => over(rgba(stop), background))).slice(-16);
      }
      return backgrounds;
    };
    const failures: { text: string; selector: string; ratio: number; required: number }[] = [];
    let count = 0;
    const check = (element: Element, text: string, color?: string) => {
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) { const s = getComputedStyle(ancestor); if (s.visibility !== 'visible' || Number(s.opacity) < .99 || ancestor.hasAttribute('disabled') || ancestor.hasAttribute('inert')) return; }
      const style = getComputedStyle(element), required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      const contrast = Math.min(...backgrounds(element).map(background => ratio(rgba(color ?? style.color), background)));
      count++; if (contrast < required) failures.push({ text: text.slice(0, 70), selector: element.className.toString() || element.tagName, ratio: Number(contrast.toFixed(2)), required });
    };
    const root = document.querySelector('[role="dialog"]') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement; if (!element || !node.textContent?.trim() || element.closest('svg,script,style,option,[aria-hidden="true"]')) continue;
      const range = document.createRange(); range.selectNodeContents(node); if (![...range.getClientRects()].some(rect => rect.width && rect.height)) continue;
      check(element, node.textContent.trim());
    }
    for (const element of root.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]),select,textarea')) {
      if (!element.offsetWidth || getComputedStyle(element).opacity === '0') continue;
      check(element, element.value || element.id);
      if (element.getAttribute('placeholder')) check(element, 'Placeholder: ' + element.getAttribute('placeholder'), getComputedStyle(element, '::placeholder').color);
    }
    return { count, failures };
  });
}
