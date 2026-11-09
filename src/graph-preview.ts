import './player.css';
import './styles.css';
import css from './player.css?raw';
import runtime from 'virtual:seqshow-export-player';
import { parseFlowchart } from './core/flowchart';
import { parseMindmap } from './core/mindmap';
import { parseStateDiagram } from './core/state-diagram';
import type { DiagramResult } from './core/diagram-input';
import type { SequenceDocument } from './core/model';
import { renderFlowchart } from './renderer/flowchart-adapter';
import { renderMindmap } from './renderer/mindmap-adapter';
import { renderStateDiagram } from './renderer/state-adapter';
import { mountPlayer } from './player';
import { exportHtml } from './export';

const editor = document.querySelector<HTMLTextAreaElement>('[data-graph-source]')!;
const pageKind = document.body.dataset.graphPreview;
const kind = pageKind === 'mindmap' || pageKind === 'state' ? pageKind : 'flowchart';
const name = { flowchart: 'flowchart', mindmap: 'mindmap', state: 'state diagram' }[kind];
const root = document.querySelector<HTMLElement>('[data-player]')!;
const diagram = root.querySelector<HTMLElement>('[data-diagram]')!;
const notice = root.querySelector<HTMLElement>('[data-preview-state]')!;
const status = root.querySelector<HTMLElement>('[data-status]')!;
const render = document.querySelector<HTMLButtonElement>('[data-render]')!;
const download = root.querySelector<HTMLButtonElement>('[data-export]')!;
const error = document.querySelector<HTMLElement>('[data-error]')!;
const exportError = root.querySelector<HTMLElement>('[data-export-error]')!;
type Rendered = { svg: SVGSVGElement; model: SequenceDocument };
let current: (Rendered & { player: ReturnType<typeof mountPlayer> }) | undefined;
let revision = 0;

async function compile<T>(source: string, parse: (source: string) => DiagramResult<T>, layout: (model: T) => Promise<Rendered>) {
  const result = parse(source);
  if (!result.ok) throw new Error(`Line ${result.line}: ${result.message}`);
  return layout(result.document);
}
const renderInput = {
  flowchart: (source: string) => compile(source, parseFlowchart, renderFlowchart),
  mindmap: (source: string) => compile(source, parseMindmap, renderMindmap),
  state: (source: string) => compile(source, parseStateDiagram, renderStateDiagram),
}[kind];

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
  clearPreview('busy', `Rendering ${name}…`);
  render.disabled = true;
  try {
    const result = await renderInput(editor.value);
    if (revision !== startedAt) return;
    diagram.append(result.svg);
    current = { ...result, player: mountPlayer(root, result.model) };
    root.dataset.state = 'ready'; notice.textContent = 'Ready to present. Press Play or Next.'; download.disabled = false;
  } catch (reason) {
    if (revision !== startedAt) return;
    clearPreview('error', `Could not render this ${name}.`);
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
    const link = document.createElement('a'); link.href = url; link.download = `seqshow-${kind}.html`;
    try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  } catch (reason) { exportError.textContent = `Export failed: ${String(reason)}`; }
};
void prepare();
