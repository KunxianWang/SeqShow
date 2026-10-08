import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

async function renderSource(page: Page, source: string) {
  await page.goto('/');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await page.locator('[data-source]').fill(source);
  await page.locator('[data-render]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
}

for (const width of [390, 1280]) {
  test(`wide diagrams retain readable text in Web and offline at ${width}px`, async ({ page, browser, browserName }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const source = ['sequenceDiagram', ...Array.from({ length: 20 }, (_, i) => `participant P${i} as 服务 ${i}`),
      'P0->>P19: Across all participants', 'P19->>P19: Done'].join('\n');
    await renderSource(page, source);
    const check = async (viewer: Page) => {
      const sizes = await viewer.locator('[data-diagram]').evaluate(container => {
        const svg = container.querySelector('svg')!;
        return { width: svg.getBoundingClientRect().width, naturalWidth: svg.viewBox.baseVal.width,
          textHeight: svg.querySelector('.messageText')!.getBoundingClientRect().height,
          scrollWidth: container.scrollWidth, clientWidth: container.clientWidth };
      });
      expect(sizes.width).toBeGreaterThanOrEqual(sizes.naturalWidth - 1);
      expect(sizes.textHeight).toBeGreaterThanOrEqual(14);
      expect(sizes.scrollWidth).toBeGreaterThan(sizes.clientWidth);
      expect(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await check(page);
    const downloading = page.waitForEvent('download');
    await page.locator('[data-export]').click();
    const file = info.outputPath('wide.html');
    await (await downloading).saveAs(file);
    const offline = await browser.newContext({ viewport: { width, height: 900 } });
    const requests: string[] = [];
    offline.on('request', request => { if (/^https?:/u.test(request.url())) requests.push(request.url()); });
    if (browserName === 'webkit') await offline.route(/^https?:/u, route => route.abort());
    else await offline.setOffline(true);
    try {
      const viewer = await offline.newPage();
      await viewer.goto(pathToFileURL(file).href);
      await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 2');
      await check(viewer);
      await viewer.screenshot({ path: info.outputPath(`wide-offline-${width}.png`), fullPage: true });
      expect(requests).toEqual([]);
    } finally { await offline.close(); }
  });
}

test('wrapped message navigation reveals its arrow without changing layout or scrolling the page', async ({ page, browser, browserName }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await renderSource(page, `sequenceDiagram\nA->>B: ${'中文长消息'.repeat(90)}\nB-->>A: Done`);
  const downloading = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const file = info.outputPath('wrapped.html');
  await (await downloading).saveAs(file);
  const check = async (viewer: Page) => {
    // Focus without scrolling so the keyboard action, not Playwright's click,
    // is responsible for any movement observed below.
    await viewer.locator('[data-player]').evaluate(node => (node as HTMLElement).focus({ preventScroll: true }));
    const before = await viewer.evaluate(() => ({ pageY: scrollY,
      viewBox: document.querySelector('[data-diagram] svg')!.getAttribute('viewBox') }));
    await viewer.keyboard.press('ArrowRight');
    await expect(viewer.locator('[data-status]')).toContainText('1 / 2');
    const bounds = await viewer.locator('[data-diagram]').evaluate(container => {
      const arrow = container.querySelector('line[data-phase="current"]')!.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      return { arrowTop: arrow.top, arrowBottom: arrow.bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom,
        scrollTop: container.scrollTop, pageY: scrollY, viewBox: container.querySelector('svg')!.getAttribute('viewBox') };
    });
    expect(bounds.arrowTop).toBeGreaterThanOrEqual(bounds.viewportTop);
    expect(bounds.arrowBottom).toBeLessThanOrEqual(bounds.viewportBottom);
    expect(bounds.scrollTop).toBeGreaterThan(0);
    expect(bounds.pageY).toBe(before.pageY);
    expect(bounds.viewBox).toBe(before.viewBox);
  };
  await check(page);
  const offline = await browser.newContext({ reducedMotion: 'reduce' });
  if (browserName === 'webkit') await offline.route(/^https?:/u, route => route.abort());
  else await offline.setOffline(true);
  try {
    const viewer = await offline.newPage();
    await viewer.goto(pathToFileURL(file).href);
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 2');
    await check(viewer);
  } finally { await offline.close(); }
});
