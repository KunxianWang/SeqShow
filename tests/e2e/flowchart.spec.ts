import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const ready = (page: Page) => expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
const geometry = (page: Page) => page.locator('[data-diagram] svg').evaluate(svg => ({
  viewBox: svg.getAttribute('viewBox'),
  boxes: Array.from(svg.querySelectorAll('path[data-seq-step], [data-seq-participant]'), shape => {
    const { x, y, width, height } = (shape as SVGGraphicsElement).getBBox();
    return [x, y, width, height];
  }),
}));

test('flowchart presents decision exits and the return edge in source order without moving the diagram', async ({ page }) => {
  await page.goto('/flowchart.html'); await ready(page);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 4');
  await expect(page.locator('[data-graph-notice]')).toContainText('source order');
  const baseline = await geometry(page);
  const labels = ['Open pull request → Checks passed?', 'Needs work', 'Push a fix', 'Ready'];
  for (const [i, label] of labels.entries()) {
    await page.locator('[data-action="next"]').click();
    await expect(page.locator('[data-status]')).toHaveText((i + 1) + ' / 4 — ' + label);
    await expect(page.locator('path[data-phase="current"]')).toHaveAttribute('data-seq-step', 'step:' + (i + 1));
    await expect(page.locator('[data-seq-participant][data-active="true"]')).toHaveCount(2);
    expect(await geometry(page)).toEqual(baseline);
  }
  await expect(page.locator('[data-step-kind]')).toHaveText('Edge');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-status]')).toHaveText('3 / 4 — Push a fix');
  await page.locator('[data-action="focus"]').click();
  expect(await geometry(page)).toEqual(baseline);
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 4');
});

test('numbered parallel edges play in number order and retain unnumbered context offline', async ({ page, browser, browserName }, testInfo) => {
  await page.goto('/flowchart.html'); await ready(page);
  await page.locator('#flow-source').fill('flowchart LR\nA[请求] first@-->|First| B{Ready?}\nA second@-.->|Second| B\nB --> A\nfirst@{ step: 7 }\nsecond@{ step: 2 }');
  await expect(page.locator('[data-export]')).toBeDisabled();
  await page.locator('[data-render]').click(); await ready(page);
  await expect(page.locator('path[data-et="edge"]')).toHaveCount(3);
  await expect(page.locator('path[data-seq-step]')).toHaveCount(2);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 2 — Second');
  await expect(page.locator('path.edge-pattern-dotted[data-phase="current"]')).toHaveCount(1);
  const waiting = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const file = testInfo.outputPath('flowchart.html');
  await (await waiting).saveAs(file);
  const context = await browser.newContext({ offline: browserName !== 'webkit' });
  const remote: string[] = [], errors: string[] = [];
  if (browserName === 'webkit') {
    await context.route(/^https?:/u, route => route.abort('internetdisconnected'));
    await context.routeWebSocket(/^wss?:/u, socket => { remote.push(socket.url()); socket.close(); });
  }
  context.on('request', request => { if (/^https?:/u.test(request.url())) remote.push(request.url()); });
  try {
    const offline = await context.newPage();
    offline.on('pageerror', error => errors.push(error.message));
    offline.on('websocket', socket => remote.push(socket.url()));
    await offline.goto(pathToFileURL(file).href);
    await expect(offline.locator('[data-status]')).toHaveText('Overview · 0 / 2');
    await expect(offline.locator('[data-graph-notice]')).toContainText('Unnumbered edges stay visible');
    await expect(offline.locator('path[data-et="edge"]:not([data-seq-step])')).toBeVisible();
    await offline.locator('[data-action="next"]').click();
    await expect(offline.locator('path.edge-pattern-dotted[data-phase="current"]')).toHaveAttribute('data-seq-step', 'step:2');
    await expect(offline.locator('[data-status]')).toHaveText('1 / 2 — Second');
    await offline.locator('[data-action="next"]').click();
    await expect(offline.locator('path[data-phase="current"]')).toHaveAttribute('data-seq-step', 'step:1');
    await expect(offline.locator('[data-status]')).toHaveText('2 / 2 — First');
    await expect(offline.locator('[data-action="next"]')).toBeDisabled();
    expect(remote).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('invalid source stays editable and cannot be exported; mobile recovery keeps the page within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/flowchart.html'); await ready(page);
  const remote: string[] = [];
  page.on('request', request => { if (request.url().includes('bad.invalid')) remote.push(request.url()); });
  const invalid = 'flowchart TD\nA["<img src=https://bad.invalid/x>"] --> B';
  await page.locator('#flow-source').fill(invalid);
  await page.locator('[data-render]').click();
  await expect(page.locator('[data-error]')).toContainText('Line 2');
  await expect(page.locator('#flow-source')).toHaveValue(invalid);
  await expect(page.locator('[data-export]')).toBeDisabled();
  await expect(page.locator('[data-diagram] svg')).toHaveCount(0);
  await page.locator('#flow-source').fill('flowchart TD\nA[Draft] --> B(Review)');
  await page.locator('[data-render]').click(); await ready(page);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 1 — Draft → Review');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(remote).toEqual([]);
});
