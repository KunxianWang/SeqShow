import { allSteps, alternatives, type BranchChoices, type SequenceDocument } from './core/model';
import { deriveSteps, initialPlayback, transition, type PlaybackAction } from './core/playback';

export function mountPlayer(root: HTMLElement, document: SequenceDocument, initialChoices?: BranchChoices) {
  const svg = root.querySelector('svg')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  let state = initialPlayback(document, initialChoices);
  let steps = deriveSteps(document, state.choices);
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
  const previous = button('Previous', () => dispatch({ type: 'PREVIOUS' }));
  const play = button('Play', () => dispatch({ type: state.playing ? 'PAUSE' : 'PLAY' }));
  const next = button('Next', () => dispatch({ type: 'NEXT' }));
  button('Reset', () => dispatch({ type: 'RESET' }));
  const focusButton = button('Focus', () => { focus = !focus; update(); });
  for (const [ordinal, alternative] of alternatives(document).entries()) {
    const label = window.document.createElement('label');
    label.append(`Path ${ordinal + 1}: `);
    const select = window.document.createElement('select');
    select.dataset.branch = alternative.id;
    for (const branch of alternative.cases) {
      const option = window.document.createElement('option');
      option.value = branch.id; option.textContent = branch.label;
      select.append(option);
    }
    select.value = state.choices[alternative.id];
    select.onchange = () => dispatch({ type: 'CHOOSE_BRANCH', id: alternative.id, caseId: select.value });
    label.append(select); controls.append(label);
  }
  function dispatch(action: PlaybackAction) {
    state = transition(document, state, action);
    steps = deriveSteps(document, state.choices);
    if (!state.playing) pause();
    else if (timer === undefined) timer = setInterval(() => dispatch({ type: 'TICK' }), 1500);
    update();
  }
  function update() {
    const { index, choices } = state;
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
    play.textContent = state.playing ? 'Pause' : 'Play';
    play.disabled = steps.length === 0;
    focusButton.setAttribute('aria-pressed', String(focus));
  }
  const visibility = () => { if (window.document.hidden) dispatch({ type: 'PAUSE' }); };
  window.document.addEventListener('visibilitychange', visibility);
  update();
  return {
    snapshot: () => ({ ...state, total: steps.length, focus, choices: { ...state.choices }, stepIds: steps.map(step => step.id) }),
    seek: (index: number) => dispatch({ type: 'SEEK', index }),
    destroy: () => { pause(); state = { ...state, playing: false }; window.document.removeEventListener('visibilitychange', visibility); controls.replaceChildren(); },
  };
}
