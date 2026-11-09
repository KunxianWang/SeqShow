import type { MindmapNode } from '../core/mindmap';
import type { SequenceDocument } from '../core/model';
import { normalized, renderGraph } from './graph-svg';

export async function renderMindmap(nodes: MindmapNode[]) {
  const shapes = { rectangle: ['[', ']'], rounded: ['(', ')'], circle: ['((', '))'] };
  const source = ['mindmap', ...nodes.map(({ shape, label, depth }, index) => {
    const [open, close] = shapes[shape];
    return `${'  '.repeat(depth + 1)}seqNode${index}${open}${label}${close}`;
  })].join('\n');
  const svg = await renderGraph('mindmap', source);
  if (svg.querySelectorAll('g.mindmap-node').length !== nodes.length
    || svg.querySelectorAll('path[data-et="edge"]').length !== nodes.length - 1) throw new Error('Mindmap element count mismatch.');
  const model: SequenceDocument = {
    participants: nodes.map(({ label }, index) => ({ id: `topic:${index}`, label, kind: 'participant' })),
    nodes: nodes.map(({ label, shape, line, parent }, index) => {
      const matches = svg.querySelectorAll(`g.mindmap-node[id="${svg.id}-node_${index}"]`);
      const glyph = matches[0]?.firstElementChild;
      const caption = matches[0]?.querySelector('text');
      if (matches.length !== 1 || glyph?.localName !== (shape === 'circle' ? 'circle' : 'rect') || !caption
        || normalized(caption.textContent) !== normalized(label)) throw new Error(`Mindmap topic mismatch on line ${line}.`);
      // The SVG label coordinates are centered; Mermaid omits the anchor in
      // this diagram's plain-text output.
      caption.setAttribute('text-anchor', 'middle');
      const step = `step:${index + 1}`, participant = `topic:${index}`;
      matches[0].setAttribute('data-seq-participant', participant);
      matches[0].setAttribute('data-seq-step', step);
      glyph.setAttribute('data-seq-shape', step);
      glyph.setAttribute('data-graph-shape', '');
      if (parent !== undefined) {
        const edges = svg.querySelectorAll(`path[data-et="edge"][data-id="edge_${parent}_${index}"]`);
        if (edges.length !== 1) throw new Error(`Mindmap parent edge mismatch on line ${line}.`);
        edges[0].setAttribute('data-seq-step', step);
      }
      // Reuse the existing player projection for a single active item + text.
      return { kind: 'note', id: step, placement: 'over', participants: [participant], text: label, source: { line, column: 1 } };
    }),
  };
  return { svg, model };
}
