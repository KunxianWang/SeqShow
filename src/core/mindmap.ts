import { GRAPH_LIMITS, plainLabel, type DiagramResult } from './diagram-input';

export type MindmapNode = {
  label: string; shape: 'rectangle' | 'rounded' | 'circle';
  parent?: number; depth: number; line: number;
};

const shaped = /^([A-Za-z_]\w*)(?:\(\(([^()]*)\)\)|\[([^[\]]*)\]|\(([^()]*)\))$/u;

export function parseMindmap(source: string): DiagramResult<MindmapNode[]> {
  const fail = (line: number, message: string) => ({ ok: false as const, line, message });
  if (source.length > GRAPH_LIMITS.source) return fail(1, 'Mindmap source exceeds 20,000 characters.');
  const nodes: MindmapNode[] = [];
  const stack: { indent: number; index: number }[] = [];
  const ids = new Set<string>();
  let header = false;
  for (const [offset, raw] of source.split(/\r\n|\n|\r/u).entries()) {
    const line = offset + 1, content = raw.trim();
    if (content.startsWith('%%{')) return fail(line, 'Mermaid configuration directives are not supported.');
    if (!content || content.startsWith('%%')) continue;
    if (!header) {
      if (content !== 'mindmap') return fail(line, 'Start with mindmap.');
      header = true; continue;
    }
    const whitespace = /^[ \t]*/u.exec(raw)![0];
    if (whitespace.includes('\t')) return fail(line, 'Indent topics with spaces, not tabs.');
    if (content.startsWith('::')) return fail(line, 'Mindmap icons and CSS classes are not supported.');
    const indent = whitespace.length;
    if (stack.length && indent <= stack.at(-1)!.indent) {
      while (stack.length && indent < stack.at(-1)!.indent) stack.pop();
      if (stack.at(-1)?.indent !== indent) return fail(line, 'Return to an existing indentation level.');
      stack.pop();
      if (!stack.length) return fail(line, 'A mindmap needs one root topic.');
    }
    if (stack.length >= 8) return fail(line, 'Mindmaps are limited to 8 levels.');
    if (nodes.length >= GRAPH_LIMITS.nodes) return fail(line, 'Mindmaps are limited to 30 topics.');
    const node = shaped.exec(content);
    const label = plainLabel(node ? node[2] ?? node[3] ?? node[4] : content);
    if (!label || /[()[\]{}]/u.test(label)) return fail(line, 'Use plain topic text or ID[Box], ID(Rounded), or ID((Circle)).');
    if (node) {
      if (node[1].length > GRAPH_LIMITS.label || ids.has(node[1])) return fail(line, 'Use a unique topic ID of at most 120 characters.');
      ids.add(node[1]);
    }
    const parent = stack.at(-1)?.index;
    const shape = node?.[2] !== undefined ? 'circle' : node?.[4] !== undefined ? 'rounded' : 'rectangle';
    stack.push({ indent, index: nodes.length });
    nodes.push({ label, shape, parent, depth: stack.length - 1, line });
  }
  return nodes.length ? { ok: true, document: nodes } : fail(1, 'Add at least one mindmap topic.');
}
