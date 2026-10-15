import mermaid from 'mermaid';
import { assertSafeSvg } from './svg-safety';
import { allSteps, type Alternative, type Group, type ParticipantBox, type SequenceDocument, type SequenceNode, type Step } from '../core/model';

// Mermaid 12.1.0's classic sequence SVG contract lives only in this adapter.

const normalize = (text: string) => text.replace(/\s+/gu, '');
function matchesStepText(rendered: string, expected: string) {
  // Mermaid 12.1.0 renders an empty Message/Note label as one U+200B placeholder.
  // Accept it only for blank model text; never strip it from nonempty labels.
  return normalize(rendered) === normalize(expected)
    || (!expected.trim() && rendered === '\u200b')
    || (!expected.includes('\u200b') && labelLines(expected).some(line => !line.trim())
      && normalize(rendered.replace(/\u200b/gu, '')) === normalize(expected));
}
// Wrap plain graphemes before escaping. Mermaid's automatic word wrapping can
// split a numeric entity and display its source instead of the original glyph.
const canvas = window.document.createElement('canvas');
const measure = canvas.getContext('2d')!;
measure.font = '16px Arial';
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
// Wide enough that common API labels ("POST /orders + idempotency key") stay on one line.
const LABEL_WIDTH = 260;
function labelLines(text: string) {
  return text.split('\n').flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    for (const { segment } of segmenter.segment(paragraph)) {
      if (line && measure.measureText(line + segment).width > LABEL_WIDTH) {
        const boundary = line.lastIndexOf(' ');
        if (boundary > 0) { lines.push(line.slice(0, boundary)); line = line.slice(boundary + 1); }
        else { lines.push(line); line = ''; }
      }
      line += segment;
    }
    // A wrap immediately before an explicit break must not emit a whitespace-only
    // line: Mermaid cannot measure that line's bounding box.
    if (line.trim() || !lines.length) lines.push(line.trim() ? line : '');
    return lines;
  });
}
// Only adapter-generated breaks are markup; user content is always entities.
const escapeText = (text: string) => text.replace(/[&<>#;:$%"`[\]{}\r\n]/gu, char => `#${char.codePointAt(0)};`);
// Give explicit blank lines a measurable, invisible glyph. Mermaid's default
// zero-width placeholder has a zero bounding box in Windows WebKit.
const label = (text: string) => labelLines(text).map(line => escapeText(line || '\u2002')).join('<br/>');

export function serialize(document: SequenceDocument) {
  const lines = ['sequenceDiagram'];
  const events: { ordinal: number; step: Step }[] = [];
  const controls: { ordinal: number; node: Alternative | Group }[] = [];
  // Valid user IDs (e.g. "end" or a trailing hyphen) can collide with Mermaid's
  // lexer. Keep user identity in the model/data-seq-* and use safe layout IDs.
  const participantIds = new Map(document.participants.map((actor, index) => [actor.id, `seqParticipant${index + 1}`]));
  const reference = (id: string) => {
    const rendered = participantIds.get(id);
    if (!rendered) throw new Error(`Unknown participant: ${id}`);
    return rendered;
  };
  let ordinal = 0;
  // Mermaid's diagram title is plain SVG text, not a wrapping label.
  if (document.title !== undefined) lines.push(`title ${escapeText(document.title)}`);
  let openBox: ParticipantBox | undefined;
  for (const actor of document.participants) {
    if (!actor.id || participantIds.size !== document.participants.length) throw new Error('Invalid participant ID');
    const box = document.boxes?.find(box => box.participants.includes(actor.id));
    if (box !== openBox) {
      if (openBox) lines.push('end');
      if (box) {
        if (!/^(?:rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)$/iu.test(box.color)) throw new Error('Invalid box color');
        lines.push(`box ${box.color} ${label(box.label)}`);
      }
      openBox = box;
    }
    lines.push(`${actor.kind} ${reference(actor.id)} as nowrap:${label(actor.label)}`);
  }
  if (openBox) lines.push('end');
  const addStep = (step: Step) => {
    events.push({ ordinal: ordinal++, step });
    lines.push(step.kind === 'message'
      ? `${reference(step.from)}${{ solid: '->>', dashed: '-->>', 'solid-line': '->', 'dashed-line': '-->' }[step.arrow]}${reference(step.to)}: ${label(step.text)}`
      : `Note ${step.placement === 'over' ? 'over' : `${step.placement} of`} ${step.participants.map(reference).join(',')}: ${label(step.text)}`);
  };
  const visit = (nodes: SequenceNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'message' || node.kind === 'note') { addStep(node); continue; }
      if (node.kind === 'activation') {
        lines.push(`${node.active ? 'activate' : 'deactivate'} ${reference(node.participant)}`); ordinal++; continue;
      }
      if (node.kind === 'numbering') {
        lines.push(node.visible ? `autonumber ${node.start} ${node.increment}` : 'autonumber off'); ordinal++; continue;
      }
      if (node.kind === 'alternative') {
        lines.push(`alt ${label(node.cases[0].label)}`); ordinal++; visit(node.cases[0].steps);
        lines.push(`else ${label(node.cases[1].label)}`); ordinal++; visit(node.cases[1].steps);
      } else {
        if (node.kind === 'rect' && !/^(?:rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)$/iu.test(node.label)) throw new Error('Invalid rect color');
        lines.push(`${node.kind} ${node.kind === 'rect' ? node.label : label(node.label)}`); ordinal++; visit(node.nodes);
      }
      if (node.kind !== 'rect') controls.push({ ordinal, node });
      lines.push('end'); ordinal++;
    }
  };
  visit(document.nodes);
  return { source: lines.join('\n'), events, controls, participantIds };
}

