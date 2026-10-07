import { test, expect, type Page } from '@playwright/test';

const linear = 'sequenceDiagram\nA->>B: hello\nB-->>A: world';
const ready = (page: Page) => expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'ready');
async function open(page: Page) { await page.goto('/'); await ready(page); }
async function renderSource(page: Page, source: string) {
  await page.locator('[data-source]').fill(source);
  await page.locator('[data-render]').click();
  await ready(page);
}
const geometry = (page: Page) => page.locator('[data-diagram] svg').evaluate(svg => ({
  viewBox: svg.getAttribute('viewBox'),
  boxes: Array.from(svg.querySelectorAll('g,line,path,rect,text,circle'), node => {
    const box = (node as SVGGraphicsElement).getBBox(); return [node.localName, box.x, box.y, box.width, box.height];
  }),
}));

async function injectRendererFault(page: Page, initial = false) {
  const fault = () => {
    const original = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (source, type) {
      const result = original.call(this, source, type);
      if (type === 'image/svg+xml') {
        DOMParser.prototype.parseFromString = original;
        // Simulate an unsupported SVG shape at the actual renderer trust boundary.
        result.documentElement.append(result.createElementNS('http://www.w3.org/2000/svg', 'foreignObject'));
      }
      return result;
    };
  };
  if (initial) await page.addInitScript(fault); else await page.evaluate(fault);
}

test('renderer failure preserves the successful preview and source, then recovers on Render', async ({ page }) => {
  await open(page); const baseline = await geometry(page);
  await injectRendererFault(page);
  await page.locator('[data-source]').fill(linear); await page.locator('[data-render]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('[data-error]')).toContainText('Could not prepare this diagram for playback');
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await expect(page.locator('[data-export]')).toBeDisabled();
  expect(await geometry(page)).toEqual(baseline);
  await page.locator('[data-render]').click(); await ready(page);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 2');
});

test('initial renderer failure offers Retry without losing the bundled source', async ({ page }) => {
  await injectRendererFault(page, true); await page.goto('/');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('[data-render]')).toHaveText('Retry');
  await expect(page.locator('[data-status]')).toHaveText('No presentation yet.');
  await expect(page.locator('[data-source]')).toHaveValue(/POST \/login/u);
  await page.locator('[data-render]').click(); await ready(page);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 6');
});

test('E01 custom source plays, goes back and reports real endpoints', async ({ page }) => {
  await open(page); await renderSource(page, linear);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 2');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 2 — hello');
  await expect(page.locator('[data-step-details]')).toHaveText('A → B');
  await expect(page.locator('line[data-phase="current"]')).toHaveCount(1);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('2 / 2 — world');
  await expect(page.locator('[data-step-details]')).toHaveText('B → A');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 2 — hello');
});

test('E02/E03 unequal branches reset, pause and keep geometry stable', async ({ page }) => {
  await open(page); await page.locator('[data-example]').selectOption('cache'); await ready(page);
  await page.clock.install();
  const baseline = await geometry(page);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 3');
  await page.locator('[data-action="play"]').click();
  await page.locator('[data-branch="alt:1"]').selectOption('alt:1:second');
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 5');
  await expect(page.locator('[data-action="play"]')).toHaveText('Play');
  await page.clock.runFor(3000);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 5');
  await expect(page.locator('[data-other-path]')).toHaveText('Other path: cache hit');
  expect(await geometry(page)).toEqual(baseline);
  for (let i = 1; i <= 5; i++) await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('5 / 5 — Profile ready');
  await expect(page.locator('[data-seq-step="step:2"][data-phase="inactive"]')).toHaveCount(2);
  await page.locator('[data-action="focus"]').click();
  expect(await geometry(page)).toEqual(baseline);
});

test('E04 self calls, repeated messages and every Note placement map independently', async ({ page }) => {
  await open(page); await page.locator('[data-example]').selectOption('validation'); await ready(page);
  const baseline = await geometry(page);
  const labels = ['Request received', 'Validate', 'Validate', 'Rules are local', 'Both checks complete', 'Continue with the same rules'];
  for (const [index, text] of labels.entries()) {
    await page.locator('[data-action="next"]').click();
    await expect(page.locator('[data-status]')).toHaveText(`${index + 1} / 6 — ${text}`);
    const current = page.locator(`[data-seq-step="step:${index + 1}"][data-phase="current"]`);
    await expect(current).toHaveCount(index === 1 || index === 2 ? 2 : 1);
    if (index === 1 || index === 2) {
      await expect(page.locator('path[data-phase="current"]')).toHaveCount(1);
      await expect(page.locator('[data-step-details]')).toHaveText('API → API');
    }
    expect(await geometry(page)).toEqual(baseline);
  }
  await expect(page.locator('[data-step-details]')).toHaveText('Note · API, DB');
});

