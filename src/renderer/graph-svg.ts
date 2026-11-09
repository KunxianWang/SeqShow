import mermaid from 'mermaid';
import { assertSafeSvg } from './svg-safety';

const names = { flowchart: 'Flowchart', mindmap: 'Mindmap', state: 'State diagram' };
let nextRenderId = 0;
export const normalized = (text: string | null | undefined) => text?.replace(/\s+/gu, '');

/** Render only the controlled source emitted by a graph adapter. */
export async function renderGraph(kind: keyof typeof names, source: string) {
  const id = `seqshow_graph_${++nextRenderId}`;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'classic',
    htmlLabels: false, fontFamily: 'Arial, sans-serif', flowchart: { htmlLabels: false, padding: 12 },
    themeVariables: { useGradient: false, primaryColor: '#eff6ff', primaryTextColor: '#0f172a', primaryBorderColor: '#94a3b8', lineColor: '#475569' },
  });
  const { svg: markup } = await mermaid.render(id, source);
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error(`Invalid ${names[kind]} SVG.`);
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  // Classic graph output carries two unused Neo filter definitions. Other
  // elements or references still have to pass the unchanged SVG allowlist.
  svg.querySelectorAll('defs > filter').forEach(filter => {
    if (filter.id === id + '-drop-shadow' || filter.id === id + '-drop-shadow-small') filter.remove();
  });
  assertSafeSvg(svg);
  svg.dataset.diagramKind = kind;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', names[kind]);
  return svg;
}

export function graphEdge(svg: SVGSVGElement, id: string, label: string, line: number) {
  const edges = svg.querySelectorAll(`path[data-et="edge"][data-id="${id}"]`);
  const captions = svg.querySelectorAll(`g.edgeLabel g[data-id="${id}"]`);
  if (edges.length !== 1 || !edges[0].hasAttribute('marker-end') || captions.length !== Number(Boolean(label))
    || normalized(captions[0]?.textContent ?? '') !== normalized(label)) throw new Error(`Edge mismatch on line ${line}.`);
  return { edge: edges[0], caption: captions[0] };
}
