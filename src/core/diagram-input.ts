export const GRAPH_LIMITS = { source: 20_000, nodes: 30, edges: 60, label: 120 } as const;
export type DiagramResult<T> = { ok: true; document: T } | { ok: false; line: number; message: string };

export function plainLabel(value: string) {
  const label = value.trim().replace(/^"([^"]*)"$/u, '$1').trim();
  // These characters delimit syntax or invoke entity, HTML or math handling.
  return label && label.length <= GRAPH_LIMITS.label && !/[\p{Cc}"<>\x60#&;\\|$]/u.test(label) ? label : undefined;
}