test('E05 dirty and failed drafts retain the old preview, locate errors and recover', async ({ page }) => {
  await open(page); await page.clock.install();
  await page.locator('[data-action="play"]').click();
  const invalid = 'sequenceDiagram\n  Note over A,Missing: unknown\nA->>A: hello';
  await page.locator('[data-source]').fill(invalid);
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'stale');
  await expect(page.locator('[data-preview-state]')).toContainText('Last successful render');
  await expect(page.locator('[data-export]')).toBeDisabled();
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await page.clock.runFor(3000);
  await expect(page.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
  await page.locator('[data-render]').click();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('[data-source]')).toHaveValue(invalid);
  await expect(page.locator('[data-error] button')).toContainText('Line 2, column 15');
  await page.locator('[data-error] button').click();
  await expect(page.locator('[data-source]')).toBeFocused();
  expect(await page.locator('[data-source]').evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart, node.selectionEnd))).toBe('M');
  await renderSource(page, linear);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 2');
  await expect(page.locator('[data-error]')).toBeEmpty();
  await expect(page.locator('[data-export]')).toBeEnabled();
});

test('E06 editing while Render awaits prevents a stale result from replacing the successful graph', async ({ page }) => {
  await open(page); await renderSource(page, linear);
  const baseline = await geometry(page);
  await page.evaluate(() => {
    const editor = document.querySelector<HTMLTextAreaElement>('[data-source]')!;
    editor.value = 'sequenceDiagram\nC->>D: obsolete'; editor.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>('[data-render]')!.click();
    // Same JS task: this happens before the asynchronous renderer can settle.
    editor.value = 'sequenceDiagram\nX->>Y: newest'; editor.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('[data-render]')).toBeEnabled();
  await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'stale');
  await expect(page.locator('[data-source]')).toHaveValue('sequenceDiagram\nX->>Y: newest');
  expect(await geometry(page)).toEqual(baseline);
  await expect(page.locator('[data-diagram]')).not.toContainText('obsolete');
  await expect(page.locator('[data-export]')).toBeDisabled();
  await page.locator('[data-render]').click(); await ready(page);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('1 / 1 — newest');
});

test('E06 startup render also cannot overwrite a draft typed while the example loads', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const editor = document.querySelector<HTMLTextAreaElement>('[data-source]')!;
      editor.value = 'sequenceDiagram\nA->>A: draft during initial render';
      editor.dispatchEvent(new Event('input'));
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-render]')).toBeEnabled();
  await expect(page.locator('[data-source]')).toHaveValue('sequenceDiagram\nA->>A: draft during initial render');
  await expect(page.locator('[data-diagram] svg')).toHaveCount(0);
  await expect(page.locator('[data-export]')).toBeDisabled();
  await page.locator('[data-render]').click(); await ready(page);
});

test('E07 keyboard controls stay inside the player and native button Space fires once', async ({ page }) => {
  await open(page);
  await page.clock.install({ time: '2026-10-07T00:00:00Z' });
  // Drive ticks explicitly; slow browser actions must not advance autoplay.
  await page.clock.pauseAt('2026-10-07T00:01:00Z');
  const player = page.locator('[data-player]');
  await player.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 6');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-action="play"]')).toHaveText('Pause');
  await page.clock.runFor(1500);
  await expect(page.locator('[data-status]')).toHaveText('2 / 6 — Find user');
  await page.keyboard.press('Space'); await page.clock.runFor(3000);
  await expect(page.locator('[data-status]')).toHaveText('2 / 6 — Find user');
  await page.keyboard.press('Home');
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 6');
  await page.locator('[data-action="play"]').focus(); await page.keyboard.press('Space');
  await expect(page.locator('[data-action="play"]')).toHaveText('Pause');
  await player.focus(); await page.keyboard.press('Space');
  await page.locator('[data-branch]').focus(); await page.keyboard.press('Home');
  await expect(page.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
  await page.locator('[data-source]').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Home'); await page.keyboard.press('Space');
  await expect(page.locator('[data-status]')).toHaveText('1 / 6 — POST /login');
  await expect(page.locator('[data-action="play"]')).toHaveText('Play');
  await page.locator('[data-render]').click(); await ready(page);
  await player.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-status]')).toContainText('1 / 6');
});

