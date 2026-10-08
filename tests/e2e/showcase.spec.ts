import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

async function open(page: Page) {
  await page.goto('/showcase.html');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
}
const chapter = (page: Page, index: number) => page.locator(`[data-chapter="${index}"]`).click();

test('showcase chapters operate the real player and preserve geometry through branches and Focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const geometry = () => page.locator('[data-diagram] svg').evaluate(svg => ({ viewBox: svg.getAttribute('viewBox'),
    boxes: Array.from(svg.querySelectorAll('[data-seq-shape]'), node => {
      const box = (node as SVGGraphicsElement).getBBox(); return [box.x, box.y, box.width, box.height];
    }) }));
  const initial = await geometry();
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 20');
  await page.locator('[data-demonstrate]').click();
  await expect(page.locator('[data-status]')).toHaveText('2 / 20 — POST /orders + idempotency key');
  await page.locator('[data-demonstrate]').click();
  await expect(page.locator('[data-step-kind]')).toHaveText('Self call');
  // The service radar mirrors the current step's endpoints and clears at the overview.
  await expect(page.locator('[data-services] li[data-role]')).toHaveCount(1);
  await expect(page.locator('[data-services] li[data-role="SELF"]')).toHaveAttribute('title', 'Order API');
  await chapter(page, 2); await page.locator('[data-demonstrate]').click();
  await expect(page.locator('[data-status]')).toHaveText('8 / 24 — Declined · insufficient funds');
  await expect(page.locator('[data-branch="alt:1"]')).toHaveValue('alt:1:second');
  await expect(page.locator('[data-services] li[data-role="FROM"]')).toHaveAttribute('title', 'Payment');
  await expect(page.locator('[data-services] li[data-role="TO"]')).toHaveAttribute('title', 'Order API');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('9 / 24 — Retry with another payment method');
  await page.locator('[data-demonstrate]').click();
  await expect(page.locator('[data-status]')).toHaveText('8 / 20 — Authorized · payment ref p_82');
  await chapter(page, 3);
  const focused = await page.locator('[data-status]').textContent();
  await expect(page.locator('[data-diagram] svg')).toHaveAttribute('data-focus', 'true');
  await page.locator('[data-demonstrate]').click();
  await expect(page.locator('[data-diagram] svg')).toHaveAttribute('data-focus', 'false');
  await expect(page.locator('[data-status]')).toHaveText(focused!);
  expect(await geometry()).toEqual(initial);
  await chapter(page, 0); await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 20');
  await expect(page.locator('[data-services] li[data-role]')).toHaveCount(0);
  await page.locator('[data-chapter-next]').click(); await expect(page.locator('[data-chapter-count]')).toHaveText('02 / 05');
  await page.locator('[data-chapter-prev]').click(); await expect(page.locator('[data-chapter-prev]')).toBeDisabled();
  await page.screenshot({ path: 'artifacts/showcase/desktop.png', fullPage: true });
});

test('showcase downloads a real offline presentation with both selected paths and editor handoff', async ({ page, browser, browserName }, info) => {
  await open(page); await chapter(page, 4);
  await page.locator('[data-branch="alt:1"]').selectOption('alt:1:second');
  await page.locator('[data-branch="alt:2"]').selectOption('alt:2:second');
  const waiting = page.waitForEvent('download'); await page.locator('[data-demonstrate]').click();
  const download = await waiting; expect(download.suggestedFilename()).toBe('seqshow-checkout.html');
  const file = info.outputPath('checkout.html'); await download.saveAs(file);
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const requests: string[] = [], errors: string[] = [];
  context.on('request', request => { if (/^(https?|wss?):/u.test(request.url())) requests.push(request.url()); });
  if (browserName === 'webkit') await context.route(/^https?:/u, route => route.abort('internetdisconnected'));
  else await context.setOffline(true);
  try {
    const viewer = await context.newPage(); viewer.on('pageerror', error => errors.push(error.message));
    await viewer.goto(pathToFileURL(file).href);
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 24');
    await expect(viewer.locator('[data-branch="alt:1"]')).toHaveValue('alt:1:second');
    await expect(viewer.locator('[data-branch="alt:2"]')).toHaveValue('alt:2:second');
    for (let index = 0; index < 23; index++) await viewer.locator('[data-action="next"]').click();
    await expect(viewer.locator('[data-status]')).toHaveText('23 / 24 — Order update · delayed');
    await viewer.locator('[data-branch="alt:2"]').selectOption('alt:2:first');
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 24');
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
  const popupEvent = page.waitForEvent('popup'); await page.locator('.editor-link').click();
  const editor = await popupEvent;
  await expect(editor.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await expect(editor.locator('[data-example]')).toHaveValue('checkout');
  await expect(editor.locator('[data-source]')).toHaveValue(/idempotency key/u);
  await editor.close();
});

for (const width of [360, 768, 1280]) test(`showcase ${width}px retains usable controls without page overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: width >= 1000 ? 720 : 844 }); await open(page);
  await chapter(page, 1); await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('3 / 20 — Validate cart and calculate total');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width >= 1000) {
    const box = await page.locator('[data-action="next"]').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  }
  await page.screenshot({ path: `artifacts/showcase/${width}.png`, fullPage: true });
});
