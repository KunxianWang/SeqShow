import mermaid from 'mermaid';
import { allSteps, type Alternative, type SequenceDocument, type Step } from '../core/model';

// Mermaid 12.1.0's classic sequence SVG contract lives only in this adapter.

const normalize = (text: string) => text.replace(/\s+/gu, '');
// Wrap plain graphemes before escaping. Mermaid's automatic word wrapping can
// split a numeric entity and display its source instead of the original glyph.
const canvas = window.document.createElement('canvas');
const measure = canvas.getContext('2d')!;
measure.font = '16px Arial';
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function labelLines(text: string) {
  const lines: string[] = [];
  let line = '';
  for (const { segment } of segmenter.segment(text)) {
    if (line && measure.measureText(line + segment).width > 220) {
      const boundary = line.lastIndexOf(' ');
      if (boundary > 0) { lines.push(line.slice(0, boundary)); line = line.slice(boundary + 1); }
      else { lines.push(line); line = ''; }
    }
    line += segment;
  }
  lines.push(line);
  return lines;
}
// Only adapter-generated breaks are markup; user content is always entities.
const label = (text: string) => labelLines(text).map(line => line.replace(/[&<>#;:$%"`[\]{}\r\n]/gu,
    char => `#${char.codePointAt(0)};`)).join('<br/>');

export function serialize(document: SequenceDocument) {
  const lines = ['sequenceDiagram'];
  const events: { ordinal: number; step: Step }[] = [];
  const controls: { ordinal: number; alternative: Alternative }[] = [];
  let ordinal = 0;
  for (const actor of document.participants) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(actor.id)) throw new Error('Invalid participant ID');
    lines.push(`${actor.kind} ${actor.id} as nowrap:${label(actor.label)}`);
  }
  const addStep = (step: Step) => {
    events.push({ ordinal: ordinal++, step });
    lines.push(step.kind === 'message'
      ? `${step.from}${step.arrow === 'solid' ? '->>' : '-->>'}${step.to}: ${label(step.text)}`
      : `Note ${step.placement === 'over' ? 'over' : `${step.placement} of`} ${step.participants.join(',')}: ${label(step.text)}`);
  };
  for (const node of document.nodes) {
    if (node.kind !== 'alternative') { addStep(node); continue; }
    lines.push(`alt ${label(node.cases[0].label)}`); ordinal++;
    node.cases[0].steps.forEach(addStep);
    lines.push(`else ${label(node.cases[1].label)}`); ordinal++;
    node.cases[1].steps.forEach(addStep);
    controls.push({ ordinal, alternative: node });
    lines.push('end'); ordinal++;
  }
  return { source: lines.join('\n'), events, controls };
}

// Fail closed at the SVG/export boundary. A new Mermaid DOM shape needs review.
export function assertSafeSvg(svg: SVGSVGElement) {
  const tags = new Set(['svg', 'g', 'defs', 'marker', 'path', 'line', 'rect', 'text',
    'tspan', 'circle', 'ellipse', 'polygon', 'polyline', 'title', 'desc', 'style', 'symbol', 'use']);
  const ids = new Set(Array.from(svg.querySelectorAll('[id]'), node => node.id));
  ids.add(svg.id);
  const checkUrls = (value: string) => {
    for (const match of value.matchAll(/url\s*\((.*?)\)/giu)) {
      const ref = match[1].trim().replace(/^['"]|['"]$/gu, '');
      if (!ref.startsWith('#') || !ids.has(ref.slice(1))) throw new Error(`Unsafe SVG resource: ${ref}`);
    }
  };
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || !tags.has(node.localName)) {
      throw new Error(`Unsupported SVG element: ${node.localName}`);
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['src', 'srcset', 'action', 'formaction', 'xml:base'].includes(name)) {
        throw new Error(`Unsafe SVG attribute: ${name}`);
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!attr.value.startsWith('#') || !ids.has(attr.value.slice(1))) throw new Error('External SVG reference');
      }
      if (name === 'style') checkCss(attr.value);
      checkUrls(attr.value);
    }
    if (node.localName === 'style') checkCss(node.textContent || '');
  }
  function checkCss(css: string) {
    // Escapes/comments could hide resource-bearing tokens; generated CSS needs neither.
    if (/\\|\/\*|@import|@font-face|expression\s*\(/iu.test(css)) throw new Error('Unsupported SVG CSS');
    checkUrls(css);
  }
}

