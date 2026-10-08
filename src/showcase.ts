import './player.css';
import './showcase.css';
import css from './player.css?raw';
import runtime from 'virtual:seqshow-export-player';
import { checkoutSource } from './examples';
import { parseSequence } from './core/parser';
import { deriveSteps } from './core/playback';
import type { SequenceDocument } from './core/model';
import { renderSequence } from './renderer/mermaid-adapter';
import { mountPlayer } from './player';
import { exportHtml } from './export';

const root = document.querySelector<HTMLElement>('[data-player]')!;
const action = document.querySelector<HTMLButtonElement>('[data-demonstrate]')!;
const error = document.querySelector<HTMLElement>('[data-error]')!;
const title = document.querySelector<HTMLElement>('#chapter-title')!;
const previous = document.querySelector<HTMLButtonElement>('[data-chapter-prev]')!;
const next = document.querySelector<HTMLButtonElement>('[data-chapter-next]')!;
const fullscreen = document.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
const chapters = [
  { kicker: '01 / THE BIG PICTURE', title: ['Turn a flow', 'into a story.'],
    description: 'One sequence diagram. Six services. Dozens of interactions. Where should your audience look first? Give every step its own moment.',
    action: 'Start the walkthrough →', cue: 'Five short chapters, all running on the real player.', target: '' },
  { kicker: '02 / ONE STEP AT A TIME', title: ['One step', 'at a time.'],
    description: 'Where the request starts, which service it touches, and where it is now. Play, pause and step back at the pace of your talk.',
    action: 'Explain the next step →', cue: 'Or press Play below, or step with the arrow keys.', target: 'POST /orders + idempotency key' },
  { kicker: '03 / CHOOSE YOUR PATH', title: ['Same flow,', 'different story.'],
    description: 'What if the first payment is declined? Switch to another presentation path: only the chosen branch plays, and the diagram never moves.',
    action: 'Show the payment recovery path ↗', cue: 'Each branch is chosen independently. Switching returns to the overview; this button then jumps to the key message.', target: 'Authorize payment for order #1042' },
  { kicker: '04 / KEEP THE CONTEXT', title: ['Focus on now,', 'keep the context.'],
    description: 'As the event reaches fulfillment, the current message and its services stand out. Everything else stays readable, so nobody loses the thread.',
    action: 'Compare Focus on / off', cue: 'Click once to see the full context, again to return to Focus.', target: 'Deliver OrderConfirmed · at least once' },
  { kicker: '05 / TAKE THE STORY WITH YOU', title: ['Take the story', 'with you.'],
    description: 'The diagram, its paths and the player in one HTML file. Send it to a colleague; it opens directly and keeps playing, stepping back and switching paths — even offline.',
    action: 'Download this offline demo ↓', cue: 'Open the downloaded HTML directly. The offline promise covers the exported file; this page itself loads static assets.', target: 'Order update · shipped' },
];
const services = document.querySelector<HTMLElement>('[data-services]')!;
let chapter = 0, disposed = false;

// Service radar: mirror the current step's endpoints above the diagram, so the audience
// keeps its bearings even when the step is scrolled far from the participant headers.
function lightServices() {
  if (!player || !compiled) return;
  const { index, choices } = player.snapshot();
  const step = deriveSteps(compiled.model, choices)[index - 1];
  const roles = new Map<string, string>();
  if (step?.kind === 'message' && step.from === step.to) roles.set(step.from, 'SELF');
  else if (step?.kind === 'message') { roles.set(step.from, 'FROM'); roles.set(step.to, 'TO'); }
  else step?.participants.forEach(id => roles.set(id, 'NOTE'));
  for (const item of services.querySelectorAll<HTMLElement>('li')) {
    const role = roles.get(item.dataset.participant!);
    if (role) item.dataset.role = role; else delete item.dataset.role;
  }
}
const radar = new MutationObserver(lightServices);
let player: ReturnType<typeof mountPlayer> | undefined;
let compiled: { model: SequenceDocument; svg: SVGSVGElement } | undefined;

