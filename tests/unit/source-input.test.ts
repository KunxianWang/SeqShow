import { expect, test } from 'vitest';
import { MAX_DOCUMENT_UNITS, sequenceBlocks } from '../../src/source-input';

test('extracts only complete sequence blocks with original source lines and Unicode', () => {
  const text = '# Title\r\n```mermaid\r\nflowchart LR\r\nA-->B\r\n```\r\n~~~mermaid\r\nsequenceDiagram\r\nA->>B: 中文\r\n~~~\r\n```mermaid\r\nsequenceDiagram\r\nA->>A: second\r\n```';
  expect(sequenceBlocks(text)).toEqual([
    { source: 'sequenceDiagram\nA->>B: 中文', line: 7 },
    { source: 'sequenceDiagram\nA->>A: second', line: 11 },
  ]);
});
test('does not extract a nested fence from an unrelated code block', () => {
  expect(sequenceBlocks('````text\n```mermaid\nsequenceDiagram\nA->>B: hi\n```\n````')).toEqual([]);
});
test.each(['```mermaid\nsequenceDiagram', '`'.repeat(3) + 'mermaid\nsequenceDiagram\n~~'].map(String))('rejects an unclosed fence without fabricating source', value => {
  expect(() => sequenceBlocks(value)).toThrow('not closed');
});
test('bounds document scanning independently of diagram limits', () => {
  expect(() => sequenceBlocks('x'.repeat(MAX_DOCUMENT_UNITS + 1))).toThrow('500,000');
});
