import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseSequence } from '../../src/core/parser';
import { loginSource } from '../../src/examples';
import type { exportHtml } from '../../src/export';

declare global { interface Window { SeqShowExportTest: { exportHtml: typeof exportHtml } } }

let boundaryCode: string, runtime: string, css: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ['src/export.ts'], bundle: true, write: false,
    format: 'iife', globalName: 'SeqShowExportTest', platform: 'browser', metafile: true });
  expect(Object.keys(result.metafile!.inputs).every(path => path.startsWith('src/'))).toBe(true);
  boundaryCode = result.outputFiles[0].text;
  [runtime, css] = await Promise.all([readFile('dist/export-player.js', 'utf8'), readFile('src/player.css', 'utf8')]);
});

async function open(page: Page, source?: string) {
  await page.goto('/');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  if (source) {
    await page.locator('[data-source]').fill(source); await page.locator('[data-render]').click();
    await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  }
}
async function freeze(page: Page) {
  await page.clock.install({ time: '2026-10-07T00:00:00Z' });
  await page.clock.pauseAt('2026-10-07T00:01:00Z');
}
async function download(page: Page, info: TestInfo, name: string) {
  const waiting = page.waitForEvent('download'); await page.locator('[data-export]').click();
  const artifact = await waiting;
  expect(artifact.suggestedFilename()).toBe('seqshow-presentation.html');
  const file = info.outputPath(name); await artifact.saveAs(file);
  return file;
}
async function offline(browser: Browser, browserName: string, file: string, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const requests: string[] = [], errors: string[] = [];
  context.on('request', request => { if (/^(https?|wss?):/iu.test(request.url())) requests.push(request.url()); });
  if (browserName === 'webkit') {
    await context.route(/^https?:/iu, route => route.abort('internetdisconnected'));
    await context.routeWebSocket(/^wss?:/iu, socket => { requests.push(socket.url()); socket.close(); });
  } else await context.setOffline(true);
  const viewer = await context.newPage();
  viewer.on('pageerror', error => errors.push(String(error)));
  viewer.on('websocket', socket => requests.push(socket.url()));
  await viewer.goto(pathToFileURL(resolve(file)).href);
  await expect(viewer.locator('[data-action="play"]')).toBeVisible();
  await expect(viewer.locator('textarea, iframe, img, link[href], [src]')).toHaveCount(0);
  expect(await viewer.locator('svg [href], svg [xlink\\:href]').evaluateAll(nodes =>
    nodes.every(node => (node.getAttribute('href') ?? node.getAttribute('xlink:href') ?? '').startsWith('#')))).toBe(true);
  return { viewer, context, requests, errors };
}
const geometry = (page: Page) => page.locator('[data-diagram] svg').evaluate(svg => ({
  viewBox: svg.getAttribute('viewBox'), boxes: Array.from(svg.querySelectorAll('g,line,path,rect,text,circle'), node => {
    const b = (node as SVGGraphicsElement).getBBox(); return [node.localName, b.x, b.y, b.width, b.height];
  }),
}));
const snapshot = (page: Page) => page.locator('[data-player]').evaluate(root => ({
  status: root.querySelector('[data-status]')!.textContent,
  details: root.querySelector('[data-step-details]')!.textContent,
  choices: Array.from(root.querySelectorAll<HTMLSelectElement>('[data-branch]'), node => [node.dataset.branch, node.value]),
  buttons: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action]'), node => [node.dataset.action, node.textContent, node.disabled, node.getAttribute('aria-pressed')]),
  phases: Array.from(root.querySelectorAll('svg [data-seq-step],svg [data-seq-participant],svg [data-seq-case]'), node =>
    [node.getAttribute('data-seq-step'), node.getAttribute('data-phase'), node.getAttribute('data-active'), node.getAttribute('data-selected')]),
  focus: root.querySelector('[data-diagram] svg')!.getAttribute('data-focus'),
}));

