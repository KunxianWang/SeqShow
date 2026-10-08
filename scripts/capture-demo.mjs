import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

// Capture the actual production UI; keep this server separate from user previews.
const output = resolve('artifacts/launch');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview',
  '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { windowsHide: true, stdio: 'pipe' });
let browser;
try {
  await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error('Capture preview did not start')), 15_000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Capture preview exited: ${code}`)); });
    server.stdout.on('data', data => {
      // Strip ANSI colours: with FORCE_COLOR set, Vite styles the port and splits the URL.
      if (stripVTControlCharacters(data.toString()).includes('127.0.0.1:4176')) { clearTimeout(timeout); accept(); }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1240 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4176/');
  await page.waitForFunction(() => document.querySelector('[data-player]')?.dataset.state === 'ready');
  // Exercise Render on real input before capturing the presentation.
  const source = await page.locator('[data-source]').inputValue();
  await page.locator('[data-source]').fill(source);
  await page.locator('[data-render]').click();
  await page.waitForFunction(() => document.querySelector('[data-player]')?.dataset.state === 'ready');
  const frames = [];
  const capture = async (viewer, caption, expected, duration = 1600) => {
    assert.equal(await viewer.locator('[data-status]').textContent(), expected);
    const file = `frame-${String(frames.length).padStart(2, '0')}.png`;
    await viewer.locator('[data-player]').screenshot({ path: resolve(output, file) });
    frames.push({ file, caption, status: expected, duration });
  };
  const click = action => page.locator(`[data-action="${action}"]`).click();
  await click('next');
  await capture(page, '1. Present each message', '1 / 6 — POST /login');
  await click('next');
  await capture(page, 'Focus the current interaction', '2 / 6 — Find user');
  await click('next'); await click('next');
  await capture(page, 'Self calls are individual steps', '4 / 6 — Verify password');
  await click('next'); await click('next');
  await capture(page, 'The success path ends here', '6 / 6 — Login succeeded');
  await page.locator('[data-branch]').selectOption('alt:1:second');
  await capture(page, '2. Choose a different presentation path', 'Overview · 0 / 6');
  for (let i = 0; i < 5; i++) await click('next');
  await capture(page, 'Play the failure path', '5 / 6 — 401');
  await click('focus');
  await capture(page, 'Keep the full context with Focus off', '5 / 6 — 401');
  const waiting = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const artifact = await waiting;
  const file = resolve(output, 'login.html'); await artifact.saveAs(file);
  const offline = await browser.newContext({ viewport: { width: 760, height: 1240 }, reducedMotion: 'reduce' });
  const remoteRequests = [];
  offline.on('request', request => { if (/^(https?|wss?):/iu.test(request.url())) remoteRequests.push(request.url()); });
  await offline.setOffline(true);
  const viewer = await offline.newPage();
  await viewer.goto(pathToFileURL(file).href);
  assert.equal(await viewer.locator('[data-branch]').inputValue(), 'alt:1:second');
  await capture(viewer, '3. Open the exported HTML offline', 'Overview · 0 / 6', 2200);
  for (let i = 0; i < 5; i++) await viewer.locator('[data-action="next"]').click();
  await capture(viewer, 'Same presentation, no network', '5 / 6 — 401');
  await viewer.locator('[data-action="next"]').click();
  await capture(viewer, 'Send one HTML file to your teammates', '6 / 6 — Login failed', 2400);
  assert.deepEqual(remoteRequests, []);
  await writeFile(resolve(output, 'frames.json'), `${JSON.stringify({ browser: browser.version(),
    source, remoteRequests, frames }, null, 2)}\n`);
  console.log(`Captured ${frames.length} real UI states; offline remote attempts: 0.`);
} finally {
  try { await browser?.close(); } finally { server.kill(); }
}
