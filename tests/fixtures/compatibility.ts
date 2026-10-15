import { parseSequence } from '../../src/core/parser';
import type { Fixture } from '../m0/fixtures';

// Original examples with independently specified playback paths.
export const compatibilitySources = [
  { id: 'compat-breaks', source: `sequenceDiagram
participant A as Web<br/>client
participant B as Server
A->>B: first<br>second<br />third
note over A,B: one<BR/>two
B-->>A: complete`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3'] }] },
  { id: 'compat-wrap-break', source: `sequenceDiagram
A->>B: UserRequestFeatureDocumentation <br/>gRPC
B-->>A: hello<br/><br/>world`, paths: [{ choices: {}, ids: ['step:1', 'step:2'] }] },
  { id: 'compat-decoration', source: `---
title: A local presentation with numbering, activation and grouped participants
---
sequenceDiagram
autonumber 2 3
box rgb(240,245,255) Client group
actor A as Browser
end
participant B as API
A->>+B: request
activate A
B-->>-A: response
deactivate A
autonumber off
rect rgb(240,250,255)
Note over A,B: done
end`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3'] }] },
  { id: 'compat-identifiers', source: `sequenceDiagram
participant Service.API as API
participant 中文服务 as Server
participant "Web App" as Browser
Service.API->>中文服务: request
中文服务-->>"Web App": response
Note over "Web App": ready`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3'] }] },
  { id: 'compat-loops', source: `sequenceDiagram
A->>B: before
loop For each request
A->B: request
loop For each response
B-->A: response
end
end
A->>A: after`, paths: [{ choices: {}, ids: ['step:1', 'step:2', 'step:3', 'step:4'] }] },
  { id: 'compat-loop-path', source: `sequenceDiagram
loop One illustrative attempt
rect rgb(240,250,255)
alt response
A->>B: confirmed
else timeout
Note over A: outcome unknown
end
end
end
A->>A: finish`, paths: [
    { choices: { 'alt:1': 'alt:1:first' }, ids: ['step:1', 'step:3'] },
    { choices: { 'alt:1': 'alt:1:second' }, ids: ['step:2', 'step:3'] },
  ] },
] satisfies { id: string; source: string; paths: Fixture['paths'] }[];

export const compatibilityFixtures = compatibilitySources.map(({ id, source, paths }) => {
  const result = parseSequence(source);
  if (!result.ok) throw new Error(`${id}: ${JSON.stringify(result.diagnostics)}`);
  return { id, title: id, source, model: result.document, paths };
});