async function loginActions(page: Page, frozen = false) {
  if (!frozen) await freeze(page);
  if (await page.locator('[data-action="focus"]').getAttribute('aria-pressed') === 'false') await page.locator('[data-action="focus"]').click();
  const states = [];
  const click = async (action: string) => { await page.locator(`[data-action="${action}"]`).click(); states.push(await snapshot(page)); };
  await click('reset'); await click('next'); await click('next'); await click('previous');
  await click('play'); await page.clock.runFor(1500); states.push(await snapshot(page)); await click('play');
  await expect(page.locator('[data-status]')).toHaveText('2 / 6 — Find user');
  await click('focus'); await click('reset'); await click('focus');
  await page.locator('[data-branch]').selectOption('alt:1:first'); states.push(await snapshot(page));
  for (let i = 0; i < 6; i++) await click('next');
  await expect(page.locator('[data-status]')).toHaveText('6 / 6 — Login succeeded');
  await click('previous'); await click('reset'); await click('play');
  await page.clock.runFor(7500); states.push(await snapshot(page));
  await expect(page.locator('[data-action="play"]')).toHaveText('Play');
  await click('play'); await click('play');
  await page.locator('[data-player]').focus();
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home']) { await page.keyboard.press(key); states.push(await snapshot(page)); }
  return states;
}

