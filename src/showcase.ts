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
  { kicker: '01 / THE BIG PICTURE', title: ['把流程，', '讲成故事。'],
    description: '一张时序图，六个服务，数十次交互。听众应该先看哪里？让每一步都有自己的时刻。',
    action: '开始这段讲解 →', cue: '五个章节，带你认识一个可操作的技术演示。', target: '' },
  { kicker: '02 / ONE STEP AT A TIME', title: ['一次，', '只讲一步。'],
    description: '请求从哪里发起，经过哪个服务，现在走到哪一步。播放、暂停和回退，都跟着你的讲解节奏。',
    action: '讲解下一步 →', cue: '也可以使用下方 Play 自动播放，或用左右方向键逐步推进。', target: 'POST /orders + idempotency key' },
  { kicker: '03 / CHOOSE YOUR PATH', title: ['同一个流程，', '不同的故事。'],
    description: '第一次支付被拒绝，会怎样恢复？切换到另一条演示路径，只讲所选分支，全图的位置保持不变。',
    action: '切换到支付恢复路径 ↗', cue: '两个分支独立选择；切换后先回到总览，再由演示按钮定位关键消息。', target: 'Authorize payment for order #1042' },
  { kicker: '04 / KEEP THE CONTEXT', title: ['聚焦当下，', '保留上下文。'],
    description: '当事件抵达履约服务，突出这一步的消息和参与者。其他交互仍然可读，听众不会失去整条链路。',
    action: '对比 Focus 开 / 关', cue: '点一次对比完整上下文，再点一次回到聚焦状态。', target: 'Deliver OrderConfirmed · at least once' },
  { kicker: '05 / TAKE THE STORY WITH YOU', title: ['把讲解，', '一起带走。'],
    description: '把图、路径和播放器装进一个 HTML 文件。发给同事，直接打开；没有网络，也能继续播放、回退和选分支。',
    action: '下载这份离线演示 ↓', cue: '下载后直接打开 HTML；离线承诺针对导出文件，当前展示页首次加载需要静态资源。', target: 'Order update · shipped' },
];
let chapter = 0, disposed = false;
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
  title.replaceChildren(content.title[0], document.createElement('br'), emphasis);
  document.querySelector<HTMLElement>('[data-kicker]')!.textContent = content.kicker;
  document.querySelector<HTMLElement>('[data-description]')!.textContent = content.description;
  document.querySelector<HTMLElement>('[data-cue]')!.textContent = content.cue;
  if (player) action.textContent = content.action;
  for (const button of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
    if (Number(button.dataset.chapter) === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
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
    action.textContent = recovered ? chapters[2].action : '切回首次支付成功路径 ↗';
  } else if (chapter === 3) root.querySelector<HTMLButtonElement>('[data-action="focus"]')!.click();
  else {
    action.disabled = true;
    try {
      const html = exportHtml(compiled.svg, compiled.model, player.snapshot().choices, runtime, css);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'seqshow-checkout.html';
      try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (reason) { error.textContent = `导出失败，可以重试：${String(reason)}`; }
    finally { action.disabled = false; }
  }
}
action.onclick = demonstrate;

async function prepare() {
  if (root.dataset.state === 'busy' || disposed) return;
  root.dataset.state = 'busy'; root.setAttribute('aria-busy', 'true'); action.disabled = true;
  action.textContent = '正在准备演示…'; error.textContent = '';
  try {
    const model = parseSequence(checkoutSource);
    if (!model.ok) throw new Error(model.diagnostics[0].message);
    const svg = await renderSequence(model.document);
    if (disposed) return;
    const services = document.querySelector<HTMLElement>('[data-services]')!;
    services.replaceChildren(...model.document.participants.map((participant, index) => {
      const item = document.createElement('li');
      const number = document.createElement('span'); number.textContent = `0${index + 1}`;
      item.append(number, participant.label); return item;
    }));
    root.querySelector<HTMLElement>('[data-diagram]')!.replaceChildren(svg);
    player = mountPlayer(root, model.document); compiled = { model: model.document, svg };
    root.dataset.state = 'ready'; showChapter(chapter);
  } catch (reason) {
    if (disposed) return;
    root.dataset.state = 'error'; error.textContent = `演示暂未准备好，请重试：${String(reason)}`;
    action.textContent = '重新准备演示';
  } finally {
    if (!disposed) { root.setAttribute('aria-busy', 'false'); action.disabled = false; }
  }
}
if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
fullscreen.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { error.textContent = '浏览器未允许全屏；仍可直接在当前窗口展示。'; }
};
const syncFullscreen = () => { fullscreen.textContent = document.fullscreenElement ? '退出全屏 ↙' : '全屏展示 ↗'; };
document.addEventListener('fullscreenchange', syncFullscreen);
void prepare();
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; player?.destroy(); document.removeEventListener('fullscreenchange', syncFullscreen);
});
