import { parseSequence } from '../../src/core/parser';
import type { Fixture } from '../m0/fixtures';

// Expected paths are handwritten, not derived from the parser or serializer.
const sources: { id: string; source: string; paths: Fixture['paths'] }[] = [
  { id: 'parsed-linear', source: 'sequenceDiagram\nA->>B: hello\nB-->>A: world',
    paths: [{ choices: {}, ids: ['step:1', 'step:2'] }] },
  { id: 'parsed-repeated', source: 'sequenceDiagram\nA->>B: same\nA->>B: same\nB->>B: same\nB-->>B: same',
    paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3', 'step:4'] }] },
  { id: 'parsed-notes', source: `sequenceDiagram
Note left of A: 左侧
Note right of B: 右侧
Note over A: 单个参与者
Note over A,B: 两个参与者
A->>B: 注册隐式参与者`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3', 'step:4', 'step:5'] }] },
  { id: 'parsed-alias', source: `sequenceDiagram
implicit->>API: 中文：请求 & 返回；状态 < 500 > 0
actor U as 用户 Browser
participant API as 接口服务
participant implicit as 显式声明晚于消息
U->>API: POST /login
API-->>U: 完成`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3'] }] },
  { id: 'parsed-multiple', source: `sequenceDiagram
A->>B: start
alt cache hit
B-->>A: cached
else cache miss
B->>B: compute
Note over B: save cache
end
alt save
B->>A: saved
else skip
Note over A: no save
B-->>A: continue
end
A->>A: finish`, paths: [
    { choices: { 'alt:1': 'alt:1:first', 'alt:2': 'alt:2:first' }, ids: ['step:1', 'step:2', 'step:5', 'step:8'] },
    { choices: { 'alt:1': 'alt:1:first', 'alt:2': 'alt:2:second' }, ids: ['step:1', 'step:2', 'step:6', 'step:7', 'step:8'] },
    { choices: { 'alt:1': 'alt:1:second', 'alt:2': 'alt:2:first' }, ids: ['step:1', 'step:3', 'step:4', 'step:5', 'step:8'] },
    { choices: { 'alt:1': 'alt:1:second', 'alt:2': 'alt:2:second' }, ids: ['step:1', 'step:3', 'step:4', 'step:6', 'step:7', 'step:8'] },
  ] },
  { id: 'parsed-long', source: `sequenceDiagram
actor _client as 中文用户与浏览器
participant api-server as 服务端接口
_client->>api-server: https://example.com:8080/a?q=x:y&n=1;2 #hash $money $$literal$$ 中文长消息需要保持完整，不因为视觉折行增加步骤。${'返回值：成功；'.repeat(12)}
Note over _client,api-server: 单步说明 https://example.com:8080/path:a`,
    paths: [{ choices: {}, ids: ['step:1', 'step:2'] }] },
  { id: 'parsed-empty-path', source: `sequenceDiagram
participant A
alt nothing to do
else run
A->>A: only
end`, paths: [
    { choices: { 'alt:1': 'alt:1:first' }, ids: [] },
    { choices: { 'alt:1': 'alt:1:second' }, ids: ['step:1'] },
  ] },
  { id: 'parsed-id-boundaries', source: `sequenceDiagram
actor __proto__ as Prototype
participant constructor
participant end as End service
participant tail- as Trailing hyphen
__proto__->>constructor: hello
constructor-->>end: return
end->>tail-: call
tail- ->> __proto__: finish`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3', 'step:4'] }] },
];

export const parsedFixtures = sources.map(({ id, source, paths }) => {
  const result = parseSequence(source);
  if (!result.ok) throw new Error(`${id}: ${JSON.stringify(result.diagnostics)}`);
  return { id, title: id, source, model: result.document, paths };
});