test('E11/E12 login export preserves failure choice, starts paused and matches Web actions offline', async ({ page, browser, browserName }, info) => {
  if (browserName === 'webkit') test.setTimeout(180_000);
  await open(page); await freeze(page);
  await page.locator('[data-branch]').selectOption('alt:1:second');
  for (let i = 0; i < 5; i++) await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="focus"]').click(); await page.locator('[data-action="play"]').click();
  const before = await snapshot(page), box = await geometry(page);
  const file = await download(page, info, 'login-failure.html');
  expect(await snapshot(page)).toEqual(before);
  const saved = await offline(browser, browserName, file);
  try {
    await expect(saved.viewer.locator('[data-status]')).toHaveText('Overview · 0 / 6');
    await expect(saved.viewer.locator('[data-branch]')).toHaveValue('alt:1:second');
    await expect(saved.viewer.locator('[data-action="play"]')).toHaveText('Play');
    await expect(saved.viewer.locator('[data-action="focus"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await geometry(saved.viewer)).toEqual(box);
    // Run each sequence independently so switching tabs cannot affect visibility pause.
    const web = await loginActions(page, true), exported = await loginActions(saved.viewer);
    expect(exported).toEqual(web);
    expect(await geometry(saved.viewer)).toEqual(box);
    await saved.viewer.screenshot({ path: info.outputPath('login-offline.png'), fullPage: true });
    expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
  } finally { await saved.context.close(); }
});

test('E11 two independent exported choices remain changeable with unequal paths', async ({ page, browser, browserName }, info) => {
  await open(page); await page.locator('[data-example]').selectOption('job');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await page.locator('[data-branch="alt:1"]').selectOption('alt:1:second');
  await page.locator('[data-branch="alt:2"]').selectOption('alt:2:second');
  const saved = await offline(browser, browserName, await download(page, info, 'two-choices.html'));
  try {
    await expect(saved.viewer.locator('[data-status]')).toHaveText('Overview · 0 / 6');
    for (const id of ['alt:1', 'alt:2']) await expect(saved.viewer.locator(`[data-branch="${id}"]`)).toHaveValue(`${id}:second`);
    const box = await geometry(saved.viewer);
    for (const [first, second, count] of [['first', 'first', 4], ['first', 'second', 5], ['second', 'first', 5], ['second', 'second', 6]] as const) {
      await saved.viewer.locator('[data-branch="alt:1"]').selectOption(`alt:1:${first}`);
      await saved.viewer.locator('[data-branch="alt:2"]').selectOption(`alt:2:${second}`);
      await expect(saved.viewer.locator('[data-status]')).toHaveText(`Overview · 0 / ${count}`);
      await saved.viewer.locator('[data-action="next"]').click();
      await expect(saved.viewer.locator('[data-status]')).toHaveText(`1 / ${count} — Submit job`);
      expect(await geometry(saved.viewer)).toEqual(box);
    }
    expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
  } finally { await saved.context.close(); }
});

test('E11 exporting an empty selected path opens at 0/0 and permits switching back', async ({ page, browser, browserName }, info) => {
  await open(page, 'sequenceDiagram\n%% PRIVATE_SOURCE_COMMENT_DO_NOT_EXPORT\nalt work\nA->>B: hello\nelse idle\nend');
  await page.locator('[data-branch]').selectOption('alt:1:second');
  const file = await download(page, info, 'empty-path.html');
  expect(await readFile(file, 'utf8')).not.toContain('PRIVATE_SOURCE_COMMENT_DO_NOT_EXPORT');
  const saved = await offline(browser, browserName, file);
  try {
    await expect(saved.viewer.locator('[data-status]')).toHaveText('Overview · 0 / 0');
    for (const action of ['play', 'next', 'previous']) await expect(saved.viewer.locator(`[data-action="${action}"]`)).toBeDisabled();
    await saved.viewer.locator('[data-branch]').selectOption('alt:1:first');
    await saved.viewer.locator('[data-action="next"]').click();
    await expect(saved.viewer.locator('[data-status]')).toHaveText('1 / 1 — hello');
    expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
  } finally { await saved.context.close(); }
});

for (const width of [360, 390, 768, 1280]) {
  test(`E12 Chinese offline layout at ${width}px keeps labels and scrolling inside the diagram`, async ({ page, browser, browserName }, info) => {
    const long = '中文分支标签'.repeat(20);
    await open(page, `sequenceDiagram\nactor U as 手机用户与订单页面\nparticipant API as 订单接口服务\nalt ${long}\nU->>API: 提交订单 https://example.com:8080/orders?source=web&version=1\nAPI->>API: 重复检查\nAPI->>API: 重复检查\nNote over U,API: 标签是纯文本，不会请求 URL\nelse 稍后处理\nNote right of API: 等待\nend`);
    const saved = await offline(browser, browserName, await download(page, info, 'chinese.html'), width);
    try {
      expect(await saved.viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const box = await geometry(saved.viewer), scroll = await saved.viewer.evaluate(() => scrollY);
      await saved.viewer.locator('[data-action="next"]').click();
      await expect(saved.viewer.locator('[data-step-details]')).toHaveText('手机用户与订单页面 → 订单接口服务');
      expect(await saved.viewer.locator('[data-status]').textContent()).toContain('https://example.com:8080/orders?source=web&version=1');
      await saved.viewer.locator('[data-action="focus"]').click();
      expect(await geometry(saved.viewer)).toEqual(box);
      expect(await saved.viewer.evaluate(() => scrollY)).toBe(scroll);
      if (width < 600) expect(await saved.viewer.locator('[data-diagram]').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
      await saved.viewer.screenshot({ path: info.outputPath(`chinese-offline-${width}.png`), fullPage: true });
      expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
    } finally { await saved.context.close(); }
  });
}

test('exported long step text and ten alt blocks keep controls on the first screen', async ({ page, browser, browserName }, info) => {
  const longText = '长消息'.repeat(150);
  await open(page, `sequenceDiagram\nA->>B: ${longText}\n` + Array.from({ length: 10 }, (_, i) =>
    `alt yes ${i + 1}\nA->>B: ok ${i + 1}\nelse no ${i + 1}\nB->>A: fail ${i + 1}\nend`).join('\n'));
  const saved = await offline(browser, browserName, await download(page, info, 'crowded.html'));
  const onScreen = () => saved.viewer.evaluate(() => scrollY === 0 && ['previous', 'play', 'next', 'reset']
    .every(action => document.querySelector(`[data-action="${action}"]`)!.getBoundingClientRect().bottom <= innerHeight));
  try {
    await saved.viewer.setViewportSize({ width: 1280, height: 720 });
    await saved.viewer.locator('[data-player]').evaluate(node => (node as HTMLElement).focus({ preventScroll: true }));
    await saved.viewer.keyboard.press('ArrowRight');
    await expect(saved.viewer.locator('[data-status]')).toHaveText(`1 / 11 — ${longText}`);
    expect(await onScreen()).toBe(true);
    await saved.viewer.setViewportSize({ width: 390, height: 844 });
    expect(await saved.viewer.locator('.player-dock').evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(320);
    expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
  } finally { await saved.context.close(); }
});

test('E12 constructed export data cannot escape JSON or SVG text to execute script or fetch', async ({ page, browser, browserName }, info) => {
  await open(page, 'sequenceDiagram\nA->>B: placeholder');
  await page.addScriptTag({ content: boundaryCode });
  const result = parseSequence('sequenceDiagram\nA->>B: placeholder');
  if (!result.ok) throw new Error('Invalid test model');
  const text = '</script><script>window.exportInjected=1</script><img src="https://example.com/x"> & "quoted" \\ 中文\u2028\u2029';
  const step = result.document.nodes[0];
  if (step.kind !== 'message') throw new Error('Invalid test step');
  step.text = text;
  const html = await page.evaluate(({ model, runtime, css, text }) => {
    const svg = document.querySelector<SVGSVGElement>('[data-diagram] svg')!.cloneNode(true) as SVGSVGElement;
    svg.querySelector('.messageText')!.textContent = text;
    return window.SeqShowExportTest.exportHtml(svg, model, {}, runtime, css);
  }, { model: result.document, runtime, css, text });
  const file = info.outputPath('constructed-text.html'); await writeFile(file, html);
  const saved = await offline(browser, browserName, file);
  try {
    await expect(saved.viewer.locator('script')).toHaveCount(2);
    expect(await saved.viewer.evaluate(() => Reflect.get(window, 'exportInjected'))).toBeUndefined();
    await saved.viewer.locator('[data-action="next"]').click();
    await expect(saved.viewer.locator('[data-status]')).toHaveText(`1 / 1 — ${text}`);
    expect(await saved.viewer.locator('.messageText').textContent()).toBe(text);
    expect(saved.requests).toEqual([]); expect(saved.errors).toEqual([]);
  } finally { await saved.context.close(); }
});

test('export boundary rejects unsafe SVG, bundle delimiters and invalid saved choices', async ({ page }) => {
  await open(page); await page.addScriptTag({ content: boundaryCode });
  const model = parseSequence(loginSource); if (!model.ok) throw new Error('Invalid test model');
  const rejected = await page.evaluate(({ model, runtime, css }) => {
    const svg = document.querySelector<SVGSVGElement>('[data-diagram] svg')!;
    const names: string[] = [];
    const reject = (name: string, mutation: (copy: SVGSVGElement) => void, choices = {}, script = runtime, styles = css) => {
      const copy = svg.cloneNode(true) as SVGSVGElement; mutation(copy);
      try { window.SeqShowExportTest.exportHtml(copy, model, choices, script, styles); }
      catch { names.push(name); return; }
      throw new Error(`Unsafe export accepted: ${name}`);
    };
    for (const tag of ['script', 'foreignObject', 'image']) reject(tag, copy => copy.append(document.createElementNS('http://www.w3.org/2000/svg', tag)));
    reject('event', copy => copy.setAttribute('onload', 'window.exportInjected=1'));
    reject('resource', copy => copy.querySelector('path')!.setAttribute('href', 'https://example.com/x'));
    reject('css-url', copy => copy.querySelector('style')!.textContent += '.x{fill:url(https://example.com/x)}');
    reject('css-import', copy => copy.querySelector('style')!.textContent += '@import "https://example.com/x";');
    reject('unknown-case', () => {}, { 'alt:1': 'unknown' });
    reject('unknown-alt', () => {}, { unknown: 'unknown' });
    reject('script-delimiter', () => {}, {}, '</script>');
    reject('style-delimiter', () => {}, {}, runtime, '</style>');
    return names;
  }, { model: model.document, runtime, css });
  expect(rejected).toEqual(['script', 'foreignObject', 'image', 'event', 'resource', 'css-url', 'css-import', 'unknown-case', 'unknown-alt', 'script-delimiter', 'style-delimiter']);
});

test('download failures retain source and playback, expose retry and revoke created Blob URLs', async ({ page }, info) => {
  await open(page); await freeze(page);
  await page.locator('[data-action="next"]').click();
  const before = await snapshot(page), source = await page.locator('[data-source]').inputValue();
  await page.evaluate(() => {
    const create = URL.createObjectURL;
    URL.createObjectURL = function () { URL.createObjectURL = create; throw new Error('test Blob failure'); };
  });
  await page.locator('[data-export]').click();
  await expect(page.locator('[data-export-error]')).toContainText('test Blob failure');
  await expect(page.locator('[data-export]')).toBeEnabled();
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(() => {
    const click = HTMLAnchorElement.prototype.click, revoke = URL.revokeObjectURL;
    Reflect.set(window, 'revokedBlobUrls', []);
    URL.revokeObjectURL = url => { Reflect.get(window, 'revokedBlobUrls').push(url); revoke(url); };
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = click;
      const button = document.querySelector<HTMLButtonElement>('[data-export]')!;
      if (!button.disabled || button.getAttribute('aria-busy') !== 'true' || button.textContent !== 'Exporting…') throw new Error('Missing export busy state');
      throw new Error('test download failure');
    };
  });
  await page.locator('[data-export]').click();
  await expect(page.locator('[data-export-error]')).toContainText('test download failure');
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => Reflect.get(window, 'revokedBlobUrls'))).toHaveLength(1);
  await expect(page.locator('[data-source]')).toHaveValue(source);
  expect(await snapshot(page)).toEqual(before);
  await download(page, info, 'retry.html');
  await expect(page.locator('[data-export-error]')).toBeEmpty();
  await expect(page.locator('[data-export]')).toHaveAttribute('aria-busy', 'false');
});