test('E09 loading an example protects modified drafts with Cancel, Escape and explicit Replace', async ({ page }) => {
  await open(page); await page.locator('[data-source]').fill(linear);
  await page.locator('[data-example]').selectOption('request');
  await expect(page.locator('[data-replace]')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await expect(page.locator('[data-example]')).toHaveValue('login');
  await page.locator('[data-example]').selectOption('chinese'); await page.keyboard.press('Escape');
  await expect(page.locator('[data-source]')).toHaveValue(linear);
  await expect(page.locator('[data-example]')).toHaveValue('login');
  await page.locator('[data-example]').selectOption('request');
  await page.getByRole('button', { name: 'Replace current source', exact: true }).click(); await ready(page);
  await expect(page.locator('[data-source]')).toHaveValue(/GET \/health/u);
  await expect(page.locator('[data-status]')).toHaveText('Overview · 0 / 2');
});

test('the current step scrolls inside a long diagram without moving the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await renderSource(page, 'sequenceDiagram\n' + Array.from({ length: 30 }, (_, i) => `A->>B: Step ${i + 1}`).join('\n'));
  const before = await geometry(page);
  const position = await page.evaluate(() => window.scrollY);
  for (let i = 0; i < 30; i++) await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-status]')).toHaveText('30 / 30 — Step 30');
  expect(await page.locator('[data-diagram]').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  expect(await geometry(page)).toEqual(before);
});

test('E10 HTML, directives, unsupported syntax and oversized input are rejected without execution or external requests', async ({ page }) => {
  await open(page);
  await page.evaluate(() => Object.defineProperty(window, 'seqshowUnsafeTest', { value: 0, writable: true }));
  const remote: string[] = [];
  page.on('request', request => { if (/^https?:/u.test(request.url()) && !request.url().startsWith('http://127.0.0.1:')) remote.push(request.url()); });
  for (const source of [
    'sequenceDiagram\nA->>A: <img src="https://bad.example.invalid/x" onerror="window.seqshowUnsafeTest=1">',
    'sequenceDiagram\n%%{init: {}}%%\nA->>B: hello',
    'sequenceDiagram\nopt later\nA->>B: hello\nend',
    'sequenceDiagram\nA->>A: ' + 'x'.repeat(50_001),
    '',
  ]) {
    await page.locator('[data-source]').fill(source); await page.locator('[data-render]').click();
    await expect(page.locator('[data-player]')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('[data-error] button')).toBeVisible();
    await expect(page.locator('[data-export]')).toBeDisabled();
    await expect(page.locator('[data-source]')).toHaveValue(source);
  }
  await expect(page.locator('[data-error] img, [data-error] script')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'seqshowUnsafeTest'))).toBe(0);
  expect(remote).toEqual([]);
  await renderSource(page, linear);
});

test('six examples are renderable and the two independent alternatives have four distinct paths', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-example] option')).toHaveCount(6);
  for (const id of ['request', 'cache', 'job', 'validation', 'chinese', 'login']) {
    await page.locator('[data-example]').selectOption(id); await ready(page);
    await expect(page.locator('[data-error]')).toBeEmpty();
    await expect(page.locator('[data-export]')).toBeEnabled();
  }
  await page.locator('[data-example]').selectOption('job'); await ready(page);
  for (const [first, second, total] of [['first', 'first', 4], ['first', 'second', 5], ['second', 'first', 5], ['second', 'second', 6]] as const) {
    await page.locator('[data-branch="alt:1"]').selectOption(`alt:1:${first}`);
    await page.locator('[data-branch="alt:2"]').selectOption(`alt:2:${second}`);
    await expect(page.locator('[data-status]')).toHaveText(`Overview · 0 / ${total}`);
    for (let i = 0; i < total; i++) await page.locator('[data-action="next"]').click();
    await expect(page.locator('[data-status]')).toHaveText(`${total} / ${total} — Update job status`);
  }
});

for (const width of [360, 390, 768, 1280]) {
  test(`E08 Chinese layout at ${width}px has readable SVG and only internal overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page); await page.locator('[data-example]').selectOption('chinese'); await ready(page);
    const baseline = await geometry(page);
    await page.locator('[data-action="next"]').click();
    await expect(page.locator('[data-status]')).toContainText('1 / 6 — 提交订单');
    await expect(page.locator('[data-diagram]')).toContainText('手机用户与订单页面');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width < 600) expect(await page.locator('[data-diagram]').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await geometry(page)).toEqual(baseline);
    await page.screenshot({ path: testInfo.outputPath(`chinese-${width}-step1.png`), fullPage: true });
    await page.locator('[data-action="focus"]').click();
    await expect(page.locator('[data-status]')).toContainText('1 / 6');
    expect(await geometry(page)).toEqual(baseline);
  });
}
