import { build } from 'esbuild';
import { chromium, firefox, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { buildPlayer } from './build-player.mjs';

const output = resolve('artifacts/m0');
const engines = { chromium, firefox, webkit };
const selected = (process.argv.find(arg => arg.startsWith('--browsers='))?.split('=')[1] || 'chromium').split(',');
for (const name of selected) assert(name in engines, `Unknown browser: ${name}`);
await mkdir(output, { recursive: true });
const [harness, runtime, html, css] = await Promise.all([
  build({ entryPoints: ['tests/m0/entry.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2024', loader: { '.css': 'text' } }),
  buildPlayer(),
  readFile('tests/m0/index.html', 'utf8'), readFile('src/player.css', 'utf8'),
]);
const runtimeText = runtime.code;
assert(!/mermaid|katex|https?:\/\//iu.test(runtimeText), 'Offline runtime must have no Mermaid or remote dependency');
const routes = new Map([
  ['/', ['text/html', html]], ['/m0.js', ['text/javascript', harness.outputFiles[0].text]],
  ['/runtime.js', ['text/javascript', runtimeText]], ['/player.css', ['text/css', css]],
]);
const server = createServer((request, response) => {
  const entry = routes.get(request.url);
  response.writeHead(entry ? 200 : 404, { 'Content-Type': entry ? `${entry[0]}; charset=utf-8` : 'text/plain' });
  response.end(entry?.[1] || 'Not found');
});
await new Promise((accept, reject) => { server.once('error', reject); server.listen(process.argv.includes('--serve') ? 4173 : 0, '127.0.0.1', accept); });
const address = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--serve')) {
  console.log(`M0 preview: ${address}\nOriginal and parsed validation fixtures; the full editor follows in M3.`);
} else {
  const report = { stage: 'M0 regression + M2 parsed inputs', status: 'running', testedAt: new Date().toISOString(), mermaid: '12.1.0', node: process.version, requestedBrowsers: selected, runtimeBytes: Buffer.byteLength(runtimeText), browsers: [] };
  try {
    for (const name of selected) {
      const engine = engines[name];
      console.log(`Validating ${name}...`);
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(address);
        await page.waitForFunction(() => window.m0Ready || window.m0Failure, undefined, { timeout: 60000 });
        assert.equal(await page.evaluate(() => window.m0Failure), undefined);
        const fixtures = await page.evaluate(() => window.m0.fixtures);
        const results = [];
        for (const fixture of fixtures) {
          console.log(`  ${fixture.id}`);
          const data = await page.evaluate(id => window.m0.render(id), fixture.id);
          await page.evaluate(() => document.fonts.ready);
          const baseline = await page.evaluate(() => window.m0.geometry());
          let checkedStates = 0;
          for (const path of data.paths) {
            await selectBranches(page, path.choices);
            const snapshot = await page.evaluate(() => window.m0.snapshot());
            assert.equal(snapshot.index, 0); assert.equal(snapshot.playing, false);
            assert.deepEqual(snapshot.stepIds, path.ids);
            if (!path.ids.length) {
              assert.equal(await page.locator('[data-action="play"]').isDisabled(), true);
              assert.equal(await page.locator('[data-action="next"]').isDisabled(), true);
              assert.equal(await page.locator('[data-action="previous"]').isDisabled(), true);
            }
            for (let index = 0; index <= path.ids.length; index++) {
              await page.evaluate(index => window.m0.seek(index), index);
              await assertHighlight(page, data.model, path.ids, index);
              assert.deepEqual(await page.evaluate(() => window.m0.geometry()), baseline, `Geometry changed: ${fixture.id}/${index}`);
              checkedStates++;
            }
            await page.locator('[data-action="focus"]').click();
            assert.deepEqual(await page.evaluate(() => window.m0.geometry()), baseline, 'Focus changed geometry');
            await page.locator('[data-action="focus"]').click();
          }
          // Export the final non-default path while mid-presentation; it must reopen at Overview.
          await page.evaluate(() => window.m0.seek(1));
          const exported = await page.evaluate(() => window.m0.exportCurrent());
          const file = resolve(output, `${name}-${fixture.id}.html`);
          await writeFile(file, exported);
          if (fixture.id === 'login') {
            assert.equal((await page.evaluate(() => window.m0.negativeChecks())).length, 14);
            await page.screenshot({ path: resolve(output, `${name}-login.png`), fullPage: true });
            await checkPlayback(page, 6);
            await checkLifecycle(page);
          }
          if (fixture.id === 'unicode' && name === 'chromium') await page.screenshot({ path: resolve(output, 'chromium-unicode.png'), fullPage: true });
          const offline = await browser.newContext({ viewport: { width: 1280, height: 960 } });
          const remoteRequests = [], offlineErrors = [];
          offline.on('request', request => { if (/^(https?|wss?):/iu.test(request.url())) remoteRequests.push(request.url()); });
          // Windows WebKit blocks file:// itself under setOffline(true). Keep
          // local files available, but deny every remote request and socket.
          const offlineMode = name === 'webkit' ? 'remote-network-blocked' : 'setOffline';
          if (name === 'webkit') {
            await offline.route(/^https?:/iu, route => route.abort('internetdisconnected'));
            await offline.routeWebSocket(/^wss?:/iu, socket => { remoteRequests.push(socket.url()); socket.close(); });
          } else await offline.setOffline(true);
          const offlinePage = await offline.newPage();
          offlinePage.on('pageerror', error => offlineErrors.push(String(error)));
          offlinePage.on('websocket', socket => remoteRequests.push(socket.url()));
          try {
            await offlinePage.goto(pathToFileURL(file).href);
            await offlinePage.locator('[data-action="next"]').waitFor();
            await offlinePage.evaluate(() => document.fonts.ready);
            await assertHighlight(offlinePage, data.model, data.paths.at(-1).ids, 0);
            const exportedGeometry = await svgGeometry(offlinePage);
            assert.deepEqual(exportedGeometry, baseline, 'Export changed SVG geometry');
            assert.equal(await offlinePage.locator('[data-action="focus"]').getAttribute('aria-pressed'), 'true');
            for (const path of data.paths) {
              await selectBranches(offlinePage, path.choices);
              await offlinePage.locator('[data-action="reset"]').click();
              for (let index = 0; index <= path.ids.length; index++) {
                if (index) await offlinePage.locator('[data-action="next"]').click();
                await assertHighlight(offlinePage, data.model, path.ids, index);
                assert.deepEqual(await svgGeometry(offlinePage), exportedGeometry, 'Offline geometry changed');
              }
              await offlinePage.locator('[data-action="focus"]').click();
              assert.deepEqual(await svgGeometry(offlinePage), exportedGeometry);
              await offlinePage.locator('[data-action="focus"]').click();
            }
            if (fixture.id === 'login') await checkPlayback(offlinePage, 6);
            if (fixture.id === 'single') {
              await offlinePage.locator('[data-action="play"]').click();
              assert.equal(await offlinePage.locator('[data-action="play"]').textContent(), 'Play');
            }
            assert.deepEqual(remoteRequests, [], 'Offline HTML attempted network access');
            assert.deepEqual(offlineErrors, [], 'Offline player errors');
          } finally { await offline.close(); }
          results.push({ id: fixture.id, paths: data.paths.length, checkedStates, offline: 'passed', offlineMode, exportedBytes: Buffer.byteLength(exported), remoteRequests: remoteRequests.length });
        }
        await page.evaluate(() => window.m0.render('notes'));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: resolve(output, `${name}-mobile-notes.png`), fullPage: true });
        assert(await page.locator('[data-diagram]').evaluate(node => node.scrollWidth > node.clientWidth), 'Mobile diagram should scroll');
        assert.deepEqual(errors, [], 'Harness page errors');
        report.browsers.push({ name, version: browser.version(), fixtures: results, negativeChecks: 14, mobileScroll: 'passed', playback: 'passed' });
      } finally { await browser.close(); }
    }
    report.status = 'passed';
    await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`M0 passed. Evidence: ${output}`);
  } catch (error) {
    report.status = 'failed'; report.error = String(error);
    await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    throw error;
  } finally { await new Promise(accept => server.close(accept)); }
}

