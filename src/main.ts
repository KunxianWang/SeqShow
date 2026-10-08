import './player.css';
import './styles.css';
import css from './player.css?raw';
import runtime from 'virtual:seqshow-export-player';
import { examples } from './examples';
import { INPUT_LIMITS, parseSequence, type Diagnostic } from './core/parser';
import type { SequenceDocument } from './core/model';
import { renderSequence } from './renderer/mermaid-adapter';
import { mountPlayer } from './player';
import { exportHtml } from './export';

const editor = document.querySelector<HTMLTextAreaElement>('[data-source]')!;
const render = document.querySelector<HTMLButtonElement>('[data-render]')!;
const example = document.querySelector<HTMLSelectElement>('[data-example]')!;
const replace = document.querySelector<HTMLDialogElement>('[data-replace]')!;
const error = document.querySelector<HTMLElement>('[data-error]')!;
const sourceState = document.querySelector<HTMLElement>('[data-source-state]')!;
const sourceChip = document.querySelector<HTMLElement>('[data-source-chip]')!;
const root = document.querySelector<HTMLElement>('[data-player]')!;
const notice = root.querySelector<HTMLElement>('[data-preview-state]')!;
const download = root.querySelector<HTMLButtonElement>('[data-export]')!;
const exportError = root.querySelector<HTMLElement>('[data-export-error]')!;
const diagram = root.querySelector<HTMLElement>('[data-diagram]')!;
const initialExample = examples.find(item => item.id === new URLSearchParams(location.search).get('example'))
  ?? examples.find(item => item.id === 'login')!;
let player: ReturnType<typeof mountPlayer> | undefined;
let successful: { source: string; model: SequenceDocument; svg: SVGSVGElement } | undefined;
let busy = false, stale = true, failed = false, exporting = false, disposed = false;
let revision = 0, baseline = initialExample.source, loadedExample = initialExample.id, pendingExample = '';

for (const item of examples) {
  const option = document.createElement('option');
  option.value = item.id; option.textContent = item.title; example.append(option);
}
editor.value = initialExample.source;
example.value = initialExample.id;

function update() {
  const state = busy ? 'busy' : failed ? 'error' : stale ? 'stale' : 'ready';
  root.dataset.state = state;
  root.setAttribute('aria-busy', String(busy));
  render.disabled = busy;
  render.textContent = busy ? !successful && revision === 0 ? 'Preparing example…' : 'Rendering…' : failed && !successful ? 'Retry' : 'Render';
  example.disabled = busy;
  download.disabled = !successful || stale || busy || exporting;
  download.textContent = exporting ? 'Exporting…' : 'Export HTML';
  download.setAttribute('aria-busy', String(exporting));
  player?.setEnabled(!stale && !busy, !busy);
  if (busy) notice.textContent = 'Rendering…';
  else if (failed) notice.textContent = successful ? 'Last successful render — the current source could not be rendered.' : 'Could not prepare this diagram. Fix the source or retry.';
  else if (stale) notice.textContent = successful ? 'Source changed — render to update. Last successful render shown for reference.' : 'Render your source to prepare a presentation.';
  else notice.textContent = 'Ready to present · choose a path, then press Play or Next.';
  sourceState.textContent = busy ? 'Preparing preview' : failed ? 'Check the diagnostic below' : stale ? 'Source changed' : 'Rendered';
  sourceChip.dataset.state = state;
  sourceChip.textContent = { busy: 'Rendering', error: 'Error', stale: 'Source changed', ready: 'Rendered' }[state];
  if (!successful) root.querySelector<HTMLElement>('[data-status]')!.textContent = busy ? 'Preparing diagram…' : 'No presentation yet.';
}

function changed() {
  revision++; stale = true; failed = false;
  error.replaceChildren(); exportError.textContent = '';
  update();
}
editor.addEventListener('input', changed);

