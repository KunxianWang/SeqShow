import { expect, test } from 'vitest';
import { parseFlowchart } from '../../src/core/flowchart';

test('flowchart retains declaration shapes, labels and repeated edges in source order', () => {
  expect(parseFlowchart('%% sample\r\ngraph LR\r\nA -->|First| B{Ready?}\r\nA -->|Again| B\r\nB --> A("打开请求")')).toEqual({
    ok: true, document: { direction: 'LR', nodes: [
      { id: 'A', label: '打开请求', shape: 'rounded' },
      { id: 'B', label: 'Ready?', shape: 'decision' },
    ], edges: [
      { from: 'A', to: 'B', label: 'First', line: 3 },
      { from: 'A', to: 'B', label: 'Again', line: 4 },
      { from: 'B', to: 'A', label: '', line: 5 },
    ] },
  });
});

test.each([
  'A --> B --> C',
  'A e1@==> B',
  'A[[Subroutine]] --> B',
  'A([Stadium]) --> B',
  'A[(Database)] --> B',
  'A -. link .- B',
  'subgraph internal',
  'classDef external fill:url(https://bad.invalid/x)',
  'click A "https://bad.invalid/"',
  '%%{init: {"securityLevel":"loose"}}%%',
  'A["<img src=https://bad.invalid/x>"] --> B',
  'A -->|"bad quote"| B["x"y"]',
  'A -->|#60;script#62;| B',
])('rejects unsupported or unsafe syntax without a partial graph: %s', statement => {
  expect(parseFlowchart('flowchart TD\nA --> B\n' + statement)).toMatchObject({ ok: false, line: 3 });
});

test('conflicting declarations report the later source line', () => {
  expect(parseFlowchart('flowchart TB\nA[First] --> B\nA{Second}')).toMatchObject({
    ok: false, line: 3, message: 'A node cannot have conflicting labels or shapes.',
  });
});

test('step numbers are attached to their named edges without changing source order', () => {
  expect(parseFlowchart('flowchart LR\nsecond@{ step: 2 }\nA first@--> B\nA second@-.->|Retry| B\nB --> A\nfirst@{ step: 7 }')).toMatchObject({
    ok: true, document: { edges: [
      { from: 'A', to: 'B', step: 7 },
      { from: 'A', to: 'B', label: 'Retry', dotted: true, step: 2 },
      { from: 'B', to: 'A', label: '' },
    ] },
  });
});

test.each([
  ['A e1@--> B\ne2@{ step: 1 }', 3, 'unknown edge'],
  ['A e1@--> B\nB e1@--> C', 3, 'unique edge ID'],
  ['A e1@--> B\nA e2@--> B\ne1@{ step: 1 }\ne2@{ step: 1 }', 5, 'step number'],
  ['A e1@--> B\ne1@{ step: 1 }\ne1@{ step: 2 }', 4, 'step number'],
  ['A e1@--> B\ne1@{ step: 61 }', 3, 'between 1 and 60'],
  ['A e1@--> B\ne1@{ step: 1, animate: true }', 3, 'Use only'],
])('rejects invalid edge numbering: %s', (body, line, message) => {
  const result = parseFlowchart('flowchart LR\n' + body);
  expect(result).toMatchObject({ ok: false, line, message: expect.stringContaining(message) });
});

test('flowchart does not silently truncate edges or nodes', () => {
  const body = 'A --> B\n'.repeat(60);
  expect(parseFlowchart('flowchart TD\n' + body).ok).toBe(true);
  expect(parseFlowchart('flowchart TD\n' + body + 'A --> B')).toMatchObject({ ok: false, line: 62 });
  const nodes = Array.from({ length: 29 }, (_, i) => 'N' + i + '\n').join('');
  expect(parseFlowchart('flowchart TD\n' + nodes + 'A --> B')).toMatchObject({ ok: false, line: 31 });
});
