import { assertSafeSvg } from './renderer/svg-safety';
import type { BranchChoices, SequenceDocument } from './core/model';
import { initialPlayback } from './core/playback';

export const safeJson = (value: unknown) => JSON.stringify(value)
  .replace(/</gu, '\\u003c').replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029');

// Static markup for exported files; index.html carries the same logo.
const logo = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="7" fill="#2563EB"/>'
  + '<path d="M8 7v14M20 7v14" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>'
  + '<path d="M8 11.5h10m-2.6-2.6 2.6 2.6-2.6 2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M19 17.5h-9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 2.6"/></svg>';
const keys = '<p class="player-help"><kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> play / pause · <kbd>Home</kbd> reset</p>';

export function exportHtml(svg: SVGSVGElement, model: SequenceDocument, choices: BranchChoices,
  runtime: string, css: string): string {
  assertSafeSvg(svg);
  const selected = initialPlayback(model, choices).choices;
  // Only trusted, locally bundled JavaScript/CSS reach these arguments.
  if (/<\/script/iu.test(runtime) || /<\/style/iu.test(css)) throw new Error('Unsafe bundle delimiter');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; font-src 'none'; img-src 'none'">
<title>SeqShow — Offline presentation</title><style>${css}</style></head><body class="export-page">
<header class="export-bar"><h1>${logo}SeqShow</h1><span class="offline-pill">Offline presentation</span></header>
<main class="export-panel" data-player aria-label="Presentation player">
<div data-controls></div><p class="path-help">This is a presentation path; conditions are not evaluated.</p>
<div data-diagram>${new XMLSerializer().serializeToString(svg)}</div>
<div class="player-dock"><p class="step-meta" data-step-meta></p><div data-status role="status" aria-live="polite"></div>
<div class="player-dock-row"><div data-transport></div>${keys}</div></div></main>
<p class="export-foot">Made with SeqShow · This file runs offline and makes no network requests.</p>
<script id="seqshow-data" type="application/json">${safeJson({ model, choices: selected })}</script>
<script>${runtime}</script></body></html>`;
}