function setBranch(id: string, value: string) {
  const select = root.querySelector<HTMLSelectElement>(`[data-branch="${id}"]`)!;
  if (select.value === value) return;
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
}
function seekText(text: string) {
  if (!player || !compiled) return;
  const steps = deriveSteps(compiled.model, player.snapshot().choices);
  const index = steps.findIndex(step => step.text === text);
  player.seek(index < 0 ? 0 : index + 1);
}
function showChapter(index: number) {
  chapter = Math.max(0, Math.min(chapters.length - 1, index));
  const content = chapters[chapter];
  const emphasis = document.createElement('em'); emphasis.textContent = content.title[1];
  title.replaceChildren(content.title[0], document.createElement('br'), ' ', emphasis);
  document.querySelector<HTMLElement>('[data-kicker]')!.textContent = content.kicker;
  document.querySelector<HTMLElement>('[data-description]')!.textContent = content.description;
  document.querySelector<HTMLElement>('[data-cue]')!.textContent = content.cue;
  if (player) action.textContent = content.action;
  for (const button of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
    if (Number(button.dataset.chapter) === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.toggleAttribute('data-done', Number(button.dataset.chapter) < chapter);
  }
  previous.disabled = chapter === 0; next.disabled = chapter === chapters.length - 1;
  document.querySelector<HTMLElement>('[data-chapter-count]')!.textContent = `0${chapter + 1} / 05`;
  // Chapters provide repeatable starting points using the shared player's public controls.
  if (!player) return;
  setBranch('alt:1', 'alt:1:first'); setBranch('alt:2', 'alt:2:first');
  if (!player.snapshot().focus) root.querySelector<HTMLButtonElement>('[data-action="focus"]')!.click();
  seekText(content.target);
  if (chapter === 0) root.querySelector<HTMLElement>('[data-diagram]')!.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-chapter]')) {
  button.onclick = () => showChapter(Number(button.dataset.chapter));
}
previous.onclick = () => showChapter(chapter - 1);
next.onclick = () => showChapter(chapter + 1);

function demonstrate() {
  if (!player || !compiled) { void prepare(); return; }
  error.textContent = '';
  if (chapter === 0) showChapter(1);
  else if (chapter === 1) root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  else if (chapter === 2) {
    const recovered = player.snapshot().choices['alt:1'] === 'alt:1:second';
    setBranch('alt:1', recovered ? 'alt:1:first' : 'alt:1:second');
    seekText(recovered ? 'Authorized · payment ref p_82' : 'Declined · insufficient funds');
    action.textContent = recovered ? chapters[2].action : 'Back to the first-try success path ↗';
  } else if (chapter === 3) root.querySelector<HTMLButtonElement>('[data-action="focus"]')!.click();
  else {
    action.disabled = true;
    try {
      const html = exportHtml(compiled.svg, compiled.model, player.snapshot().choices, runtime, css);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'seqshow-checkout.html';
      try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (reason) { error.textContent = `Export failed — you can retry: ${String(reason)}`; }
    finally { action.disabled = false; }
  }
}
action.onclick = demonstrate;

async function prepare() {
  if (root.dataset.state === 'busy' || disposed) return;
  root.dataset.state = 'busy'; root.setAttribute('aria-busy', 'true'); action.disabled = true;
  action.textContent = 'Preparing the demo…'; error.textContent = '';
  try {
    const model = parseSequence(checkoutSource);
    if (!model.ok) throw new Error(model.diagnostics[0].message);
    const svg = await renderSequence(model.document);
    if (disposed) return;
    services.replaceChildren(...model.document.participants.map((participant, index) => {
      const item = document.createElement('li');
      const number = document.createElement('span'); number.textContent = `0${index + 1}`;
      const name = document.createElement('b'); name.textContent = participant.label;
      item.title = participant.label; item.dataset.participant = participant.id;
      item.append(number, name); return item;
    }));
    root.querySelector<HTMLElement>('[data-diagram]')!.replaceChildren(svg);
    player = mountPlayer(root, model.document); compiled = { model: model.document, svg };
    radar.observe(root.querySelector('[data-status]')!, { childList: true, subtree: true, characterData: true });
    lightServices();
    root.dataset.state = 'ready'; showChapter(chapter);
  } catch (reason) {
    if (disposed) return;
    root.dataset.state = 'error'; error.textContent = `The demo is not ready yet — please retry: ${String(reason)}`;
    action.textContent = 'Prepare the demo again';
  } finally {
    if (!disposed) { root.setAttribute('aria-busy', 'false'); action.disabled = false; }
  }
}
if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
fullscreen.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { error.textContent = 'The browser did not allow fullscreen; you can still present in this window.'; }
};
const syncFullscreen = () => { fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen ↙' : 'Fullscreen ↗'; };
document.addEventListener('fullscreenchange', syncFullscreen);
void prepare();
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; radar.disconnect(); player?.destroy(); document.removeEventListener('fullscreenchange', syncFullscreen);
});
