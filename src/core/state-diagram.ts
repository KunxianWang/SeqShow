import { GRAPH_LIMITS, plainLabel, type DiagramResult } from './diagram-input';

export type StateDiagram = {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  states: { id: string; label: string; marker?: 'start' | 'end' }[];
  transitions: { from: string; to: string; label: string; line: number }[];
};
const transition = /^(\[\*\]|[A-Za-z_]\w*)[ \t]*-->[ \t]*(\[\*\]|[A-Za-z_]\w*)(?:[ \t]*:[ \t]*(.*))?$/u;
const alias = /^state[ \t]+"([^"]*)"[ \t]+as[ \t]+([A-Za-z_]\w*)$/u;
const description = /^([A-Za-z_]\w*)[ \t]*:[ \t]*(.*)$/u;
// Mermaid statements that share the `id: text` shape must not become states.
const keyword = /^(?:accTitle|accDescr|state|note|direction|classDef|class|style|click|hide|scale)$/u;

export function parseStateDiagram(source: string): DiagramResult<StateDiagram> {
  const fail = (line: number, message: string) => ({ ok: false as const, line, message });
  if (source.length > GRAPH_LIMITS.source) return fail(1, 'State diagram source exceeds 20,000 characters.');
  let header = false, direction: StateDiagram['direction'] | undefined;
  const states = new Map<string, string | undefined>();
  const transitions: StateDiagram['transitions'] = [];
  for (const [offset, raw] of source.split(/\r\n|\n|\r/u).entries()) {
    const line = offset + 1, text = raw.trim();
    if (text.startsWith('%%{')) return fail(line, 'Mermaid configuration directives are not supported.');
    if (!text || text.startsWith('%%')) continue;
    if (!header) {
      if (!/^stateDiagram(?:-v2)?$/u.test(text)) return fail(line, 'Start with stateDiagram-v2.');
      header = true; continue;
    }
    const orientation = /^direction[ \t]+(TB|BT|LR|RL)$/u.exec(text);
    if (orientation) {
      if (direction) return fail(line, 'Set direction only once.');
      direction = orientation[1] as StateDiagram['direction']; continue;
    }
    const edge = transition.exec(text);
    const named = alias.exec(text), described = description.exec(text);
    const declared = /^state[ \t]+([A-Za-z_]\w*)$/u.exec(text);
    if (described && keyword.test(described[1])) {
      return fail(line, /^acc/u.test(described[1]) ? 'Accessibility titles and descriptions are not supported.'
        : `${described[1]} is a Mermaid keyword and cannot be used as a state description.`);
    }
    if (edge) {
      const [, sender, receiver, value] = edge;
      if (sender === '[*]' && receiver === '[*]') return fail(line, 'Connect a start or end marker to a named state.');
      const label = value === undefined ? '' : plainLabel(value);
      if (label === undefined) return fail(line, 'Use a plain transition label of 1–120 characters.');
      const from = sender === '[*]' ? '@start' : sender, to = receiver === '[*]' ? '@end' : receiver;
      for (const id of [from, to]) if (!states.has(id)) states.set(id, undefined);
      transitions.push({ from, to, label, line });
      if (transitions.length > GRAPH_LIMITS.edges) return fail(line, 'State diagrams are limited to 60 transitions.');
    } else if (named || described || declared) {
      const id = named?.[2] ?? described?.[1] ?? declared![1];
      const value = named?.[1] ?? described?.[2];
      const label = value === undefined ? undefined : plainLabel(value);
      if (value !== undefined && !label) return fail(line, 'Use a plain state label of 1–120 characters.');
      if (label && states.get(id) && states.get(id) !== label) return fail(line, 'A state cannot have conflicting labels.');
      if (label || !states.has(id)) states.set(id, label);
    } else return fail(line, 'Use a state declaration or one transition per line. Composite states, notes and styling are not supported.');
    if (states.size > GRAPH_LIMITS.nodes) return fail(line, 'State diagrams are limited to 30 states, including start and end.');
    if ([...states.keys()].some(id => id.length > GRAPH_LIMITS.label)) return fail(line, 'State IDs are limited to 120 characters.');
  }
  if (!transitions.length) return fail(1, 'Add at least one state transition.');
  return { ok: true, document: {
    direction: direction ?? 'TB', transitions,
    states: Array.from(states, ([id, label]) => id === '@start' ? { id, label: 'Start', marker: 'start' }
      : id === '@end' ? { id, label: 'End', marker: 'end' } : { id, label: label ?? id }),
  } };
}
