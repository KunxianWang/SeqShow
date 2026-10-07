import { fixtures as originalFixtures } from './fixtures';
import { parsedFixtures } from '../fixtures/parsed';
import { bindSteps, assertSafeSvg, renderSequence, serialize } from '../../src/renderer/mermaid-adapter';
import { mountPlayer } from '../../src/player';
import { exportHtml, safeJson } from '../../src/export';
import css from '../../src/player.css';

const fixtures = [...originalFixtures, ...parsedFixtures];
const root = document.querySelector<HTMLElement>('[data-player]')!;
const select = document.querySelector<HTMLSelectElement>('[data-fixture]')!;
const error = document.querySelector<HTMLElement>('[data-error]')!;
let current = fixtures[0];
let player: ReturnType<typeof mountPlayer>;
const runtime = await fetch('/runtime.js').then(response => response.text());
for (const fixture of fixtures) {
  const option = document.createElement('option'); option.value = fixture.id; option.textContent = fixture.title; select.append(option);
}
async function render(id: string) {
  player?.destroy(); current = fixtures.find(fixture => fixture.id === id)!;
  if (!current) throw new Error('Unknown fixture');
  select.value = id; error.textContent = '';
  root.querySelector('[data-diagram]')!.replaceChildren(await renderSequence(current.model));
  player = mountPlayer(root, current.model);
  document.querySelector('[data-source]')!.textContent = serialize(current.model).source;
  return { id, model: current.model, paths: current.paths, ...player.snapshot() };
}
select.onchange = () => { render(select.value).catch(reason => { error.textContent = String(reason); }); };
document.querySelector<HTMLButtonElement>('[data-export]')!.onclick = () => {
  const blob = new Blob([exportCurrent()], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `seqshow-${current.id}.html`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
function exportCurrent() { return exportHtml(root.querySelector('svg')!, current.model, player.snapshot().choices, runtime, css); }
function geometry() {
  const svg = root.querySelector('svg')!;
  return { viewBox: svg.getAttribute('viewBox'), boxes: Array.from(svg.querySelectorAll('g, line, rect, path, text, circle'), node => {
    const box = (node as SVGGraphicsElement).getBBox();
    return [node.localName, box.x, box.y, box.width, box.height];
  }) };
}
function negativeChecks() {
  const svg = root.querySelector('svg')!;
  const rejected: string[] = [];
  const attempt = (name: string, mutation: (clone: SVGSVGElement) => void, check: (clone: SVGSVGElement) => void) => {
    const clone = svg.cloneNode(true) as SVGSVGElement; mutation(clone);
    try { check(clone); } catch { rejected.push(name); return; }
    throw new Error(`Unsafe/mismatched SVG accepted: ${name}`);
  };
  for (const tag of ['script', 'foreignObject', 'image', 'animate', 'a']) {
    attempt(tag, clone => clone.append(document.createElementNS('http://www.w3.org/2000/svg', tag)), assertSafeSvg);
  }
  attempt('event handler', clone => clone.setAttribute('onload', 'alert(1)'), assertSafeSvg);
  attempt('external href', clone => clone.querySelector('path')!.setAttribute('href', 'https://example.com/x'), assertSafeSvg);
  attempt('external CSS', clone => clone.querySelector('style')!.textContent += '.x{fill:url(https://example.com/x)}', assertSafeSvg);
  attempt('CSS escape', clone => clone.querySelector('style')!.textContent += '.x{fill:u\\72l(https://example.com/x)}', assertSafeSvg);
  const mappingCheck = (clone: SVGSVGElement) => bindSteps(clone, current.model);
  attempt('missing event', clone => clone.querySelector('[data-et="message"]')!.remove(), mappingCheck);
  attempt('wrong sender', clone => clone.querySelector('[data-et="message"]')!.setAttribute('data-from', 'wrong'), mappingCheck);
  attempt('wrong label', clone => clone.querySelector('.messageText')!.textContent = 'wrong', mappingCheck);
  attempt('duplicate event', clone => clone.append(clone.querySelector('[data-et="message"]')!.cloneNode(true)), mappingCheck);
  attempt('wrong case', clone => clone.querySelector('.sectionTitle')!.textContent = 'wrong', mappingCheck);
  if (safeJson('</script>\u2028\u2029').includes('<')) throw new Error('Unsafe JSON');
  return rejected;
}
const api = {
  fixtures: fixtures.map(({ id, title }) => ({ id, title })), render,
  snapshot: () => player.snapshot(), seek: (index: number) => player.seek(index), geometry,
  exportCurrent, negativeChecks, destroy: () => player.destroy(),
};
declare global {
  interface Window {
    m0: typeof api;
    m0Ready?: boolean;
    m0Failure?: string;
  }
}
window.m0 = api;
try {
  await render(current.id);
  window.m0Ready = true;
} catch (reason) {
  error.textContent = String(reason);
  window.m0Failure = String(reason);
}
