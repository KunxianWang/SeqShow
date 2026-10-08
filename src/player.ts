import { allSteps, alternatives, type BranchChoices, type SequenceDocument } from './core/model';
import { deriveSteps, initialPlayback, transition, type PlaybackAction } from './core/playback';

export function mountPlayer(root: HTMLElement, document: SequenceDocument, initialChoices?: BranchChoices) {
  const svg = root.querySelector('svg')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const details = window.document.createElement('p');
  details.dataset.stepDetails = ''; status.after(details);
  root.tabIndex = 0;
  let state = initialPlayback(document, initialChoices);
  let steps = deriveSteps(document, state.choices);
  let focus = true;
  let enabled = true, focusEnabled = true, destroyed = false;
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
  const reset = button('Reset', () => dispatch({ type: 'RESET' }));
  const focusButton = button('Focus', () => { if (!destroyed && focusEnabled) { focus = !focus; update(); } });
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
    const other = window.document.createElement('span');
    other.dataset.otherPath = alternative.id;
    label.append(select, other); controls.append(label);
  }
  function dispatch(action: PlaybackAction) {
    if (destroyed || (!enabled && action.type !== 'PAUSE')) return;
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
    for (const alternative of alternatives(document)) {
      const other = controls.querySelector<HTMLElement>(`[data-other-path="${alternative.id}"]`)!;
      other.textContent = `Other path: ${alternative.cases.find(branch => branch.id !== choices[alternative.id])!.label}`;
    }
    const active = current ? new Set(current.kind === 'message' ? [current.from, current.to] : current.participants) : new Set();
    for (const node of svg.querySelectorAll('[data-seq-participant]')) {
      node.setAttribute('data-active', String(active.has(node.getAttribute('data-seq-participant')!)));
    }
    svg.setAttribute('data-focus', String(focus && index > 0));
    status.textContent = current ? `${index} / ${steps.length} — ${current.text}` : `Overview · 0 / ${steps.length}`;
    status.setAttribute('aria-live', state.playing ? 'off' : 'polite');
    details.textContent = current ? current.kind === 'message' ? `${current.from} → ${current.to}` : `Note · ${current.participants.join(', ')}` : 'No current step · all paths keep their original layout.';
    previous.disabled = !enabled || index === 0; next.disabled = !enabled || index === steps.length;
    play.textContent = state.playing ? 'Pause' : 'Play';
    play.disabled = !enabled || steps.length === 0;
    reset.disabled = !enabled; focusButton.disabled = !focusEnabled;
    for (const select of controls.querySelectorAll('select')) select.disabled = !enabled;
    focusButton.setAttribute('aria-pressed', String(focus));
    if (current && enabled) {
      const container = root.querySelector<HTMLElement>('[data-diagram]')!;
      const boxes = Array.from(svg.querySelectorAll('[data-phase="current"]'), element => element.getBoundingClientRect());
      const item = { left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
        top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)) };
      // For an oversized step, reveal its lowest bound element. This keeps the
      // end of a wrapped message visible without relying on renderer DOM order.
      const anchor = boxes.reduce((lowest, box) => box.bottom > lowest.bottom ? box : lowest);
      if (item.bottom - item.top > container.clientHeight) { item.top = anchor.top; item.bottom = anchor.bottom; }
      if (item.right - item.left > container.clientWidth) { item.left = anchor.left; item.right = anchor.right; }
      const viewport = container.getBoundingClientRect();
      const left = item.left < viewport.left || item.right > viewport.right
        ? container.scrollLeft + (item.left + item.right - viewport.left - viewport.right) / 2 : container.scrollLeft;
      const top = item.top < viewport.top || item.bottom > viewport.bottom
        ? container.scrollTop + (item.top + item.bottom - viewport.top - viewport.bottom) / 2 : container.scrollTop;
      if (left !== container.scrollLeft || top !== container.scrollTop) container.scrollTo({ left, top,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  const visibility = () => { if (window.document.hidden) dispatch({ type: 'PAUSE' }); };
  window.document.addEventListener('visibilitychange', visibility);
  const keyboard = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || target.closest('textarea, input, select, [contenteditable]:not([contenteditable="false"])')
      || (event.code === 'Space' && (event.repeat || target.closest('button')))) return;
    const actions: Record<string, HTMLButtonElement> = { ArrowLeft: previous, ArrowRight: next, Space: play, Home: reset };
    const button = actions[event.code];
    if (button) { event.preventDefault(); if (!button.disabled) button.click(); }
  };
  root.addEventListener('keydown', keyboard);
  update();
  return {
    snapshot: () => ({ ...state, total: steps.length, focus, choices: { ...state.choices }, stepIds: steps.map(step => step.id) }),
    seek: (index: number) => dispatch({ type: 'SEEK', index }),
    setEnabled: (value: boolean, allowFocus = value) => {
      if (destroyed) return;
      enabled = value; focusEnabled = allowFocus;
      if (!enabled) dispatch({ type: 'PAUSE' }); else update();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true; pause(); state = { ...state, playing: false };
      window.document.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('keydown', keyboard); details.remove(); controls.replaceChildren();
    },
  };
}
