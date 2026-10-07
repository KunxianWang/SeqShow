import { alternatives, type BranchChoices, type SequenceDocument, type Step } from './model';

export function defaultChoices(document: SequenceDocument): BranchChoices {
  return Object.fromEntries(alternatives(document).map(node => [node.id, node.cases[0].id]));
}

export function deriveSteps(document: SequenceDocument, choices: BranchChoices): Step[] {
  for (const id of Object.keys(choices)) {
    if (!alternatives(document).some(node => node.id === id)) throw new Error(`Unknown alternative ${id}`);
  }
  return document.nodes.flatMap(node => {
    if (node.kind !== 'alternative') return [node];
    const branch = node.cases.find(branch => branch.id === choices[node.id]);
    if (!branch) throw new Error(`Unknown branch for ${node.id}`);
    return branch.steps;
  });
}

export type PlaybackState = { index: number; playing: boolean; choices: BranchChoices };
export type PlaybackAction =
  | { type: 'NEXT' | 'PREVIOUS' | 'RESET' | 'PLAY' | 'PAUSE' | 'TICK' }
  | { type: 'CHOOSE_BRANCH'; id: string; caseId: string }
  | { type: 'SEEK'; index: number };

export function initialPlayback(document: SequenceDocument, choices: BranchChoices = {}): PlaybackState {
  const selected = { ...defaultChoices(document), ...choices };
  deriveSteps(document, selected); // Invalid saved choices fail explicitly.
  return { index: 0, playing: false, choices: selected };
}

export function transition(document: SequenceDocument, state: PlaybackState, action: PlaybackAction): PlaybackState {
  const total = deriveSteps(document, state.choices).length;
  switch (action.type) {
    case 'CHOOSE_BRANCH': {
      const choices = { ...state.choices, [action.id]: action.caseId };
      deriveSteps(document, choices);
      return { index: 0, playing: false, choices };
    }
    case 'NEXT': return { ...state, index: Math.min(total, state.index + 1), playing: false };
    case 'PREVIOUS': return { ...state, index: Math.max(0, state.index - 1), playing: false };
    case 'RESET': return { ...state, index: 0, playing: false };
    case 'PAUSE': return { ...state, playing: false };
    case 'PLAY': {
      const index = total === 0 ? 0 : state.index === 0 || state.index === total ? 1 : state.index;
      return { ...state, index, playing: index < total };
    }
    case 'TICK': {
      if (!state.playing) return state;
      const index = Math.min(total, state.index + 1);
      return { ...state, index, playing: index < total };
    }
    case 'SEEK':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > total) throw new Error('Invalid step index');
      return { ...state, index: action.index, playing: false };
  }
}