export function bindSteps(svg: SVGSVGElement, document: SequenceDocument) {
  const { events, controls } = serialize(document);
  const semantic = svg.querySelectorAll('[data-et="message"], [data-et="note"]');
  if (semantic.length !== events.length) throw new Error('SVG step count mismatch');
  const usedText = new Set<Element>();
  for (const { ordinal, step } of events) {
    const matches = svg.querySelectorAll(`[data-id="i${ordinal}"][data-et="${step.kind}"]`);
    if (matches.length !== 1) throw new Error(`Missing or duplicate semantic SVG event: ${step.id}`);
    const shape = matches[0];
    let nodes: Element[];
    if (step.kind === 'message') {
      if (shape.getAttribute('data-from') !== step.from || shape.getAttribute('data-to') !== step.to
        || !shape.classList.contains(step.arrow === 'solid' ? 'messageLine0' : 'messageLine1')
        || shape.localName !== (step.from === step.to ? 'path' : 'line')) {
        throw new Error(`SVG message role mismatch: ${step.id}`);
      }
      // Classic drawMessage emits contiguous text siblings immediately before its line/path.
      const texts: Element[] = [];
      let previous = shape.previousElementSibling;
      while (previous?.matches('text.messageText')) {
        texts.unshift(previous); previous = previous.previousElementSibling;
      }
      if (!texts.length || normalize(texts.map(node => node.textContent).join('')) !== normalize(step.text)) {
        throw new Error(`SVG message text mismatch: ${step.id}; received ${JSON.stringify(texts.map(node => node.textContent))}`);
      }
      texts.forEach(node => usedText.add(node));
      nodes = [...texts, shape];
    } else {
      const textNodes = shape.querySelectorAll('.noteText tspan, text.noteText:not(:has(tspan))');
      if (shape.localName !== 'g' || !shape.querySelector('rect.note')
        || normalize(Array.from(textNodes, node => node.textContent).join('')) !== normalize(step.text)) {
        throw new Error(`SVG note role mismatch: ${step.id}`);
      }
      nodes = [shape];
    }
    nodes.forEach(node => node.setAttribute('data-seq-step', step.id));
  }
  if (svg.querySelectorAll('[data-et="control-structure"]').length !== controls.length) throw new Error('SVG alternative count mismatch');
  for (const { ordinal, alternative } of controls) {
    const groups = svg.querySelectorAll(`[data-et="control-structure"][data-id="i${ordinal}"]`);
    if (groups.length !== 1) throw new Error(`SVG alternative mismatch: ${alternative.id}`);
    const group = groups[0];
    const titles = [group.querySelectorAll('text.loopText'), group.querySelectorAll('text.sectionTitle')];
    if (group.querySelector('.labelText')?.textContent !== 'alt' || group.querySelectorAll('line.loopLine').length !== 5) {
      throw new Error(`SVG alternative frame mismatch: ${alternative.id}`);
    }
    group.setAttribute('data-seq-alternative', alternative.id);
    alternative.cases.forEach((branch, index) => {
      const texts = titles[index];
      if (!texts.length || normalize(Array.from(texts, title => title.textContent).join('')) !== normalize(`[${branch.label}]`)) throw new Error(`SVG case label mismatch: ${branch.id}`);
      texts.forEach(title => title.setAttribute('data-seq-case', branch.id));
    });
  }
  if (usedText.size !== svg.querySelectorAll('text.messageText').length) throw new Error('Unbound SVG message text');
  for (const participant of document.participants) {
    const actors = Array.from(svg.querySelectorAll('[data-et="participant"]'))
      .filter(node => node.getAttribute('data-id') === participant.id);
    const lifeLines = Array.from(svg.querySelectorAll('[data-et="life-line"]'))
      .filter(node => node.getAttribute('data-id') === participant.id);
    if (actors.length !== 1 || lifeLines.length !== 1 || actors[0].getAttribute('data-type') !== participant.kind
      || normalize(actors[0].textContent || '') !== normalize(participant.label)) {
      throw new Error(`SVG participant mismatch: ${participant.id}`);
    }
    [...actors, ...lifeLines].forEach(node => node.setAttribute('data-seq-participant', participant.id));
  }
  if (svg.querySelectorAll('[data-et="participant"]').length !== document.participants.length
    || svg.querySelectorAll('[data-et="life-line"]').length !== document.participants.length) throw new Error('SVG participant count mismatch');
  if (new Set(allSteps(document).map(step => step.id)).size !== events.length) throw new Error('Duplicate step IDs');
}

let renderId = 0;
export async function renderSequence(document: SequenceDocument): Promise<SVGSVGElement> {
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'default', look: 'classic',
    fontFamily: 'Arial, sans-serif',
    sequence: {
      mirrorActors: false, wrap: false, arrowMarkerAbsolute: false,
      height: Math.max(65, ...document.participants.map(actor => labelLines(actor.label).length * 20 + 20)),
    },
  });
  const { svg: markup } = await mermaid.render(`seqshow_${++renderId}`, serialize(document).source);
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('Invalid SVG XML');
  const svg = window.document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  assertSafeSvg(svg);
  bindSteps(svg, document);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Sequence diagram');
  return svg;
}
