import { allSteps, alternatives, type BranchChoices, type SequenceDocument } from './core/model';
import { defaultChoices, deriveSteps } from './core/playback';

export function mountPlayer(root: HTMLElement, document: SequenceDocument, initialChoices?: BranchChoices) {
  const svg = root.querySelector('svg')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  let choices = { ...defaultChoices(document), ...initialChoices };
  let steps = deriveSteps(document, choices);
  let index = 0;
  let focus = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  controls.replaceChildren();
  const pause = () => { clearInterval(timer); timer = undefined; };
  const button = (name: string, action: () => void) => {
    const element = window.document.createElement('button');
    element.textContent = name; element.type = 'button';
    element.dataset.action = name.toLowerCase(); element.onclick = action;
    controls.append(element); return element;
  };
  const previous = button('Previous', () => seek(Math.max(0, index - 1)));
  const play = button('Play', () => {
    if (timer) { pause(); update(); return; }
    if (!steps.length) return;
    if (index === 0 || index === steps.length) index = 1;
    timer = setInterval(() => {
      index = Math.min(index + 1, steps.length);
      if (index === steps.length) pause();
      update();
    }, 1500);
    if (index === steps.length) pause();
    update();
  });
  const next = button('Next', () => seek(Math.min(steps.length, index + 1)));
  button('Reset', () => seek(0));
  const focusButton = button('Focus', () => { focus = !focus; update(); });
  for (const alternative of alternatives(document)) {
    const label = window.document.createElement('label');
    label.append(`Path ${alternative.id}: `);
    const select = window.document.createElement('select');
    select.dataset.branch = alternative.id;
    for (const branch of alternative.cases) {
      const option = window.document.createElement('option');
      option.value = branch.id; option.textContent = branch.label;
      select.append(option);
    }
    select.value = choices[alternative.id];
    select.onchange = () => {
      pause(); choices = { ...choices, [alternative.id]: select.value };
      steps = deriveSteps(document, choices); index = 0; update();
    };
    label.append(select); controls.append(label);
  }
  function seek(value: number) { pause(); index = value; update(); }
  function update() {
    const current = steps[index - 1];
    const selected = new Set(steps.map(step => step.id));
    const past = new Set(steps.slice(0, Math.max(0, index - 1)).map(step => step.id));
    const phases = new Map<string, string>();
    for (const step of allSteps(document)) {
      const phase = step.id === current?.id ? 'current' : !selected.has(step.id)
        ? 'inactive' : past.has(step.id) ? 'past' : 'future';
      phases.set(step.id, phase);
    }
    for (const node of svg.querySelectorAll('[data-seq-step]')) {
      node.setAttribute('data-phase', phases.get(node.getAttribute('data-seq-step')!)!);
    }
    for (const title of svg.querySelectorAll('[data-seq-case]')) {
      const owner = title.closest('[data-seq-alternative]')!.getAttribute('data-seq-alternative')!;
      title.setAttribute('data-selected', String(title.getAttribute('data-seq-case') === choices[owner]));
    }
    const active = current ? new Set(current.kind === 'message' ? [current.from, current.to] : current.participants) : new Set();
    for (const node of svg.querySelectorAll('[data-seq-participant]')) {
      node.setAttribute('data-active', String(active.has(node.getAttribute('data-seq-participant')!)));
    }
    svg.setAttribute('data-focus', String(focus && index > 0));
    status.textContent = current ? `${index} / ${steps.length} — ${current.text}` : `Overview · 0 / ${steps.length}`;
    previous.disabled = index === 0; next.disabled = index === steps.length;
    play.textContent = timer ? 'Pause' : 'Play';
    focusButton.setAttribute('aria-pressed', String(focus));
  }
  const visibility = () => { if (window.document.hidden) { pause(); update(); } };
  window.document.addEventListener('visibilitychange', visibility);
  update();
  return {
    snapshot: () => ({ index, total: steps.length, playing: Boolean(timer), focus, choices: { ...choices }, stepIds: steps.map(step => step.id) }),
    seek: (value: number) => {
      if (!Number.isInteger(value) || value < 0 || value > steps.length) throw new Error('Invalid step index');
      seek(value);
    },
    destroy: () => { pause(); window.document.removeEventListener('visibilitychange', visibility); controls.replaceChildren(); },
  };
}
