import type { SequenceDocument } from './core/model';

const source = { line: 1, column: 1 }; // Hand-authored until Parser integration in M2.
export const loginExample: SequenceDocument = {
  participants: [
    { id: 'U', label: 'Browser', kind: 'actor' },
    { id: 'API', label: 'API', kind: 'participant' },
    { id: 'DB', label: 'Database', kind: 'participant' },
  ],
  nodes: [
    { kind: 'message', id: 'post', from: 'U', to: 'API', arrow: 'solid', text: 'POST /login', source },
    { kind: 'message', id: 'find', from: 'API', to: 'DB', arrow: 'solid', text: 'Find user', source },
    { kind: 'message', id: 'user', from: 'DB', to: 'API', arrow: 'dashed', text: 'User', source },
    { kind: 'message', id: 'verify', from: 'API', to: 'API', arrow: 'solid', text: 'Verify password', source },
    { kind: 'alternative', id: 'auth', source, cases: [
      { id: 'yes', label: 'authenticated', steps: [
        { kind: 'message', id: 'session', from: 'API', to: 'U', arrow: 'dashed', text: 'Session', source },
        { kind: 'note', id: 'success', placement: 'over', participants: ['U', 'API'], text: 'Login succeeded', source },
      ] },
      { id: 'no', label: 'unauthorized', steps: [
        { kind: 'message', id: 'denied', from: 'API', to: 'U', arrow: 'dashed', text: '401', source },
        { kind: 'note', id: 'failure', placement: 'over', participants: ['U', 'API'], text: 'Login failed', source },
      ] },
    ] },
  ],
};
