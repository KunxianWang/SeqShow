import { parseSequence } from './core/parser';

export const loginSource = `sequenceDiagram
    actor U as Browser
    participant API
    participant DB as Database
    U->>API: POST /login
    API->>DB: Find user
    DB-->>API: User
    API->>API: Verify password
    alt authenticated
        API-->>U: Session
        Note over U,API: Login succeeded
    else unauthorized
        API-->>U: 401
        Note over U,API: Login failed
    end`;

const parsed = parseSequence(loginSource);
if (!parsed.ok) throw new Error(`Invalid bundled example: ${JSON.stringify(parsed.diagnostics)}`);
export const loginExample = parsed.document;