export function bindSteps(svg: SVGSVGElement, document: SequenceDocument) {
  svg.toggleAttribute('data-seq-numbered', !!svg.querySelector('.sequenceNumber'));
  const { events, controls, participantIds } = serialize(document);
  const semantic = svg.querySelectorAll('[data-et="message"], [data-et="note"]');
  if (semantic.length !== events.length) throw new Error('SVG step count mismatch');
  const usedText = new Set<Element>();
  for (const { ordinal, step } of events) {
    const matches = svg.querySelectorAll(`[data-id="i${ordinal}"][data-et="${step.kind}"]`);
    if (matches.length !== 1) throw new Error(`Missing or duplicate semantic SVG event: ${step.id}`);
    const shape = matches[0];
    let nodes: Element[];
    if (step.kind === 'message') {
      if (shape.getAttribute('data-from') !== participantIds.get(step.from) || shape.getAttribute('data-to') !== participantIds.get(step.to)
        || !shape.classList.contains(step.arrow.startsWith('solid') ? 'messageLine0' : 'messageLine1')
        || shape.hasAttribute('marker-end') === step.arrow.endsWith('-line')
        || shape.localName !== (step.from === step.to ? 'path' : 'line')) {
        throw new Error(`SVG message role mismatch: ${step.id}`);
      }
      // Classic drawMessage emits contiguous text siblings immediately before its line/path.
      const texts: Element[] = [];
      let previous = shape.previousElementSibling;
      while (previous?.matches('text.messageText')) {
        texts.unshift(previous); previous = previous.previousElementSibling;
      }
      if (!texts.length || !matchesStepText(texts.map(node => node.textContent).join(''), step.text)) {
        throw new Error(`SVG message text mismatch: ${step.id}; received ${JSON.stringify(texts.map(node => node.textContent))}`);
      }
      texts.forEach(node => usedText.add(node));
      nodes = [...texts, shape];
    } else {
      const textNodes = shape.querySelectorAll('.noteText tspan, text.noteText:not(:has(tspan))');
      if (shape.localName !== 'g' || !shape.querySelector('rect.note')
        || !matchesStepText(Array.from(textNodes, node => node.textContent).join(''), step.text)) {
        throw new Error(`SVG note role mismatch: ${step.id}`);
      }
      nodes = [shape];
    }
    nodes.forEach(node => node.setAttribute('data-seq-step', step.id));
    // The player anchors its step marker to this shape without knowing Mermaid's DOM.
    (step.kind === 'message' ? shape : shape.querySelector('rect.note')!).setAttribute('data-seq-shape', step.id);
  }
  if (svg.querySelectorAll('[data-et="control-structure"]').length !== controls.length) throw new Error('SVG alternative count mismatch');
  for (const { ordinal, node } of controls) {
    const groups = svg.querySelectorAll(`[data-et="control-structure"][data-id="i${ordinal}"]`);
    if (groups.length !== 1) throw new Error(`SVG control mismatch: ${node.id}`);
    const group = groups[0];
    if (node.kind === 'loop') {
      if (group.querySelector('.labelText')?.textContent !== 'loop'
        || normalize(Array.from(group.querySelectorAll('text.loopText'), title => title.textContent).join('')) !== normalize(`[${node.label}]`)
        || group.querySelectorAll('line.loopLine').length !== 4) throw new Error(`SVG loop mismatch: ${node.id}`);
      group.setAttribute('data-seq-loop', node.id); continue;
    }
    if (node.kind !== 'alternative') throw new Error('Unexpected control');
    const alternative = node;
    const titles = [group.querySelectorAll('text.loopText'), group.querySelectorAll('text.sectionTitle')];
    if (group.querySelector('.labelText')?.textContent !== 'alt' || group.querySelectorAll('line.loopLine').length !== 5) {
      throw new Error(`SVG alternative frame mismatch: ${alternative.id}`);
    }
    group.setAttribute('data-seq-alternative', alternative.id);
    // Frame: two vertical borders plus top border, case divider and bottom border.
    const frame = Array.from(group.querySelectorAll('line.loopLine'));
    const horizontal = frame.filter(line => line.getAttribute('y1') === line.getAttribute('y2'))
      .sort((a, b) => Number(a.getAttribute('y1')) - Number(b.getAttribute('y1')));
    if (horizontal.length !== 3) throw new Error(`SVG alternative frame mismatch: ${alternative.id}`);
    frame.forEach(line => line.setAttribute('data-seq-frame', alternative.id));
    horizontal[1].setAttribute('data-seq-divider', alternative.id);
    alternative.cases.forEach((branch, index) => {
      const texts = titles[index];
      if (!texts.length || normalize(Array.from(texts, title => title.textContent).join('')) !== normalize(`[${branch.label}]`)) throw new Error(`SVG case label mismatch: ${branch.id}`);
      texts.forEach(title => title.setAttribute('data-seq-case', branch.id));
    });
  }
  if (usedText.size !== svg.querySelectorAll('text.messageText').length) throw new Error('Unbound SVG message text');
  for (const participant of document.participants) {
    const actors = Array.from(svg.querySelectorAll('[data-et="participant"]'))
      .filter(node => node.getAttribute('data-id') === participantIds.get(participant.id));
    const lifeLines = Array.from(svg.querySelectorAll('[data-et="life-line"]'))
      .filter(node => node.getAttribute('data-id') === participantIds.get(participant.id));
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
  const { source } = serialize(document);
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'classic',
    themeVariables: {
      useGradient: false,
      primaryColor: '#f1f5f9', primaryTextColor: '#0f172a', primaryBorderColor: '#cbd5e1',
      lineColor: '#475569', actorBkg: '#ffffff', actorBorder: '#cbd5e1', actorTextColor: '#0f172a',
      actorLineColor: '#cbd5e1', signalColor: '#475569', signalTextColor: '#1e293b',
      labelBoxBkgColor: '#eff6ff', labelBoxBorderColor: '#93c5fd', labelTextColor: '#1d4ed8',
      loopTextColor: '#475569', noteBkgColor: '#f5f8ff', noteBorderColor: '#c7d7fe', noteTextColor: '#1e3a8a',
    },
    // Parser limits the original input; safe IDs, entities and line breaks can
    // expand the generated source beyond Mermaid's default 50,000 characters.
    maxTextSize: source.length,
    fontFamily: 'Arial, sans-serif',
    sequence: {
      mirrorActors: false, wrap: false, arrowMarkerAbsolute: false,
      // Layout-time typography and spacing: fixed for the whole render, so steps never re-layout.
      actorFontWeight: 600, noteFontWeight: 600, messageMargin: 42, boxMargin: 12, noteMargin: 12, actorMargin: 60,
      height: Math.max(56, ...document.participants.map(actor => labelLines(actor.label).length * 20 + 20)),
    },
  });
  const { svg: markup } = await mermaid.render(`seqshow_${++renderId}`, source);
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('Invalid SVG XML');
  const svg = window.document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  assertSafeSvg(svg);
  bindSteps(svg, document);
  // Softer participant and Note corners; radius is not part of the measured geometry.
  for (const box of svg.querySelectorAll('rect.actor, rect.note')) { box.setAttribute('rx', '8'); box.setAttribute('ry', '8'); }
  // Preserve Mermaid's text scale for wide diagrams. The surrounding diagram
  // container scrolls; shrinking all participants into the panel makes labels unreadable.
  svg.style.minWidth = `${Math.max(600, svg.viewBox.baseVal.width)}px`;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Sequence diagram');
  return svg;
}
