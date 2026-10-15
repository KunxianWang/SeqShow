import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compatibilitySources } from '../fixtures/compatibility';

const linear = 'sequenceDiagram\nA->>B: my request\nB-->>A: my response';
const open = async (page: import('@playwright/test').Page) => { await page.goto('/'); await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready'); };

test('Markdown offers an explicit block choice and Cancel preserves the draft', async ({ page }) => {
  await open(page);
  await page.locator('[data-source]').fill(linear);
  const markdown = '# Document\n```mermaid\nsequenceDiagram\nA->>B: first\n```\n```mermaid\nsequenceDiagram\nA->>B: second\n```';
  await page.locator('[data-source]').evaluate((editor, text) => {
    const data = new DataTransfer(); data.setData('text/plain', text);
    editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, markdown);
  await expect(page.locator('[data-markdown]')).toBeVisible();
  await expect(page.locator('[data-markdown-confirm]')).toBeDisabled();
  await page.locator('[data-markdown-block]').selectOption('1');
  await expect(page.locator('[data-markdown-preview]')).toHaveText('sequenceDiagram\nA->>B: second');
  await page.locator('[data-markdown-cancel]').click();
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await page.locator('[data-source]').evaluate((editor, text) => {
    const data = new DataTransfer(); data.setData('text/plain', text);
    editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, markdown);
  await page.locator('[data-markdown-block]').selectOption('1');
  await page.locator('[data-markdown-confirm]').click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-source]')).toHaveValue('sequenceDiagram\nA->>B: second');
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 1');
});

test('file replacement, editable download and draft restoration preserve source including comments', async ({ page }) => {
  await open(page);
  const source = '%% Original comment\nsequenceDiagram\nA->>B: 中文';
  await page.locator('[data-source]').fill(linear);
  const file = { name: 'my-diagram.mmd', mimeType: 'text/plain', buffer: Buffer.from(source) };
  await page.locator('[data-source-file]').setInputFiles(file);
  await page.locator('[data-cancel]').click();
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await page.locator('[data-source-file]').setInputFiles(file);
  await page.locator('[data-confirm]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  const waiting = page.waitForEvent('download');
  await page.locator('[data-save-source]').click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe('seqshow-source.mmd');
  expect(await readFile((await download.path())!, 'utf8')).toBe(source);
  await page.reload();
  await expect(page.locator('[data-source]')).toHaveValue(source);
  await expect(page.locator('[data-draft-state]')).toContainText('Restored');
});

test('invalid drafts can be recovered and cleared without being saved again on close', async ({ page }) => {
  await open(page);
  await page.clock.install();
  const source = 'sequenceDiagram\nopt not supported';
  await page.locator('[data-source]').fill(source);
  await page.clock.runFor(1000);
  await expect(page.locator('[data-draft-state]')).toContainText('Draft saved');
  await page.reload();
  await expect(page.locator('[data-source]')).toHaveValue(source);
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'error');
  await page.locator('[data-clear-draft]').click();
  await page.reload();
  expect(await page.locator('[data-source]').inputValue()).not.toBe(source);
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
});

test('blocked storage still permits editing and source download', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('storage unavailable'); }; });
  await open(page);
  await page.locator('[data-source]').fill(linear);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('[data-draft-state]')).toContainText('Could not save');
  const waiting = page.waitForEvent('download'); await page.locator('[data-save-source]').click();
  const download = await waiting;
  expect(await readFile((await download.path())!, 'utf8')).toBe(linear);
});

test('an explicit example link does not overwrite an earlier draft', async ({ page }) => {
  await open(page);
  await page.clock.install();
  await page.locator('[data-source]').fill(linear);
  await page.clock.runFor(1000);
  await expect(page.locator('[data-draft-state]')).toContainText('Draft saved');
  await page.goto('/?example=checkout');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-source]')).not.toHaveValue(linear);
  await page.getByRole('button', { name: 'Restore earlier draft' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('[data-source]')).toHaveValue(linear);
});

