export const FLOW_LIMITS = { source: 20_000, nodes: 30, edges: 60, label: 120 } as const;

type Shape = 'rectangle' | 'rounded' | 'decision';
type NodeLabel = { label: string; shape: Shape };
export type FlowchartDocument = {
  direction: 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
  nodes: (NodeLabel & { id: string })[];
  edges: { from: string; to: string; label: string; line: number; dotted?: true; step?: number }[];
};
type Result = { ok: true; document: FlowchartDocument } | { ok: false; line: number; message: string };

const node = /^([A-Za-z_]\w*)(?:[ \t]*(?:\[([^[\]]*)\]|\(([^()]*)\)|\{([^{}]*)\}))?$/u;
const edge = /^(.+?)(?:[ \t]+([A-Za-z_]\w*)@)?(-->|-\.->)[ \t]*(?:\|([^|]*)\|[ \t]*)?(.+)$/u;
const stepDirective = /^([A-Za-z_]\w*)[ \t]*@\{[ \t]*step[ \t]*:[ \t]*([1-9]\d*)[ \t]*\}$/u;
const reserved = /^(?:subgraph|end|direction|click|class|classDef|style|linkStyle|accTitle|accDescr)(?=[ \t:]|$)/u;
const labelText = (value: string) => {
  const label = value.trim().replace(/^"([^"]*)"$/u, '$1').trim();
  // These characters delimit Mermaid syntax or invoke entity/HTML/math handling.
  return label && label.length <= FLOW_LIMITS.label && !/[\p{Cc}"<>\x60#&;\\|$]/u.test(label) ? label : undefined;
};
const error = (line: number, message: string): Result => ({ ok: false, line, message });

/** A bounded Flowchart subset. Original source is never passed to Mermaid. */
export function parseFlowchart(source: string): Result {
  if (source.length > FLOW_LIMITS.source) return error(1, 'Flowchart source exceeds 20,000 characters.');
  const nodes = new Map<string, NodeLabel | undefined>();
  const edges: FlowchartDocument['edges'] = [];
  const edgeIds = new Map<string, FlowchartDocument['edges'][number]>();
  const numbered = new Map<string, { step: number; line: number }>();
  const steps = new Set<number>();
  let direction: FlowchartDocument['direction'] | undefined;
  for (const [index, raw] of source.split(/\r\n|\n|\r/u).entries()) {
    const line = raw.trim();
    const number = index + 1;
    if (line.startsWith('%%{')) return error(number, 'Mermaid configuration directives are not supported.');
    if (!line || line.startsWith('%%')) continue;
    if (!direction) {
      const header = /^(?:flowchart|graph)[ \t]+(TD|TB|BT|LR|RL)$/u.exec(line);
      if (!header) return error(number, 'Start with flowchart TD, TB, BT, LR, or RL.');
      direction = header[1] as FlowchartDocument['direction'];
      continue;
    }
    if (reserved.test(line)) return error(number, 'Styles, links, subgraphs, and other directives are not supported.');
    const directive = stepDirective.exec(line);
    if (directive) {
      const [, id, value] = directive;
      const step = Number(value);
      if (step > FLOW_LIMITS.edges) return error(number, 'Step numbers must be between 1 and 60.');
      if (numbered.has(id) || steps.has(step)) return error(number, 'Each numbered edge needs its own ID and step number.');
      numbered.set(id, { step, line: number }); steps.add(step);
      continue;
    }
    if (/^\w+[ \t]*@\{/u.test(line)) return error(number, 'Use only edgeId@{ step: N } with a positive whole number.');
    const connection = edge.exec(line);
    const endpoints = (connection ? [connection[1], connection[5]] : [line]).map(value => node.exec(value.trim()));
    for (const endpoint of endpoints) {
      if (!endpoint) return error(number, 'Use a node or one directed edge (-->, -.->) per line.');
      const [, id, rectangle, rounded, decision] = endpoint;
      if (id.length > FLOW_LIMITS.label) return error(number, 'Node IDs are limited to 120 characters.');
      const value = rectangle ?? rounded ?? decision;
      if (value !== undefined) {
        if (/^[([{/\\]/u.test(value.trimStart())) return error(number, 'Unsupported node shape. Quote labels that start with shape punctuation.');
        const label = labelText(value);
        if (!label) return error(number, 'Use a plain label of 1–120 characters without markup or Mermaid delimiters.');
        const shape = rounded !== undefined ? 'rounded' : decision !== undefined ? 'decision' : 'rectangle';
        const previous = nodes.get(id);
        if (previous && (previous.label !== label || previous.shape !== shape)) return error(number, 'A node cannot have conflicting labels or shapes.');
        nodes.set(id, { label, shape });
      } else if (!nodes.has(id)) nodes.set(id, undefined);
      if (nodes.size > FLOW_LIMITS.nodes) return error(number, 'Flowcharts are limited to 30 nodes.');
    }
    if (connection) {
      const [, , id, arrow, value] = connection;
      const label = value === undefined ? '' : labelText(value);
      if (label === undefined) return error(number, 'Use a plain edge label of 1–120 characters without markup or Mermaid delimiters.');
      const item: FlowchartDocument['edges'][number] = {
        from: endpoints[0]![1], to: endpoints[1]![1], label, line: number, ...(arrow === '-.->' ? { dotted: true } : {}),
      };
      if (id) {
        if (id.length > FLOW_LIMITS.label || edgeIds.has(id)) return error(number, 'Use a unique edge ID of at most 120 characters.');
        edgeIds.set(id, item);
      }
      edges.push(item);
      if (edges.length > FLOW_LIMITS.edges) return error(number, 'Flowcharts are limited to 60 edges.');
    }
  }
  for (const [id, { step, line }] of numbered) {
    const item = edgeIds.get(id);
    if (!item) return error(line, 'Step references an unknown edge ID.');
    item.step = step;
  }
  if (!direction || !edges.length) return error(1, 'Add at least one directed edge to a flowchart.');
  return { ok: true, document: {
    direction, edges,
    nodes: Array.from(nodes, ([id, value]) => ({ id, ...(value ?? { label: id, shape: 'rectangle' as const }) })),
  } };
}
