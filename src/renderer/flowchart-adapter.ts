import mermaid from 'mermaid';
import type { FlowchartDocument } from '../core/flowchart';
import type { SequenceDocument } from '../core/model';
import { assertSafeSvg } from './svg-safety';

let nextRenderId = 0;
const nodeId = (index: number) => `seqNode${index + 1}`;
const edgeId = (index: number) => `seqEdge${index + 1}`;
const normalized = (text: string | null | undefined) => text?.replace(/\s+/gu, '');

export async function renderFlowchart(document: FlowchartDocument) {
  const id = `seqshow_flow_${++nextRenderId}`;
  const ids = new Map(document.nodes.map((node, index) => [node.id, nodeId(index)]));
  const shapes = { rectangle: ['[', ']'], rounded: ['(', ')'], decision: ['{', '}'] };
  const source = [
    `flowchart ${document.direction}`,
    ...document.nodes.map(node => {
      const [open, close] = shapes[node.shape];
      return `${ids.get(node.id)}${open}"${node.label}"${close}`;
    }),
    ...document.edges.map(({ from, to, label }, index) => `${ids.get(from)} ${edgeId(index)}@-->${label ? `|"${label}"|` : ''} ${ids.get(to)}`),
  ].join('\n');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'classic',
    htmlLabels: false, fontFamily: 'Arial, sans-serif', flowchart: { htmlLabels: false, padding: 12 },
    themeVariables: { useGradient: false, primaryColor: '#eff6ff', primaryTextColor: '#0f172a', primaryBorderColor: '#94a3b8', lineColor: '#475569' },
  });
  const { svg: markup } = await mermaid.render(id, source);
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('Invalid flowchart SVG.');
  const svg = window.document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  // Classic flowcharts emit two unused Neo filter definitions. Discard only
  // those known definitions; SVG validation still rejects any remaining refs.
  svg.querySelectorAll('defs > filter').forEach(filter => {
    if (filter.id === id + '-drop-shadow' || filter.id === id + '-drop-shadow-small') filter.remove();
  });
  assertSafeSvg(svg);

  // Mermaid 12.1's flowchart binding stays here. The shared player sees only
  // SeqShow marks, including one unique step for every parallel or cycle edge.
  if (svg.querySelectorAll('g.node').length !== document.nodes.length
    || svg.querySelectorAll('path[data-et="edge"]').length !== document.edges.length) throw new Error('Flowchart element count mismatch.');
  for (const node of document.nodes) {
    const matches = svg.querySelectorAll(`g.node[id^="${id}-flowchart-${ids.get(node.id)}-"]`);
    const shape = matches[0]?.querySelector('.label-container');
    if (matches.length !== 1 || !shape || normalized(matches[0].querySelector('text')?.textContent) !== normalized(node.label)) {
      throw new Error(`Flowchart node mismatch: ${node.id}.`);
    }
    matches[0].setAttribute('data-seq-participant', node.id);
    shape.setAttribute('data-flow-shape', '');
  }
  const labels = new Map(document.nodes.map(node => [node.id, node.label]));
  const model: SequenceDocument = {
    participants: document.nodes.map(({ id, label }) => ({ id, label, kind: 'participant' })),
    nodes: document.edges.map(({ from, to, label, line }, index) => {
      const edges = svg.querySelectorAll(`path[data-et="edge"][data-id="${edgeId(index)}"]`);
      const captions = svg.querySelectorAll(`g.edgeLabel g[data-id="${edgeId(index)}"]`);
      if (edges.length !== 1 || !edges[0].hasAttribute('marker-end') || captions.length !== Number(Boolean(label))
        || normalized(captions[0]?.textContent ?? '') !== normalized(label)) throw new Error(`Flowchart edge mismatch on line ${line}.`);
      const step = `step:${index + 1}`;
      edges[0].setAttribute('data-seq-step', step);
      edges[0].setAttribute('data-seq-shape', step);
      captions[0]?.setAttribute('data-seq-step', step);
      return { kind: 'message', id: step, from, to, arrow: 'solid', text: label || `${labels.get(from)} → ${labels.get(to)}`,
        source: { line, column: 1 } };
    }),
  };
  svg.setAttribute('data-flowchart', '');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Flowchart');
  return { svg, model };
}
