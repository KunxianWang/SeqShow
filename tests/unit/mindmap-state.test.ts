import { expect, test } from 'vitest';
import { parseMindmap } from '../../src/core/mindmap';
import { parseStateDiagram } from '../../src/core/state-diagram';

test('mindmap keeps outline parents and distinct topics with identical labels', () => {
  const result = parseMindmap('mindmap\r\n  root((Release))\r\n    Repeat\r\n      review(Review)\r\n    Repeat');
  expect(result).toEqual({ ok: true, document: [
    { label: 'Release', shape: 'circle', parent: undefined, depth: 0, line: 2 },
    { label: 'Repeat', shape: 'rectangle', parent: 0, depth: 1, line: 3 },
    { label: 'Review', shape: 'rounded', parent: 1, depth: 2, line: 4 },
    { label: 'Repeat', shape: 'rectangle', parent: 0, depth: 1, line: 5 },
  ] });
});

test.each([
  ['Root\nAnother root', 3],
  ['Root\n    Branch\n  Ambiguous', 4],
  ['Root\n\tTab', 3],
  ['Root\n  ::icon(fa fa-book)', 3],
  ['Root\n  :::custom', 3],
  ['Root\n  id{{Hexagon}}', 3],
  ['Root\n  id[<img src=https://bad.invalid/x>]', 3],
  ['Root\n  id[One]\n  id[Two]', 4],
])('mindmap rejects unsupported or ambiguous outlines: %j', (source, line) => {
  expect(parseMindmap('mindmap\n' + source)).toMatchObject({ ok: false, line });
});

test('mindmap bounds nesting without changing parent relationships', () => {
  const levels = Array.from({ length: 9 }, (_, index) => '  '.repeat(index) + 'Topic ' + index);
  expect(parseMindmap('mindmap\n' + levels.slice(0, 8).join('\n')).ok).toBe(true);
  expect(parseMindmap('mindmap\n' + levels.join('\n'))).toMatchObject({ ok: false, line: 10 });
});

test('state diagrams distinguish start and end and retain repeated transitions and late labels', () => {
  const result = parseStateDiagram('stateDiagram-v2\ndirection LR\n[*] --> A\nA --> B: accepted\nA --> B: cached\nB --> B: retry [online]\nB --> [*]\nstate "Waiting" as A\nB: Ready');
  expect(result).toEqual({ ok: true, document: { direction: 'LR', states: [
    { id: '@start', label: 'Start', marker: 'start' }, { id: 'A', label: 'Waiting' }, { id: 'B', label: 'Ready' }, { id: '@end', label: 'End', marker: 'end' },
  ], transitions: [
    { from: '@start', to: 'A', label: '', line: 3 },
    { from: 'A', to: 'B', label: 'accepted', line: 4 },
    { from: 'A', to: 'B', label: 'cached', line: 5 },
    { from: 'B', to: 'B', label: 'retry [online]', line: 6 },
    { from: 'B', to: '@end', label: '', line: 7 },
  ] } });
});

test.each([
  'state Composite {',
  'state Select <<choice>>',
  'note right of A: Explain',
  'click A "https://bad.invalid/"',
  '%%{init: {"securityLevel":"loose"}}%%',
  'A --> B: <img src=https://bad.invalid/x>',
  '[*] --> [*]',
  'A --> B --> C',
  'accTitle: Order lifecycle',
  'accDescr: Paid orders ship once',
  'state: Waiting',
  'note: Explain',
])('state rejects unsupported syntax without a partial diagram: %s', statement => {
  expect(parseStateDiagram('stateDiagram-v2\nA --> B\n' + statement)).toMatchObject({ ok: false, line: 3 });
});

test('state accessibility statements fail before Mermaid instead of adding a state', () => {
  expect(parseStateDiagram('stateDiagram-v2\naccTitle: Order lifecycle\n[*] --> Paid')).toEqual({
    ok: false, line: 2, message: 'Accessibility titles and descriptions are not supported.' });
  // Keyword-like IDs remain ordinary states.
  expect(parseStateDiagram('stateDiagram-v2\nnotes: Notes\nstates --> notes')).toMatchObject({ ok: true });
});

test('state rejects conflicting labels and transition overflow', () => {
  expect(parseStateDiagram('stateDiagram\nA --> B\nA: First\nstate "Second" as A')).toMatchObject({ ok: false, line: 4 });
  expect(parseStateDiagram('stateDiagram\n' + 'A --> B\n'.repeat(61))).toMatchObject({ ok: false, line: 62 });
});
