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
import { sequenceBlocks, MAX_FILE_BYTES, type SourceBlock } from './source-input';

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
const draftState = document.querySelector<HTMLElement>('[data-draft-state]')!;
const inputState = document.querySelector<HTMLElement>('[data-input-state]')!;
const fileInput = document.querySelector<HTMLInputElement>('[data-source-file]')!;
const markdownDialog = document.querySelector<HTMLDialogElement>('[data-markdown]')!;
const blockSelect = document.querySelector<HTMLSelectElement>('[data-markdown-block]')!;
const blockPreview = document.querySelector<HTMLElement>('[data-markdown-preview]')!;
const draftKey = 'seqshow:source-draft';
let draftTimer: ReturnType<typeof setTimeout> | undefined;
let draftDirty = false;
let pendingSource: (() => void) | undefined;
let blocks: SourceBlock[] = [];
let sourceLineOffset = 0;
let restoredSource: string | undefined;
draftState.textContent = 'No local draft yet. Edits are saved in this browser when storage is available.';
try { restoredSource = localStorage.getItem(draftKey) ?? undefined; }
catch { draftState.textContent = 'Local storage is unavailable. Use Save source to keep your work.'; }
if (restoredSource !== undefined && restoredSource.length > INPUT_LIMITS.source) {
  draftState.textContent = 'The stored draft exceeds the source limit and was not loaded. You can clear the saved draft.';
  restoredSource = undefined;
}

for (const item of examples) {
  const option = document.createElement('option');
  option.value = item.id; option.textContent = item.title; example.append(option);
}
editor.value = initialExample.source;
example.value = initialExample.id;
if (restoredSource !== undefined && restoredSource.length <= INPUT_LIMITS.source) {
  if (!new URLSearchParams(location.search).has('example')) {
    editor.value = restoredSource; baseline = restoredSource; example.value = '';
    draftState.textContent = 'Restored the draft saved in this browser. Save source for a file backup.';
  } else {
    draftState.textContent = 'An earlier draft is available. Restore it or discard it before saving this example automatically.';
    const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restore earlier draft';
    restore.onclick = () => { const source = restoredSource!; pendingSource = () => { restoredSource = undefined; restore.remove(); applySource(source); }; replace.showModal(); };
    draftState.after(restore);
  }
}
if (!new URLSearchParams(location.search).has('example')) restoredSource = undefined;

function saveDraft() {
  clearTimeout(draftTimer);
  if (!draftDirty || restoredSource !== undefined) return;
  if (editor.value.length > INPUT_LIMITS.source) { draftState.textContent = 'Draft is too large for automatic storage. Use Save source.'; return; }
  try {
    if (editor.value) localStorage.setItem(draftKey, editor.value); else localStorage.removeItem(draftKey);
    draftDirty = false;
    draftState.textContent = editor.value ? 'Draft saved in this browser. Save source for a file backup.' : 'No saved draft.';
  } catch { draftState.textContent = 'Could not save the local draft. Use Save source to keep your work.'; }
}
document.querySelector<HTMLButtonElement>('[data-clear-draft]')!.onclick = () => {
  clearTimeout(draftTimer);
  try {
    localStorage.removeItem(draftKey); restoredSource = undefined; draftDirty = false;
    document.querySelector('.draft-tools button:not([data-clear-draft])')?.remove();
    draftState.textContent = 'Saved draft cleared. The source in the editor is unchanged.';
  } catch { draftState.textContent = 'Could not clear local storage. Browser storage settings may block access.'; }
};
window.addEventListener('pagehide', saveDraft);

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
  draftDirty = true;
  sourceLineOffset = 0;
  error.replaceChildren(); exportError.textContent = '';
  clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 300);
  update();
}
editor.addEventListener('input', changed);

function showDiagnostic(diagnostic: Diagnostic, source: string) {
  const card = document.createElement('div');
  const link = document.createElement('button'); link.type = 'button';
  link.textContent = `Line ${diagnostic.line}, column ${diagnostic.column}${sourceLineOffset ? ` (Markdown line ${diagnostic.line + sourceLineOffset})` : ''}: ${diagnostic.message}`;
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
  card.append(link, statement, hint); error.append(card);
}

