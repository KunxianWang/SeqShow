import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('artifacts/showcase');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4177', '--strictPort'],
  { windowsHide: true, stdio: 'pipe' });
let browser;
try {
  await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error('Showcase preview did not start')), 15_000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
    server.stdout.on('data', data => { if (data.toString().includes('127.0.0.1:4177')) { clearTimeout(timeout); accept(); } });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const errors = [], requests = [], frames = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4177/showcase.html');
  await page.waitForFunction(() => document.querySelector('[data-player]')?.dataset.state === 'ready');
  await page.locator('[data-fullscreen]').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert(await page.evaluate(() => !!document.fullscreenElement));
  await page.locator('[data-fullscreen]').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert(!await page.evaluate(() => !!document.fullscreenElement));
  const capture = async (caption, expected, duration = 2500) => {
    assert.equal(await page.locator('[data-status]').textContent(), expected);
    const file = `frame-${String(frames.length).padStart(2, '0')}.png`;
    await page.screenshot({ path: resolve(output, file) });
    frames.push({ file, caption, status: expected, duration });
  };
  const chapter = index => page.locator(`[data-chapter="${index}"]`).click();
  const action = () => page.locator('[data-demonstrate]').click();
  await capture('SeqShow / Turn a complex flow into a story', 'Overview · 0 / 20');
  await chapter(1); await capture('01 / Explain one interaction at a time', '2 / 20 — POST /orders + idempotency key');
  await action(); await capture('Including self calls, not just requests', '3 / 20 — Validate cart and calculate total');
  await chapter(2); await action(); await capture('02 / Choose the payment recovery path', '8 / 24 — Declined · insufficient funds');
  await page.locator('[data-action="next"]').click();
  await capture('Only the selected path enters playback', '9 / 24 — Retry with another payment method');
  await chapter(3); await capture('03 / Focus on the current interaction', '13 / 20 — Deliver OrderConfirmed · at least once');
  await action(); await capture('Keep the surrounding context visible', '13 / 20 — Deliver OrderConfirmed · at least once');
  await chapter(4); await capture('04 / Export the real interactive player', '19 / 20 — Order update · shipped');
  const waiting = page.waitForEvent('download'); await action();
  const download = await waiting; const file = resolve('demo/checkout.html'); await download.saveAs(file);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await context.setOffline(true);
    context.on('request', request => { if (/^(https?|wss?):/u.test(request.url())) requests.push(request.url()); });
    const viewer = await context.newPage(); viewer.on('pageerror', error => errors.push(error.message));
    await viewer.goto(pathToFileURL(file).href);
    assert.equal(await viewer.locator('[data-status]').textContent(), 'Overview · 0 / 20');
    for (let index = 0; index < 19; index++) await viewer.locator('[data-action="next"]').click();
    assert.equal(await viewer.locator('[data-status]').textContent(), '19 / 20 — Order update · shipped');
    await viewer.screenshot({ path: resolve(output, 'offline.png') });
    await viewer.locator('[data-branch="alt:2"]').selectOption('alt:2:second');
    assert.equal(await viewer.locator('[data-status]').textContent(), 'Overview · 0 / 20');
  } finally { await context.close(); }
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'frames.json'), JSON.stringify({ frames, remoteRequests: requests, pageErrors: errors, fullscreen: 'passed' }, null, 2));
  await copyFile(resolve(output, 'frame-00.png'), resolve('docs/validation/showcase-overview.png'));
  await copyFile(resolve(output, 'frame-03.png'), resolve('docs/validation/showcase-recovery.png'));
  console.log(`Showcase: ${frames.length} captured states, fullscreen passed, real offline file passed, remote requests ${requests.length}`);
} finally { await browser?.close(); server.kill(); }
