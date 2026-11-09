import './player.css';
import './styles.css';
import css from './player.css?raw';
import runtime from 'virtual:seqshow-export-player';
import { parseFlowchart } from './core/flowchart';
import { renderFlowchart } from './renderer/flowchart-adapter';
import { mountPlayer } from './player';
import { exportHtml } from './export';

const editor = document.querySelector<HTMLTextAreaElement>('#flow-source')!;
const root = document.querySelector<HTMLElement>('[data-player]')!;
const diagram = root.querySelector<HTMLElement>('[data-diagram]')!;
const notice = root.querySelector<HTMLElement>('[data-preview-state]')!;
const status = root.querySelector<HTMLElement>('[data-status]')!;
const render = document.querySelector<HTMLButtonElement>('[data-render]')!;
const download = root.querySelector<HTMLButtonElement>('[data-export]')!;
const error = document.querySelector<HTMLElement>('[data-error]')!;
const exportError = root.querySelector<HTMLElement>('[data-export-error]')!;
let current: (Awaited<ReturnType<typeof renderFlowchart>> & { player: ReturnType<typeof mountPlayer> }) | undefined;
let revision = 0;

function clearPreview(state: string, message: string) {
  current?.player.destroy(); current = undefined;
  diagram.replaceChildren(); download.disabled = true;
  error.textContent = ''; exportError.textContent = '';
  root.dataset.state = state; notice.textContent = message;
  status.textContent = 'No presentation yet.';
}

editor.oninput = () => { revision++; clearPreview('stale', 'Source changed. Render to update the preview.'); };

async function prepare() {
  if (render.disabled) return;
  const startedAt = revision;
  clearPreview('busy', 'Rendering flowchart…');
  const parsed = parseFlowchart(editor.value);
  if (!parsed.ok) {
    clearPreview('error', 'Check the source diagnostic.');
    error.textContent = `Line ${parsed.line}: ${parsed.message}`;
    return;
  }
  render.disabled = true;
  try {
    const result = await renderFlowchart(parsed.document);
    if (revision !== startedAt) return;
    diagram.append(result.svg);
    current = { ...result, player: mountPlayer(root, result.model) };
    root.dataset.state = 'ready'; notice.textContent = 'Ready to present. Press Play or Next.'; download.disabled = false;
  } catch (reason) {
    if (revision !== startedAt) return;
    clearPreview('error', 'Could not render this flowchart.');
    error.textContent = reason instanceof Error ? reason.message : String(reason);
  } finally { render.disabled = false; }
}

render.onclick = () => { void prepare(); };
download.onclick = () => {
  if (!current) return;
  exportError.textContent = '';
  try {
    const html = exportHtml(current.svg, current.model, {}, runtime, css);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'seqshow-flowchart.html';
    try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  } catch (reason) { exportError.textContent = `Export failed: ${String(reason)}`; }
};
void prepare();
