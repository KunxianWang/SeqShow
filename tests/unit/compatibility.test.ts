import { expect, test } from 'vitest';
import { allSteps, alternatives, collectNodes } from '../../src/core/model';
import { parseSequence, INPUT_LIMITS } from '../../src/core/parser';
import { deriveSteps, initialPlayback, transition } from '../../src/core/playback';
import { compatibilityFixtures } from '../fixtures/compatibility';

test.each(compatibilityFixtures)('$id preserves each independently expected path and resets', fixture => {
  for (const path of fixture.paths) {
    expect(deriveSteps(fixture.model, path.choices).map(step => step.id)).toEqual(path.ids);
    const state = initialPlayback(fixture.model, path.choices);
    expect(transition(fixture.model, { ...state, index: path.ids.length }, { type: 'RESET' })).toEqual(state);
  }
});

test('breaks are text newlines; numbering, activation and groups are not steps', () => {
  expect(allSteps(compatibilityFixtures[0].model).map(step => step.text)).toEqual(['first\nsecond\nthird', 'one\ntwo', 'complete']);
  const decorated = compatibilityFixtures.find(fixture => fixture.id === 'compat-decoration')!.model;
  expect(decorated.title).toBe('A local presentation with numbering, activation and grouped participants');
  expect(decorated.boxes).toEqual([{ color: 'rgb(240,245,255)', label: 'Client group', participants: ['A'] }]);
  expect(allSteps(decorated).map(step => step.id)).toEqual(['step:1','step:2','step:3']);
  expect(collectNodes(decorated.nodes).filter(node => node.kind === 'activation')).toHaveLength(4);
});

test('loops flatten exactly once and alternatives inside wrappers retain independent choices', () => {
  expect(allSteps(compatibilityFixtures.find(fixture => fixture.id === 'compat-loops')!.model)).toHaveLength(4);
  expect(alternatives(compatibilityFixtures.find(fixture => fixture.id === 'compat-loop-path')!.model)).toHaveLength(1);
});

test('standard named box colors remain colors, while ordinary group names remain labels', () => {
  const result = parseSequence('sequenceDiagram\nbox navy Backend\nparticipant A\nend\nbox Services\nparticipant B\nend\nA->>B: request');
  expect(result).toMatchObject({ ok: true, document: { boxes: [
    { color: 'navy', label: 'Backend', participants: ['A'] }, { color: 'transparent', label: 'Services', participants: ['B'] },
  ] } });
});

test.each([
  ['"A \\"quoted\\" title"', 'A "quoted" title'],
  ["'Alice''s diagram'", "Alice's diagram"],
])('quoted frontmatter titles retain their plain-text value', (value, title) => {
  expect(parseSequence('---\ntitle: ' + value + '\n---\nsequenceDiagram\nA->>B: hi')).toMatchObject({ ok: true, document: { title } });
});

test('all independently locatable unsupported statements are reported without a partial document', () => {
  const result = parseSequence('sequenceDiagram\nA->>B: valid\nopt later\npar another\nA->>B: <img src="https://bad.invalid">');
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'UNSUPPORTED', line: 3 }, { code: 'UNSUPPORTED', line: 4 }, { code: 'UNSUPPORTED', line: 5 }] });
  expect(result).not.toHaveProperty('document');
});

test.each([
  ['groups', (count: number) => 'sequenceDiagram\n' + 'loop once\nA->>B: hi\nend\n'.repeat(count), 20, 'LIMIT_GROUPS'],
  ['depth', (count: number) => 'sequenceDiagram\n' + 'loop once\n'.repeat(count) + 'A->>B: hi\n' + 'end\n'.repeat(count), 8, 'LIMIT_DEPTH'],
  ['statements', (count: number) => 'sequenceDiagram\nA->>B: hi\n' + 'activate B\n'.repeat(count - 1), 1000, 'LIMIT_STATEMENTS'],
])('%s accepts its limit and rejects one over without truncation', (_name, source, limit, code) => {
  expect(parseSequence(source(limit)).ok).toBe(true);
  expect(parseSequence(source(limit + 1))).toMatchObject({ ok: false, diagnostics: [{ code }] });
});

test.each([
  '---\nconfig:\n  securityLevel: loose\n---\nsequenceDiagram\nA->>B: hi',
  '---\ntitle: "broken\n---\nsequenceDiagram\nA->>B: hi',
  '---\ntitle: "two\\nlines"\n---\nsequenceDiagram\nA->>B: hi',
  'sequenceDiagram\nA->>B: <br onload="alert(1)">',
  'sequenceDiagram\nrect url(https://bad.invalid/x)\nA->>B: hi\nend',
  'sequenceDiagram\ndeactivate A\nA->>B: hi',
  'sequenceDiagram\nloop x\nalt a\nalt nested\nA->>B: x',
  'sequenceDiagram\n' + 'loop x\n'.repeat(INPUT_LIMITS.depth + 1) + 'A->>B: hi',
])('unsafe, malformed or out-of-scope combinations are rejected', source => {
  expect(parseSequence(source).ok).toBe(false);
});
