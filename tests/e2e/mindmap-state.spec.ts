import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const ready = (page: Page) => expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
const geometry = (page: Page) => page.locator('[data-diagram] svg').evaluate(svg => ({
  viewBox: svg.getAttribute('viewBox'),
  shapes: Array.from(svg.querySelectorAll('[data-graph-shape], path[data-et="edge"]'), node => {
    const { x, y, width, height } = (node as SVGGraphicsElement).getBBox();
    return [x, y, width, height];
  }),
}));
const diagrams = [
  {
    kind: 'mindmap', stepKind: 'Topic', notice: 'outline order',
    source: 'mindmap\n  root((Release))\n    Repeat\n      Check\n    Repeat',
    unsafe: 'mindmap\n  root[<img src=https://bad.invalid/image>]',
    steps: [
      { label: 'Release', active: ['topic:0'] }, { label: 'Repeat', active: ['topic:1'] },
      { label: 'Check', active: ['topic:2'] }, { label: 'Repeat', active: ['topic:3'] },
    ],
  },
  {
    kind: 'state', stepKind: 'Transition', notice: 'events and guards are not evaluated',
    source: 'stateDiagram-v2\ndirection LR\n[*] --> direction\ndirection --> hide: accepted\ndirection --> hide: cached\nhide --> hide: retry [online]\nhide --> [*]\ndirection: Waiting for review\nhide: Ready',
    unsafe: 'stateDiagram-v2\n  A --> B: <img src=https://bad.invalid/image>',
    steps: [
      { label: 'Start → Waiting for review', active: ['@start', 'direction'] }, { label: 'accepted', active: ['direction', 'hide'] },
      { label: 'cached', active: ['direction', 'hide'] }, { label: 'retry [online]', active: ['hide'] },
      { label: 'Ready → End', active: ['@end', 'hide'] },
    ],
  },
];

for (const diagram of diagrams) {
  test(diagram.kind + ' preserves step identity and layout in Web and offline playback', async ({ page, browser, browserName }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const unexpected: string[] = [];
    page.on('request', request => { if (request.url().includes('bad.invalid')) unexpected.push(request.url()); });
    await page.goto('/' + diagram.kind + '.html'); await ready(page);
    const editor = page.locator('[data-graph-source]');
    await editor.fill(diagram.unsafe);
    await page.locator('[data-render]').click();
    await expect(page.locator('[data-error]')).toContainText('Line 2');
    await expect(editor).toHaveValue(diagram.unsafe);
    await expect(page.locator('[data-export]')).toBeDisabled();
    await expect(page.locator('[data-diagram] svg')).toHaveCount(0);
    expect(unexpected).toEqual([]);
    await editor.fill(diagram.source);
    await page.locator('[data-render]').click(); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    async function play(target: Page) {
      const overview = 'Overview · 0 / ' + diagram.steps.length;
      await expect(target.locator('[data-graph-notice]')).toContainText(diagram.notice);
      await expect(target.locator('[data-status]')).toHaveText(overview);
      if (diagram.kind === 'state') {
        expect(await target.locator('[data-diagram]').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
        expect(await target.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      }
      const baseline = await geometry(target);
      for (const [index, step] of diagram.steps.entries()) {
        await target.locator('[data-action="next"]').click();
        await expect(target.locator('[data-status]')).toHaveText((index + 1) + ' / ' + diagram.steps.length + ' — ' + step.label);
        await expect(target.locator('[data-step-kind]')).toHaveText(diagram.stepKind);
        await expect(target.locator('[data-phase="current"]')).not.toHaveCount(0);
        if (diagram.kind === 'state') await expect(target.locator('path[data-phase="current"]')).toHaveAttribute('data-id', 'edge' + index);
        else await expect(target.locator('path[data-phase="current"]')).toHaveCount(index === 0 ? 0 : 1);
        const active = await target.locator('[data-active="true"][data-seq-participant]').evaluateAll(nodes =>
          nodes.map(node => node.getAttribute('data-seq-participant')).sort());
        expect(active).toEqual(step.active);
        expect(await geometry(target)).toEqual(baseline);
      }
      await target.locator('[data-action="previous"]').click();
      await expect(target.locator('[data-status]')).toContainText(diagram.steps.at(-2)!.label);
      await target.locator('[data-action="reset"]').click();
      await expect(target.locator('[data-status]')).toHaveText(overview);
    }
    await play(page);
    const waiting = page.waitForEvent('download');
    await page.locator('[data-export]').click();
    const file = testInfo.outputPath(diagram.kind + '.html');
    const download = await waiting;
    expect(download.suggestedFilename()).toBe('seqshow-' + diagram.kind + '.html');
    await download.saveAs(file);
    const context = await browser.newContext({ offline: browserName !== 'webkit', viewport: { width: 390, height: 844 } });
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
      await play(offline);
      expect(remote).toEqual([]); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