function showDiagnostic(diagnostic: Diagnostic, source: string) {
  const link = document.createElement('button'); link.type = 'button';
  link.textContent = `Line ${diagnostic.line}, column ${diagnostic.column}: ${diagnostic.message}`;
  link.onclick = () => {
    const lines = source.split(/\r\n|\n|\r/u);
    // Textareas normalize line endings to LF; locations remain UTF-16 based.
    const offset = lines.slice(0, diagnostic.line - 1).reduce((total, line) => total + line.length + 1, 0) + diagnostic.column - 1;
    editor.focus(); editor.setSelectionRange(offset, Math.min(editor.value.length, offset + 1));
  };
  const statement = document.createElement('pre');
  statement.textContent = source.split(/\r\n|\n|\r/u)[diagnostic.line - 1] ?? '';
  const detectedCounts: Record<string, string> = {
    LIMIT_SOURCE: `${source.length.toLocaleString('en-US')} / ${INPUT_LIMITS.source.toLocaleString('en-US')} UTF-16 units`,
    LIMIT_PARTICIPANTS: `At least ${INPUT_LIMITS.participants + 1} participants; maximum ${INPUT_LIMITS.participants}.`,
    LIMIT_STEPS: `At least ${INPUT_LIMITS.steps + 1} messages / Notes; maximum ${INPUT_LIMITS.steps} across all paths.`,
    LIMIT_ALTERNATIVES: `At least ${INPUT_LIMITS.alternatives + 1} alt blocks; maximum ${INPUT_LIMITS.alternatives}.`,
  };
  const hint = document.createElement('p'); hint.textContent = diagnostic.hint ?? detectedCounts[diagnostic.code] ?? diagnostic.code;
  error.replaceChildren(link, statement, hint);
}

async function prepare() {
  if (busy || disposed) return;
  const source = editor.value, startedAt = revision;
  busy = true; failed = false; error.replaceChildren(); exportError.textContent = ''; update();
  try {
    const result = parseSequence(source);
    if (!result.ok) {
      stale = true; failed = true;
      showDiagnostic(result.diagnostics[0], source);
      return;
    }
    const svg = await renderSequence(result.document);
    if (disposed || revision !== startedAt) return;
    player?.destroy();
    diagram.replaceChildren(svg);
    player = mountPlayer(root, result.document);
    successful = { source, model: result.document, svg };
    baseline = source; stale = false;
  } catch (reason) {
    if (disposed || revision !== startedAt) return;
    stale = true; failed = true;
    error.textContent = `Could not prepare this diagram for playback: ${String(reason)}`;
  } finally {
    if (!disposed) { busy = false; update(); }
  }
}
render.onclick = () => { void prepare(); };

function loadExample(id: string) {
  const item = examples.find(item => item.id === id)!;
  editor.value = item.source; baseline = item.source; loadedExample = id; example.value = id;
  changed(); void prepare();
}
function cancelReplacement() { example.value = loadedExample; pendingExample = ''; }
example.onchange = () => {
  if (editor.value.trim() && editor.value !== baseline) {
    pendingExample = example.value; replace.showModal();
  } else loadExample(example.value);
};
replace.oncancel = cancelReplacement;
document.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => { cancelReplacement(); replace.close(); };
document.querySelector<HTMLButtonElement>('[data-confirm]')!.onclick = () => {
  const id = pendingExample; pendingExample = ''; replace.close(); loadExample(id);
};

download.onclick = () => {
  if (!successful || stale || busy || exporting) return;
  exporting = true; update();
  try {
    const html = exportHtml(successful.svg, successful.model, player!.snapshot().choices, runtime, css);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'seqshow-presentation.html';
    try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    exportError.textContent = '';
  } catch (reason) { exportError.textContent = `Export failed: ${String(reason)}`; }
  finally { exporting = false; update(); }
};

void prepare();
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; player?.destroy(); editor.removeEventListener('input', changed);
});
