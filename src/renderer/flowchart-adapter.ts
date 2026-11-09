import type { FlowchartDocument } from '../core/flowchart';
import type { Message, SequenceDocument } from '../core/model';
import { graphEdge, normalized, renderGraph } from './graph-svg';

const nodeId = (index: number) => `seqNode${index + 1}`;
const edgeId = (index: number) => `seqEdge${index + 1}`;

export async function renderFlowchart(document: FlowchartDocument) {
  const ids = new Map(document.nodes.map((node, index) => [node.id, nodeId(index)]));
  const shapes = { rectangle: ['[', ']'], rounded: ['(', ')'], decision: ['{', '}'] };
  const source = [
    `flowchart ${document.direction}`,
    ...document.nodes.map(node => {
      const [open, close] = shapes[node.shape];
      return `${ids.get(node.id)}${open}"${node.label}"${close}`;
    }),
    ...document.edges.map(({ from, to, label, dotted }, index) => `${ids.get(from)} ${edgeId(index)}@${dotted ? '-.->' : '-->'}${label ? `|"${label}"|` : ''} ${ids.get(to)}`),
  ].join('\n');
  const svg = await renderGraph('flowchart', source);

  // Mermaid 12.1's flowchart binding stays here. The shared player sees only
  // SeqShow marks, including one unique step for every parallel or cycle edge.
  if (svg.querySelectorAll('g.node').length !== document.nodes.length
    || svg.querySelectorAll('path[data-et="edge"]').length !== document.edges.length) throw new Error('Flowchart element count mismatch.');
  for (const node of document.nodes) {
    const matches = svg.querySelectorAll(`g.node[id^="${svg.id}-flowchart-${ids.get(node.id)}-"]`);
    const shape = matches[0]?.querySelector('.label-container');
    if (matches.length !== 1 || !shape || normalized(matches[0].querySelector('text')?.textContent) !== normalized(node.label)) {
      throw new Error(`Flowchart node mismatch: ${node.id}.`);
    }
    matches[0].setAttribute('data-seq-participant', node.id);
    shape.setAttribute('data-graph-shape', '');
  }
  const labels = new Map(document.nodes.map(node => [node.id, node.label]));
  const numbered = document.edges.some(edge => edge.step !== undefined);
  const model: SequenceDocument = {
    participants: document.nodes.map(({ id, label }) => ({ id, label, kind: 'participant' })),
    nodes: document.edges.flatMap(({ from, to, label, line, dotted, step: order }, index) => {
      const { edge, caption } = graphEdge(svg, edgeId(index), label, line);
      if (edge.classList.contains('edge-pattern-dotted') !== Boolean(dotted)) throw new Error(`Flowchart line style mismatch on line ${line}.`);
      if (numbered && order === undefined) return [];
      const step = `step:${index + 1}`;
      edge.setAttribute('data-seq-step', step);
      edge.setAttribute('data-seq-shape', step);
      caption?.setAttribute('data-seq-step', step);
      const message: Message = { kind: 'message', id: step, from, to, arrow: dotted ? 'dashed' : 'solid', text: label || `${labels.get(from)} → ${labels.get(to)}`,
        source: { line, column: 1 } };
      return [{ order: order ?? index + 1, message }];
    }).sort((a, b) => a.order - b.order).map(({ message }) => message),
  };
  svg.toggleAttribute('data-flowchart-ordered', numbered);
  return { svg, model };
}
