import type { SequenceDocument } from '../core/model';
import type { StateDiagram } from '../core/state-diagram';
import { graphEdge, normalized, renderGraph } from './graph-svg';

export async function renderStateDiagram(document: StateDiagram) {
  const ids = new Map(document.states.map(({ id, marker }, index) => [id, marker ? '[*]' : `seqState${index}`]));
  const source = [
    'stateDiagram-v2', `direction ${document.direction}`,
    ...document.states.filter(state => !state.marker).map(({ id, label }) => `state "${label}" as ${ids.get(id)}`),
    ...document.transitions.map(({ from, to, label }) => `${ids.get(from)} --> ${ids.get(to)}${label ? ': ' + label : ''}`),
  ].join('\n');
  const svg = await renderGraph('state', source);
  // Keep native label size on narrow screens; the preview scrolls internally.
  svg.style.minWidth = `${Math.max(360, svg.viewBox.baseVal.width)}px`;
  if (svg.querySelectorAll('g.node').length !== document.states.length
    || svg.querySelectorAll('path[data-et="edge"]').length !== document.transitions.length) throw new Error('State diagram element count mismatch.');
  for (const { id, label, marker } of document.states) {
    const rendered = marker ? `root_${marker}` : ids.get(id);
    const matches = svg.querySelectorAll(`g.node[id^="${svg.id}-state-${rendered}-"]`);
    const glyph = matches[0]?.querySelector(marker === 'end' ? '.outer-path path' : marker === 'start' ? 'circle' : 'rect');
    if (matches.length !== 1 || !glyph || normalized(matches[0].textContent) !== normalized(marker ? '' : label)) {
      throw new Error(`State mismatch: ${label}.`);
    }
    matches[0].setAttribute('data-seq-participant', id);
    glyph.setAttribute('data-graph-shape', '');
  }
  const labels = new Map(document.states.map(({ id, label }) => [id, label]));
  const model: SequenceDocument = {
    participants: document.states.map(({ id, label }) => ({ id, label, kind: 'participant' })),
    nodes: document.transitions.map(({ from, to, label, line }, index) => {
      const { edge, caption } = graphEdge(svg, `edge${index}`, label, line);
      const step = `step:${index + 1}`;
      edge.setAttribute('data-seq-step', step);
      edge.setAttribute('data-seq-shape', step);
      caption?.setAttribute('data-seq-step', step);
      return { kind: 'message', id: step, from, to, arrow: 'solid', text: label || `${labels.get(from)} → ${labels.get(to)}`,
        source: { line, column: 1 } };
    }),
  };
  return { svg, model };
}
