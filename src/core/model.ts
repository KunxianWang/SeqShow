export type SourceLocation = { line: number; column: number };
export type Participant = { id: string; label: string; kind: 'participant' | 'actor' };
export type Message = {
  kind: 'message'; id: string; from: string; to: string;
  arrow: 'solid' | 'dashed'; text: string; source: SourceLocation;
};
export type Note = {
  kind: 'note'; id: string; placement: 'left' | 'right' | 'over';
  participants: string[]; text: string; source: SourceLocation;
};
export type Step = Message | Note;
export type Alternative = {
  kind: 'alternative'; id: string;
  cases: [{ id: string; label: string; steps: Step[] }, { id: string; label: string; steps: Step[] }];
  source: SourceLocation;
};
export type SequenceDocument = { participants: Participant[]; nodes: (Step | Alternative)[] };
export type BranchChoices = Record<string, string>;

export function alternatives(document: SequenceDocument): Alternative[] {
  return document.nodes.filter((node): node is Alternative => node.kind === 'alternative');
}

export function allSteps(document: SequenceDocument): Step[] {
  return document.nodes.flatMap(node => node.kind === 'alternative'
    ? node.cases.flatMap(branch => branch.steps) : [node]);
}