async function checkLifecycle(page) {
  await page.locator('[data-action="reset"]').click();
  // Play/Pause/Play must still produce exactly one tick per 1500 ms.
  for (let i = 0; i < 3; i++) await page.locator('[data-action="play"]').click();
  await page.clock.runFor(1500);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).index, 2);
  await page.locator('[data-action="reset"]').click();
  await page.clock.runFor(3000);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).index, 0);
  await page.locator('[data-action="play"]').click();
  const before = await page.locator('[data-status]').textContent();
  await page.evaluate(() => window.m0.destroy());
  await page.clock.runFor(3000);
  assert.equal(await page.locator('[data-status]').textContent(), before);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).playing, false);
  await page.evaluate(() => window.m0.render('login'));
  await page.clock.runFor(3000);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).index, 0);
  await page.locator('[data-action="play"]').click();
  await page.evaluate(() => window.m0.render('login'));
  await page.clock.runFor(3000);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).index, 0);
  await page.locator('[data-action="play"]').click();
  await page.clock.runFor(1500);
  assert.equal((await page.evaluate(() => window.m0.snapshot())).index, 2);
}

async function selectBranches(page, choices) {
  for (const [id, value] of Object.entries(choices)) await page.locator(`[data-branch="${id}"]`).selectOption(value);
}
async function svgGeometry(page) {
  return page.locator('[data-diagram] svg').evaluate(svg => ({ viewBox: svg.getAttribute('viewBox'), boxes: Array.from(svg.querySelectorAll('g, line, rect, path, text, circle'), node => {
    const box = node.getBBox(); return [node.localName, box.x, box.y, box.width, box.height];
  }) }));
}
async function assertHighlight(page, model, ids, index) {
  const steps = model.nodes.flatMap(node => node.kind === 'alternative' ? node.cases.flatMap(branch => branch.steps) : [node]);
  const current = steps.find(step => step.id === ids[index - 1]);
  const expectedParticipants = current ? [...new Set(current.kind === 'message' ? [current.from, current.to] : current.participants)].sort() : [];
  const actual = await page.locator('[data-diagram] svg').evaluate(svg => ({
    current: [...new Set(Array.from(svg.querySelectorAll('[data-phase="current"]'), node => node.getAttribute('data-seq-step')))],
    participants: [...new Set(Array.from(svg.querySelectorAll('[data-active="true"]'), node => node.getAttribute('data-seq-participant')))].sort(),
    phases: Array.from(svg.querySelectorAll('[data-seq-step]'), node => [node.getAttribute('data-seq-step'), node.getAttribute('data-phase')]),
  }));
  assert.deepEqual(actual.current, current ? [current.id] : []);
  assert.deepEqual(actual.participants, expectedParticipants);
  for (const [id, phase] of actual.phases) {
    const position = ids.indexOf(id);
    assert.equal(phase, position < 0 ? 'inactive' : position === index - 1 ? 'current' : position < index - 1 ? 'past' : 'future');
  }
  const status = await page.locator('[data-status]').textContent();
  assert(status.includes(`${index} / ${ids.length}`), `Unexpected status: ${status}`);
}
async function checkPlayback(page, total) {
  await page.clock.install();
  const status = () => page.locator('[data-status]').textContent();
  await page.locator('[data-action="reset"]').click();
  await page.locator('[data-action="play"]').click();
  assert((await status()).startsWith('1 /'));
  await page.locator('[data-action="focus"]').click();
  assert((await status()).startsWith('1 /'));
  assert.equal(await page.locator('[data-action="play"]').textContent(), 'Pause');
  await page.locator('[data-action="focus"]').click();
  await page.clock.runFor(1500);
  assert((await status()).startsWith('2 /'));
  await page.locator('[data-action="play"]').click(); // Pause preserves index.
  await page.clock.runFor(3000);
  assert((await status()).startsWith('2 /'));
  await page.locator('[data-action="play"]').click(); // Resume preserves index.
  assert((await status()).startsWith('2 /'));
  await page.clock.runFor((total - 2) * 1500);
  assert((await status()).startsWith(`${total} /`));
  assert.equal(await page.locator('[data-action="play"]').textContent(), 'Play');
  await page.locator('[data-action="play"]').click(); // Replay immediately begins at 1.
  assert((await status()).startsWith('1 /'));
  await page.locator('[data-action="next"]').click(); // Manual navigation pauses.
  assert.equal(await page.locator('[data-action="play"]').textContent(), 'Play');
  await page.locator('[data-action="play"]').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
  });
  assert.equal(await page.locator('[data-action="play"]').textContent(), 'Play');
  await page.clock.runFor(3000);
  assert((await status()).startsWith('2 /'));
  await page.locator('[data-action="previous"]').click();
  assert((await status()).startsWith('1 /'));
  await page.locator('[data-action="play"]').click();
  const branch = page.locator('select[data-branch]').first();
  await branch.selectOption(await branch.locator('option').first().getAttribute('value'));
  assert((await status()).startsWith('Overview'));
  assert.equal(await page.locator('[data-action="play"]').textContent(), 'Play');
}