test('oversized or stale file reads preserve newer editor input', async ({ page }) => {
  await open(page);
  await page.locator('[data-source]').fill(linear);
  await page.locator('[data-source-file]').setInputFiles({ name: 'large.mmd', mimeType: 'text/plain', buffer: Buffer.alloc(200001, 'x') });
  await expect(page.locator('[data-input-state]')).toContainText('200,000');
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () { return new Promise(resolve => setTimeout(async () => resolve(await original.call(this)), 300)); };
  });
  await page.locator('[data-source-file]').setInputFiles({ name: 'slow.mmd', mimeType: 'text/plain', buffer: Buffer.from('sequenceDiagram\nA->>B: old file') });
  await page.locator('[data-source]').fill('sequenceDiagram\nA->>B: newer draft');
  await expect(page.locator('[data-input-state]')).toContainText('editor changed while reading');
  await expect(page.locator('[data-source]')).toHaveValue('sequenceDiagram\nA->>B: newer draft');
});

test('dropping a link is cancelled without navigating or replacing the source', async ({ page }) => {
  await open(page);
  const before = await page.locator('[data-source]').inputValue();
  const cancelled = await page.locator('.editor-panel').evaluate(panel => {
    const data = new DataTransfer(); data.setData('text/uri-list', 'https://bad.example.invalid/');
    return !panel.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  expect(cancelled).toBe(true);
  await expect(page.locator('[data-input-state]')).toContainText('Links and HTML are not opened');
  await expect(page.locator('[data-source]')).toHaveValue(before);
});

test('local file drops require replacement and read failures preserve the editor', async ({ page }) => {
  await open(page);
  await page.locator('[data-source]').fill(linear);
  const dropped = '%% local file\nsequenceDiagram\nA->>B: dropped';
  await page.locator('.editor-panel').evaluate((panel, source) => {
    const data = new DataTransfer(); data.items.add(new File([source], 'local.mmd', { type: 'text/plain' }));
    panel.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, dropped);
  await page.locator('[data-confirm]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-source]')).toHaveValue(dropped);
  await page.evaluate(() => { File.prototype.text = () => Promise.reject(new Error('unreadable file')); });
  await page.locator('[data-source-file]').setInputFiles({ name: 'failed.mmd', mimeType: 'text/plain', buffer: Buffer.from(linear) });
  await expect(page.locator('[data-input-state]')).toContainText('Could not read this file');
  await expect(page.locator('[data-source]')).toHaveValue(dropped);
});

test('all independent unsupported diagnostics remain visible as English source locations', async ({ page }) => {
  await open(page);
  await page.locator('[data-source]').fill('sequenceDiagram\nA->>B: valid\nopt later\npar elsewhere\nA->>B: <b>rich</b>');
  await page.locator('[data-render]').click();
  await expect(page.locator('[data-error] button')).toHaveCount(3);
  await expect(page.locator('[data-error] button').nth(2)).toContainText('Line 5');
  await page.locator('[data-error] button').nth(2).click();
  await expect(page.locator('[data-source]')).toBeFocused();
  await expect(page.locator('[data-export]')).toBeDisabled();
});

test('loop and wrapped alternative play once and export the same semantics offline', async ({ page, browser, browserName }, testInfo) => {
  await open(page);
  await page.locator('[data-source]').fill(compatibilitySources.find(fixture => fixture.id === 'compat-loop-path')!.source);
  await page.locator('[data-render]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-loop-notice]')).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 2');
  await page.locator('[data-branch]').selectOption('alt:1:second');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 2 — outcome unknown');
  const waiting = page.waitForEvent('download'); await page.locator('[data-export]').click();
  const download = await waiting;
  const savedFile = testInfo.outputPath('loop.html'); await download.saveAs(savedFile);
  const context = await browser.newContext({ offline: browserName !== 'webkit' });
  const remote: string[] = [];
  if (browserName === 'webkit') {
    await context.route(/^https?:/u, route => route.abort('internetdisconnected'));
    await context.routeWebSocket(/^wss?:/u, socket => { remote.push(socket.url()); socket.close(); });
  }
  context.on('request', request => { if (/^(https?|wss?):/u.test(request.url())) remote.push(request.url()); });
  try {
    const viewer = await context.newPage();
    viewer.on('websocket', socket => remote.push(socket.url()));
    await viewer.goto(pathToFileURL(savedFile).href);
    await expect(viewer.locator('[data-loop-notice]')).toHaveText('Loops are shown once; iterations and conditions are not evaluated.');
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 2');
    await viewer.locator('[data-action="next"]').click(); await viewer.locator('[data-action="next"]').click();
    await expect(viewer.locator('[data-status]')).toHaveText('2 / 2 — finish');
    expect(remote).toEqual([]);
  } finally { await context.close(); }
});
