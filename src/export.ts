import { assertSafeSvg } from './renderer/mermaid-adapter';
import type { BranchChoices, SequenceDocument } from './core/model';

export const safeJson = (value: unknown) => JSON.stringify(value)
  .replace(/</gu, '\\u003c').replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029');

export function exportHtml(svg: SVGSVGElement, model: SequenceDocument, choices: BranchChoices,
  runtime: string, css: string): string {
  assertSafeSvg(svg);
  // Only trusted, locally bundled JavaScript/CSS reach these arguments.
  if (/<\/script/iu.test(runtime) || /<\/style/iu.test(css)) throw new Error('Unsafe bundle delimiter');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; font-src 'none'; img-src 'none'">
<title>SeqShow — Offline presentation</title><style>${css}</style></head><body>
<main data-player><h1>SeqShow</h1><p>Offline sequence presentation. Paths are presentation choices; conditions are not evaluated.</p>
<div data-controls></div><div data-status role="status" aria-live="polite"></div>
<div data-diagram>${new XMLSerializer().serializeToString(svg)}</div></main>
<script id="seqshow-data" type="application/json">${safeJson({ model, choices })}</script>
<script>${runtime}</script></body></html>`;
}
