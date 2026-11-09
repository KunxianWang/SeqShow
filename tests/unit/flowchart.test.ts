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
  'A e1@--> B',
  'A[[Subroutine]] --> B',
  'A([Stadium]) --> B',
  'A[(Database)] --> B',
  'A -.-> B',
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

test('flowchart does not silently truncate edges or nodes', () => {
  const body = 'A --> B\n'.repeat(60);
  expect(parseFlowchart('flowchart TD\n' + body).ok).toBe(true);
  expect(parseFlowchart('flowchart TD\n' + body + 'A --> B')).toMatchObject({ ok: false, line: 62 });
  const nodes = Array.from({ length: 29 }, (_, i) => 'N' + i + '\n').join('');
  expect(parseFlowchart('flowchart TD\n' + nodes + 'A --> B')).toMatchObject({ ok: false, line: 31 });
});
