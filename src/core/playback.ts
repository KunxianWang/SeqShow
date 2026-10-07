import { alternatives, type BranchChoices, type SequenceDocument, type Step } from './model';

export function defaultChoices(document: SequenceDocument): BranchChoices {
  return Object.fromEntries(alternatives(document).map(node => [node.id, node.cases[0].id]));
}

export function deriveSteps(document: SequenceDocument, choices: BranchChoices): Step[] {
  return document.nodes.flatMap(node => {
    if (node.kind !== 'alternative') return [node];
    const branch = node.cases.find(branch => branch.id === choices[node.id]);
    if (!branch) throw new Error(`Unknown branch for ${node.id}`);
    return branch.steps;
  });
}