async function prepare() {
  if (busy || disposed) return;
  const source = editor.value, startedAt = revision;
  busy = true; failed = false; error.replaceChildren(); exportError.textContent = ''; update();
  try {
    const result = parseSequence(source);
    if (!result.ok) {
      stale = true; failed = true;
      for (const diagnostic of result.diagnostics) showDiagnostic(diagnostic, source);
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
function applySource(source: string, offset = 0) {
  editor.value = source; loadedExample = ''; example.value = '';
  changed(); sourceLineOffset = offset; saveDraft(); void prepare();
}
function cancelReplacement() { example.value = loadedExample; pendingExample = ''; pendingSource = undefined; }
function offerSource(source: string, offset = 0) {
  if (editor.value.trim() && editor.value !== baseline) {
    pendingSource = () => applySource(source, offset); replace.showModal();
  } else applySource(source, offset);
}
example.onchange = () => {
  if (editor.value.trim() && editor.value !== baseline) {
    pendingExample = example.value; replace.showModal();
  } else loadExample(example.value);
};
replace.oncancel = cancelReplacement;
document.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => { cancelReplacement(); replace.close(); };
document.querySelector<HTMLButtonElement>('[data-confirm]')!.onclick = () => {
  if (pendingSource) { const accept = pendingSource; pendingSource = undefined; replace.close(); accept(); return; }
  const id = pendingExample; pendingExample = ''; replace.close(); loadExample(id);
};

function showBlocks(text: string) {
  try {
    blocks = sequenceBlocks(text);
    if (!blocks.length) { inputState.textContent = 'No fenced Mermaid sequenceDiagram was found. Paste sequence source or choose another document.'; return; }
    blockSelect.replaceChildren();
    blocks.forEach((block, index) => {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `Diagram ${index + 1} · Markdown line ${block.line}`; blockSelect.append(option);
    });
    if (blocks.length > 1) {
      const choose = document.createElement('option'); choose.value = ''; choose.textContent = 'Choose a diagram'; choose.disabled = true; blockSelect.prepend(choose); blockSelect.value = '';
    }
    previewBlock(); markdownDialog.showModal();
  } catch (reason) { inputState.textContent = String(reason); }
}
function previewBlock() {
  const selected = blockSelect.value === '' ? undefined : blocks[Number(blockSelect.value)];
  blockPreview.textContent = selected?.source ?? 'Choose a diagram to preview its source.';
  document.querySelector<HTMLButtonElement>('[data-markdown-confirm]')!.disabled = !selected;
}
blockSelect.onchange = previewBlock;
document.querySelector<HTMLButtonElement>('[data-markdown-cancel]')!.onclick = () => markdownDialog.close();
document.querySelector<HTMLButtonElement>('[data-markdown-confirm]')!.onclick = () => {
  const block = blocks[Number(blockSelect.value)]; markdownDialog.close();
  if (block.source.length > INPUT_LIMITS.source) { inputState.textContent = 'This diagram exceeds 50,000 UTF-16 units. The current source was kept.'; return; }
  offerSource(block.source, block.line - 1);
};
editor.addEventListener('paste', event => {
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (/^ {0,3}(?:`{3,}|~{3,})/mu.test(text)) { event.preventDefault(); inputState.textContent = ''; showBlocks(text); }
});
async function openFile(file: File) {
  const startedAt = revision;
  inputState.textContent = '';
  if (!/\.(?:mmd|mermaid|txt)$/iu.test(file.name) || file.size > MAX_FILE_BYTES) {
    inputState.textContent = 'Choose a .mmd, .mermaid or .txt source file up to 200,000 bytes. The current source was kept.'; return;
  }
  try {
    const source = (await file.text()).replace(/^\uFEFF/u, '');
    if (disposed || revision !== startedAt) { inputState.textContent = 'The editor changed while reading. Open the file again to replace it.'; return; }
    if (source.length > INPUT_LIMITS.source) { inputState.textContent = 'Source exceeds 50,000 UTF-16 units. The current source was kept.'; return; }
    offerSource(source);
  } catch (reason) { inputState.textContent = `Could not read this file: ${String(reason)}`; }
}
document.querySelector<HTMLButtonElement>('[data-open-source]')!.onclick = () => { fileInput.value = ''; fileInput.click(); };
fileInput.onchange = () => { if (fileInput.files?.[0]) void openFile(fileInput.files[0]); };
const editorPanel = editor.closest<HTMLElement>('.editor-panel')!;
editorPanel.addEventListener('dragover', event => {
  if (event.dataTransfer?.types.some(type => ['Files', 'text/uri-list', 'text/html'].includes(type))) event.preventDefault();
});
editorPanel.addEventListener('drop', event => {
  if (!event.dataTransfer?.files.length) {
    if (event.dataTransfer?.types.some(type => ['text/uri-list', 'text/html'].includes(type))) {
      event.preventDefault(); inputState.textContent = 'Drop a Mermaid source file here. Links and HTML are not opened.';
    }
    return;
  }
  event.preventDefault();
  if (event.dataTransfer.files.length !== 1) { inputState.textContent = 'Open one source file at a time.'; return; }
  void openFile(event.dataTransfer.files[0]);
});
document.querySelector<HTMLButtonElement>('[data-save-source]')!.onclick = () => {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'seqshow-source.mmd'; link.click();
    inputState.textContent = 'Source downloaded. Reopen this .mmd to continue editing; HTML export is for playback.';
  } catch (reason) { inputState.textContent = `Could not save source: ${String(reason)}`; }
  finally { if (url) { const savedUrl = url; setTimeout(() => URL.revokeObjectURL(savedUrl), 1000); } }
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
  clearTimeout(draftTimer); window.removeEventListener('pagehide', saveDraft);
  disposed = true; player?.destroy(); editor.removeEventListener('input', changed);
});
