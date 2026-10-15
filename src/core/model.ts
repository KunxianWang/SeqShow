export type SourceLocation = { line: number; column: number };
export type Participant = { id: string; label: string; kind: 'participant' | 'actor' };
export type Message = {
  kind: 'message'; id: string; from: string; to: string;
  arrow: 'solid' | 'dashed' | 'solid-line' | 'dashed-line'; text: string; source: SourceLocation;
};
export type Note = {
  kind: 'note'; id: string; placement: 'left' | 'right' | 'over';
  participants: string[]; text: string; source: SourceLocation;
};
export type Step = Message | Note;
export type Alternative = {
  kind: 'alternative'; id: string;
  cases: [{ id: string; label: string; steps: SequenceNode[] }, { id: string; label: string; steps: SequenceNode[] }];
  source: SourceLocation;
};
export type Group = { kind: 'loop' | 'rect'; id: string; label: string; nodes: SequenceNode[]; source: SourceLocation };
export type Activation = { kind: 'activation'; participant: string; active: boolean; source: SourceLocation };
export type Numbering = { kind: 'numbering'; start: number; increment: number; visible: boolean; source: SourceLocation };
export type SequenceNode = Step | Alternative | Group | Activation | Numbering;
export type ParticipantBox = { label: string; color: string; participants: string[] };
export type SequenceDocument = { participants: Participant[]; nodes: SequenceNode[]; title?: string; boxes?: ParticipantBox[] };
export type BranchChoices = Record<string, string>;

export function alternatives(document: SequenceDocument): Alternative[] {
  return collectNodes(document.nodes).filter((node): node is Alternative => node.kind === 'alternative');
}

export function collectNodes(nodes: SequenceNode[]): SequenceNode[] {
  return nodes.flatMap(node => [node, ...node.kind === 'alternative' ? node.cases.flatMap(branch => collectNodes(branch.steps))
    : node.kind === 'loop' || node.kind === 'rect' ? collectNodes(node.nodes) : []]);
}

export function allSteps(document: SequenceDocument): Step[] {
  return collectNodes(document.nodes).filter((node): node is Step => node.kind === 'message' || node.kind === 'note');
}
