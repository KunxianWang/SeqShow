import { describe, expect, test } from 'vitest';
import { allSteps, alternatives } from '../../src/core/model';
import { parseSequence } from '../../src/core/parser';
import { deriveSteps } from '../../src/core/playback';
import { parsedFixtures } from '../fixtures/parsed';

function parse(source: string) {
  const result = parseSequence(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.document;
}
function diagnostic(source: string) {
  const result = parseSequence(source);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected diagnostic');
  return result.diagnostics[0];
}

test('a complete hand-written model matches CRLF, indentation and messages', () => {
  expect(parse('%% comment\r\n\r\n  sequenceDiagram\r\n actor U as 用户\r\n U->>API: hello: https://x:80/a\r\n API-->>U: done')).toEqual({
    participants: [{ id: 'U', label: '用户', kind: 'actor' }, { id: 'API', label: 'API', kind: 'participant' }],
    nodes: [
      { kind: 'message', id: 'step:1', from: 'U', to: 'API', arrow: 'solid', text: 'hello: https://x:80/a', source: { line: 5, column: 2 } },
      { kind: 'message', id: 'step:2', from: 'API', to: 'U', arrow: 'dashed', text: 'done', source: { line: 6, column: 2 } },
    ],
  });
});

test.each(parsedFixtures)('$id has independent expected paths and deterministic unique IDs', fixture => {
  const model = parse(fixture.source);
  for (const path of fixture.paths) expect(deriveSteps(model, path.choices).map(step => step.id)).toEqual(path.ids);
  expect(parse(fixture.source)).toEqual(model);
  const ids = [...model.participants.map(p => p.id), ...allSteps(model).map(s => s.id),
    ...alternatives(model).flatMap(a => [a.id, ...a.cases.map(c => c.id)])];
  expect(new Set(ids).size).toBe(ids.length);
});

test('explicit declarations are ordered first; Notes resolve against the whole document', () => {
  const model = parse('sequenceDiagram\nNote over Late,Implicit: before declarations\nImplicit->>API: hello\nactor Late as 后声明\nparticipant API as Server\nAPI->>Other: last');
  expect(model.participants.map(p => [p.id, p.kind, p.label])).toEqual([
    ['Late', 'actor', '后声明'], ['API', 'participant', 'Server'], ['Implicit', 'participant', 'Implicit'], ['Other', 'participant', 'Other'],
  ]);
  expect(model.nodes[0]).toMatchObject({ kind: 'note', participants: ['Late', 'Implicit'], source: { line: 2, column: 1 } });
});

test('each Note placement keeps its own referenced participants and text', () => {
  const fixture = parsedFixtures.find(f => f.id === 'parsed-notes')!;
  expect(parse(fixture.source).nodes).toMatchObject([
    { kind: 'note', placement: 'left', participants: ['A'], text: '左侧' },
    { kind: 'note', placement: 'right', participants: ['B'], text: '右侧' },
    { kind: 'note', placement: 'over', participants: ['A'], text: '单个参与者' },
    { kind: 'note', placement: 'over', participants: ['A', 'B'], text: '两个参与者' },
    { kind: 'message', from: 'A', to: 'B', arrow: 'solid', text: '注册隐式参与者' },
  ]);
});

test('all text after the delimiter is preserved, including padding, URLs and punctuation', () => {
  const model = parse('sequenceDiagram\n A->>A:   中文: https://x:80/a?x=y&n=1;2 # $  \n Note over A:  注释:后缀  ');
  expect(allSteps(model).map(s => s.text)).toEqual(['  中文: https://x:80/a?x=y&n=1;2 # $  ', ' 注释:后缀  ']);
});

test('hyphen IDs and prototype-like IDs are ordinary participants', () => {
  const model = parse('sequenceDiagram\nactor __proto__\nconstructor->>a-b: hello\na-b-->>__proto__: done\nstep-1->>step-1: self');
  expect(allSteps(model)).toMatchObject([{ from: 'constructor', to: 'a-b' }, { from: 'a-b', to: '__proto__' }, { from: 'step-1', to: 'step-1' }]);
});

test('semicolon punctuation and keyword prefixes in text remain ordinary data', () => {
  const text = 'one; optional; loop-count; title=value; https://example.com:80/x';
  expect(allSteps(parse(`sequenceDiagram\nA->>B: ${text}\nNote over A: ${text}`))
    .map(step => step.text)).toEqual([text, text]);
});

test.each(['alt', 'else'])('keyword participant %s supports whitespace before either arrow', id => {
  const model = parse(`sequenceDiagram\n${id} ->> B: hello\n${id}\t-->> B: reply`);
  expect(model.participants.map(participant => participant.id)).toEqual([id, 'B']);
  expect(allSteps(model)).toMatchObject([
    { from: id, to: 'B', arrow: 'solid', text: 'hello' },
    { from: id, to: 'B', arrow: 'dashed', text: 'reply' },
  ]);
});

test('keyword participants remain messages inside real branches', () => {
  const model = parse('sequenceDiagram\nalt success\nalt ->> else: hello\nelse failure\nelse -->> alt: reply\nend');
  expect(alternatives(model)[0].cases).toMatchObject([
    { label: 'success', steps: [{ from: 'alt', to: 'else', text: 'hello' }] },
    { label: 'failure', steps: [{ from: 'else', to: 'alt', text: 'reply' }] },
  ]);
});

test('tabs and whitespace between Note keywords do not change semantics', () => {
  expect(parse('sequenceDiagram\n\tparticipant A\n\tNote\tleft\t of\tA: hello').nodes[0]).toMatchObject({
    kind: 'note', placement: 'left', participants: ['A'], text: 'hello', source: { line: 3, column: 2 },
  });
});

describe('diagnostics distinguish unsupported Mermaid from malformed input', () => {
  test.each([
    'activate B', 'deactivate B', 'loop retry', 'opt optional', 'par parallel',
    'and other', 'critical transaction', 'break stop', 'option retry',
    'create participant C', 'destroy B', 'autonumber', 'rect rgb(0,0,0)',
    'click B "https://x"', 'link B: docs@https://x', 'links B: {}',
    'box services', 'endbox', 'title diagram',
  ])('rejects a second unsupported statement after a semicolon: %s', statement => {
    expect(diagnostic(`sequenceDiagram\n  A->>B: one; ${statement}`)).toMatchObject({
      code: 'UNSUPPORTED', line: 2, column: 13,
    });
  });
  test.each([
    'opt optional', 'loop retry', 'par parallel', 'activate A', 'deactivate A',
    'create participant A', 'destroy A', 'autonumber', 'rect rgb(0,0,0)',
    'click A "https://x"', 'link A: x@https://x', 'A->B: other arrow', 'A--B: no head',
    'A-xB: cross', 'A-)B: async', 'A<<->>B: bidirectional', 'A->>+B: activate', 'A-->>-B: deactivate',
    'participant A; participant B', 'A->>B: one; B->>A: two', 'A->>B: one; end',
    'A->>B: one; B-->>A: two', 'A->>B: one; B->A: two',
    'A->>B: one; B--A: two', 'A->>B: one; B-xA: two', 'A->>B: one; B-)A: two',
    'A->>B: one; B<<->>A: two', 'A->>B: one; B->>+A: two',
    'participant A as <b>name</b>', 'A->>B: <br/>', 'A->>B: `rich text`',
    '%%{init: {}}%%',
  ])('rejects %s as unsupported', statement => {
    expect(diagnostic(`sequenceDiagram\n${statement}`).code).toBe('UNSUPPORTED');
  });
  test.each(['', '\n %% ordinary', '  \r\n'])('empty input %j', source => expect(diagnostic(source).code).toBe('EMPTY_INPUT'));
  test.each(['flowchart LR\nA-->B', 'A->>B: no header', 'sequenceDiagram; A->>B: one'])('invalid diagram header', source => expect(diagnostic(source).code).toBe('DIAGRAM_TYPE'));
  test('frontmatter is rejected before diagram checks', () => expect(diagnostic('---\ntitle: title\n---\nsequenceDiagram').code).toBe('UNSUPPORTED'));
  test.each(['A->>B', 'participant 123', 'participant A as', 'participant A as    ', 'Note left of A,B: wrong', 'Note over A,B,C: wrong', 'unknown statement'])('malformed %s', statement =>
    expect(diagnostic(`sequenceDiagram\n${statement}`).code).toBe('SYNTAX'));
  test.each(['end', 'else stray', 'alt x\nA->>B: x', 'alt x\nend', 'alt x\nelse y\nelse z\nend', 'alt\nelse y\nend'])('invalid branch structure %s', body =>
    expect(diagnostic(`sequenceDiagram\n${body}`).code).toBe('BRANCH_STRUCTURE'));
  test('nested branch is unsupported, not silently flattened', () => expect(diagnostic('sequenceDiagram\nalt x\nalt nested').code).toBe('UNSUPPORTED'));
  test('case declarations are unsupported', () => expect(diagnostic('sequenceDiagram\nalt x\nparticipant A').code).toBe('UNSUPPORTED'));
  test('duplicate explicit declaration is rejected even if kind changes', () => expect(diagnostic('sequenceDiagram\nparticipant A\nactor A')).toMatchObject({ code: 'DUPLICATE_PARTICIPANT', line: 3, column: 1 }));
  test('unknown Note reference points at the ID', () => expect(diagnostic('\nsequenceDiagram\r\n  Note over A,Missing: 文本\r\nA->>A: ok')).toMatchObject({ code: 'UNKNOWN_PARTICIPANT', line: 3, column: 15 }));
  test('unsupported text column counts emoji in UTF-16', () => expect(diagnostic('sequenceDiagram\r\n  A->>A: 中文😀<b>x</b>')).toMatchObject({ code: 'UNSUPPORTED', line: 2, column: 14 }));
  test('declarations alone have no playable steps', () => expect(diagnostic('sequenceDiagram\nparticipant A').code).toBe('NO_STEPS'));
  test('a Note alone can be playable', () => expect(allSteps(parse('sequenceDiagram\nNote over A: hello\nparticipant A'))).toHaveLength(1));
});

describe('input limits count the complete model without truncation', () => {
  test.each([49_999, 50_000, 50_001])('source UTF-16 length %i', length => {
    const prefix = 'sequenceDiagram\nA->>A: ';
    const source = prefix + '😀'.repeat(Math.floor((length - prefix.length) / 2)) + 'x'.repeat((length - prefix.length) % 2);
    expect(source.length).toBe(length);
    if (length > 50_000) expect(diagnostic(source).code).toBe('LIMIT_SOURCE');
    else expect(allSteps(parse(source))[0].text.length).toBe(length - prefix.length);
  });
  test.each([19, 20, 21])('participants %i', count => {
    const source = 'sequenceDiagram\n' + Array.from({ length: count }, (_, i) => `participant P${i}`).join('\n') + '\nP0->>P0: hello';
    if (count > 20) expect(diagnostic(source)).toMatchObject({ code: 'LIMIT_PARTICIPANTS', line: 22, column: 1 });
    else expect(parse(source).participants).toHaveLength(count);
  });
  test('implicit participants also count toward the limit', () => expect(diagnostic('sequenceDiagram\n' + Array.from({ length: 21 }, (_, i) => `P${i}->>P${i}: hello`).join('\n')).code).toBe('LIMIT_PARTICIPANTS'));
  test.each([199, 200, 201])('Message + Note count %i, including both cases', count => {
    const source = `sequenceDiagram\nparticipant A\nalt first\nA->>A: common\nelse second\n${Array.from({ length: count - 1 }, () => 'Note over A: hidden').join('\n')}\nend`;
    if (count > 200) expect(diagnostic(source).code).toBe('LIMIT_STEPS');
    else expect(allSteps(parse(source))).toHaveLength(count);
  });
  test.each([9, 10, 11])('top-level alternatives %i', count => {
    const source = 'sequenceDiagram\n' + 'alt yes\nA->>A: yes\nelse no\nA->>A: no\nend\n'.repeat(count);
    if (count > 10) expect(diagnostic(source).code).toBe('LIMIT_ALTERNATIVES');
    else expect(alternatives(parse(source))).toHaveLength(count);
  });
});
