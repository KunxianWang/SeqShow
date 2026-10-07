import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('production preview loads the login example and plays only the chosen path', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 6');
  await expect(page.locator('[data-export]')).toBeEnabled();
  await page.locator('[data-branch="alt:1"]').selectOption('alt:1:second');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
  for (let step = 2; step <= 6; step++) await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('6 / 6 — Login failed');
  await expect(page.locator('[data-seq-step="step:6"]')).toHaveAttribute('data-phase', 'inactive');
  await expect(page.locator('[data-error]')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('a downloaded production artifact opens in a fresh offline file context', async ({ page, browser, browserName }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('[data-export]')).toBeEnabled();
  await page.locator('[data-branch="alt:1"]').selectOption('alt:1:second');
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const file = testInfo.outputPath('seqshow-login.html');
  await (await downloaded).saveAs(file);
  const html = await readFile(file, 'utf8');
  expect(html).not.toContain('<script src=');
  expect(html).not.toContain('virtual:seqshow');
  const offline = await browser.newContext();
  const requests: string[] = [];
  const errors: string[] = [];
  offline.on('request', request => { if (/^(https?|wss?):/iu.test(request.url())) requests.push(request.url()); });
  if (browserName === 'webkit') {
    await offline.route(/^https?:/iu, route => route.abort('internetdisconnected'));
    await offline.routeWebSocket(/^wss?:/iu, socket => { requests.push(socket.url()); socket.close(); });
  } else await offline.setOffline(true);
  const viewer = await offline.newPage();
  viewer.on('pageerror', error => errors.push(String(error)));
  viewer.on('websocket', socket => requests.push(socket.url()));
  try {
    await viewer.goto(pathToFileURL(resolve(file)).href);
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 6');
    await expect(viewer.locator('[data-branch="alt:1"]')).toHaveValue('alt:1:second');
    await expect(viewer.locator('[data-action="focus"]')).toHaveAttribute('aria-pressed', 'true');
    await viewer.locator('[data-action="next"]').click();
    await expect(viewer.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
    await viewer.locator('[data-branch="alt:1"]').selectOption('alt:1:first');
    await expect(viewer.locator('[data-status]')).toHaveText('Overview · 0 / 6');
    for (let step = 1; step <= 6; step++) await viewer.locator('[data-action="next"]').click();
    await expect(viewer.locator('[data-status]')).toHaveText('6 / 6 — Login succeeded');
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await offline.close(); }
});
