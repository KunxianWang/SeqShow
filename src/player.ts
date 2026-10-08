import { allSteps, alternatives, type BranchChoices, type SequenceDocument } from './core/model';
import { deriveSteps, initialPlayback, transition, type PlaybackAction } from './core/playback';

// Icons are built from local path data: the exported file must not reference resources.
const icons = {
  previous: 'm15 18-6-6 6-6', next: 'm9 18 6-6-6-6', reset: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5',
  play: 'M7 5.6v12.8a.7.7 0 0 0 1.05.6l10.2-6.4a.7.7 0 0 0 0-1.2L8.05 5A.7.7 0 0 0 7 5.6z', pause: 'M6.5 5h4v14h-4zM13.5 5h4v14h-4z',
};
const placements = { over: 'Over', left: 'Left of', right: 'Right of' };

export function mountPlayer(root: HTMLElement, document: SequenceDocument, initialChoices?: BranchChoices) {
  const page = window.document;
  const svg = root.querySelector<SVGSVGElement>('[data-diagram] svg')!;
  const diagram = svg.parentElement!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  // Hosts without a dedicated dock (e.g. the M0 harness) keep every control together.
  const transport = root.querySelector<HTMLElement>('[data-transport]') ?? controls;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = page.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const meta = root.querySelector<HTMLElement>('[data-step-meta]') ?? element('p', 'step-meta');
  if (!meta.isConnected) status.after(meta);
  const kind = element('span', 'step-kind');
  kind.dataset.stepKind = '';
  const details = element('span');
  details.dataset.stepDetails = '';
  meta.replaceChildren(kind, details);
  const underlay = element('div', 'diagram-underlay'), overlay = element('div', 'diagram-overlay');
  const badge = element('span', 'step-badge');
  underlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('aria-hidden', 'true');
  overlay.append(badge); diagram.prepend(underlay); diagram.append(overlay);
  root.tabIndex = 0;
  let state = initialPlayback(document, initialChoices);
  let steps = deriveSteps(document, state.choices);
  let focus = true;
  let enabled = true, focusEnabled = true, destroyed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const labels = new Map(document.participants.map(actor => [actor.id, actor.label]));
  controls.replaceChildren(); transport.replaceChildren();
  const pause = () => { clearInterval(timer); timer = undefined; };
  const icon = (name: keyof typeof icons) => {
    // Borrow the diagram's namespace: the offline bundle must not contain URL literals.
    const graphic = page.createElementNS(svg.namespaceURI, 'svg') as SVGSVGElement;
    graphic.setAttribute('viewBox', '0 0 24 24'); graphic.setAttribute('aria-hidden', 'true');
    graphic.classList.add('player-icon');
    const path = page.createElementNS(svg.namespaceURI, 'path');
    graphic.append(path); setIcon(graphic, name);
    return graphic;
  };
  function setIcon(graphic: SVGSVGElement, name: keyof typeof icons) {
    graphic.firstElementChild!.setAttribute('d', icons[name]);
    graphic.toggleAttribute('data-filled', name === 'play' || name === 'pause');
  }
  const button = (name: string, host: HTMLElement, action: () => void, glyph?: keyof typeof icons) => {
    const node = element('button');
    node.type = 'button'; node.dataset.action = name.toLowerCase(); node.onclick = action;
    const label = element('span', 'player-label', name);
    node.append(...glyph === 'next' ? [label, icon(glyph)] : glyph ? [icon(glyph), label] : [label]);
    host.append(node); return node;
  };
  const paths = element('div', 'player-paths');
  controls.append(paths);
  for (const [ordinal, alternative] of alternatives(document).entries()) {
    const label = element('label', 'player-path');
    const head = element('span', 'player-path-head');
    const other = element('span', 'player-other');
    other.dataset.otherPath = alternative.id;
    head.append(element('span', 'player-path-name', `Path ${ordinal + 1}`), other);
    const select = element('select');
    select.dataset.branch = alternative.id;
    for (const branch of alternative.cases) {
      const option = element('option', '', branch.label);
      option.value = branch.id;
      select.append(option);
    }
    select.value = state.choices[alternative.id];
    select.onchange = () => dispatch({ type: 'CHOOSE_BRANCH', id: alternative.id, caseId: select.value });
    label.append(head, select); paths.append(label);
  }
  const focusButton = button('Focus', controls, () => { if (!destroyed && focusEnabled) { focus = !focus; update(); } });
  focusButton.classList.add('player-switch');
  focusButton.prepend(element('span', 'player-switch-track'));
  focusButton.firstElementChild!.setAttribute('aria-hidden', 'true');
  const previous = button('Previous', transport, () => dispatch({ type: 'PREVIOUS' }), 'previous');
  const play = button('Play', transport, () => dispatch({ type: state.playing ? 'PAUSE' : 'PLAY' }), 'play');
  const next = button('Next', transport, () => dispatch({ type: 'NEXT' }), 'next');
  const reset = button('Reset', transport, () => dispatch({ type: 'RESET' }), 'reset');
  play.classList.add('primary', 'player-play'); reset.classList.add('player-ghost');
  const playIcon = play.querySelector<SVGSVGElement>('svg')!, playLabel = play.querySelector('.player-label')!;

  // Case shading lives outside the SVG so exported geometry and step bindings stay unchanged.
  const regions = alternatives(document).flatMap(alternative => alternative.cases.map((branch, index) => {
    const region = element('div', 'case-region');
    underlay.append(region);
    return { alternative: alternative.id, branch: branch.id, index, region };
  }));
  function layout() {
    const box = svg.getBoundingClientRect(), host = diagram.getBoundingClientRect();
    if (!box.width || !box.height) return;
    for (const layer of [underlay, overlay]) Object.assign(layer.style, {
      left: `${box.left - host.left - diagram.clientLeft + diagram.scrollLeft}px`,
      top: `${box.top - host.top - diagram.clientTop + diagram.scrollTop}px`,
      width: `${box.width}px`, height: `${box.height}px`,
    });
    const percent = (value: number, start: number, size: number) => `${(value - start) / size * 100}%`;
    for (const { alternative, index, region } of regions) {
      const frame = Array.from(svg.querySelectorAll(`[data-seq-frame="${alternative}"]`), line => line.getBoundingClientRect());
      const divider = svg.querySelector(`[data-seq-divider="${alternative}"]`)?.getBoundingClientRect();
      region.hidden = !frame.length || !divider;
      if (!frame.length || !divider) continue;
      const left = Math.min(...frame.map(line => line.left)), right = Math.max(...frame.map(line => line.right));
      const top = index === 0 ? Math.min(...frame.map(line => line.top)) : divider.top;
      const bottom = index === 0 ? divider.top : Math.max(...frame.map(line => line.bottom));
      Object.assign(region.style, {
        left: percent(left, box.left, box.width), width: percent(right, left, box.width),
        top: percent(top, box.top, box.height), height: percent(bottom, top, box.height),
      });
    }
  }
  function placeBadge(id?: string) {
    const shape = id ? svg.querySelector(`[data-seq-shape="${CSS.escape(id)}"]`) : null;
    const box = svg.getBoundingClientRect();
    badge.hidden = !shape || !box.width;
    if (!shape || !box.width) return;
    const target = shape.getBoundingClientRect();
    // Sit just left of the step; clamp so a step at the diagram edge keeps its marker visible.
    const x = Math.max(12, target.left - box.left - 14), y = target.top - box.top + target.height / 2;
    Object.assign(badge.style, { left: `${x / box.width * 100}%`, top: `${y / box.height * 100}%` });
  }
  const resize = new ResizeObserver(() => { layout(); placeBadge(steps[state.index - 1]?.id); });
  resize.observe(svg);

  function dispatch(action: PlaybackAction) {
    if (destroyed || (!enabled && action.type !== 'PAUSE')) return;
    state = transition(document, state, action);
    steps = deriveSteps(document, state.choices);
    if (!state.playing) pause();
    else if (timer === undefined) timer = setInterval(() => dispatch({ type: 'TICK' }), 1500);
    update();
  }
  const chip = (id: string) => element('span', 'participant-chip', labels.get(id) ?? id);
  const part = (className: string, text: string) => element('span', className, text);
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
    for (const { alternative, branch, region } of regions) region.dataset.selected = String(choices[alternative] === branch);
    for (const alternative of alternatives(document)) {
      const other = controls.querySelector<HTMLElement>(`[data-other-path="${alternative.id}"]`)!;
      other.textContent = `Other path: ${alternative.cases.find(branch => branch.id !== choices[alternative.id])!.label}`;
    }
    const active = current ? new Set(current.kind === 'message' ? [current.from, current.to] : current.participants) : new Set();
    for (const node of svg.querySelectorAll('[data-seq-participant]')) {
      node.setAttribute('data-active', String(active.has(node.getAttribute('data-seq-participant')!)));
    }
    svg.setAttribute('data-focus', String(focus && index > 0));
    // Spans only style the counter; the live region's text stays "k / N — text".
    status.replaceChildren(...current
      ? [part('step-count', String(index)), part('step-total', ` / ${steps.length}`), part('step-sep', ' — '), part('step-text', current.text)]
      : [part('step-text', 'Overview'), part('step-sep', ' · '), part('step-count', '0'), part('step-total', ` / ${steps.length}`)]);
    status.toggleAttribute('data-overview', !current);
    status.setAttribute('aria-live', state.playing ? 'off' : 'polite');
    kind.hidden = !current;
    kind.textContent = !current ? '' : current.kind === 'note' ? 'Note' : current.from === current.to ? 'Self call' : 'Message';
    if (!current) details.textContent = 'No current step · all paths keep their original layout.';
    else if (current.kind === 'message') details.replaceChildren(chip(current.from), ' → ', chip(current.to));
    else details.replaceChildren(`${placements[current.placement]} `, ...current.participants.flatMap((id, n) => n ? [', ', chip(id)] : [chip(id)]));
    previous.disabled = !enabled || index === 0; next.disabled = !enabled || index === steps.length;
    playLabel.textContent = state.playing ? 'Pause' : 'Play';
    setIcon(playIcon, state.playing ? 'pause' : 'play');
    play.disabled = !enabled || steps.length === 0;
    reset.disabled = !enabled; focusButton.disabled = !focusEnabled;
    for (const select of controls.querySelectorAll('select')) select.disabled = !enabled;
    focusButton.setAttribute('aria-pressed', String(focus));
    badge.textContent = current ? String(index) : '';
    placeBadge(current?.id);
    if (current && enabled) {
      const boxes = Array.from(svg.querySelectorAll('[data-phase="current"]'), node => node.getBoundingClientRect());
      const item = { left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
        top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)) };
      // For an oversized step, reveal its lowest bound element. This keeps the
      // end of a wrapped message visible without relying on renderer DOM order.
      const anchor = boxes.reduce((lowest, box) => box.bottom > lowest.bottom ? box : lowest);
      if (item.bottom - item.top > diagram.clientHeight) { item.top = anchor.top; item.bottom = anchor.bottom; }
      if (item.right - item.left > diagram.clientWidth) { item.left = anchor.left; item.right = anchor.right; }
      const viewport = diagram.getBoundingClientRect();
      const left = item.left < viewport.left || item.right > viewport.right
        ? diagram.scrollLeft + (item.left + item.right - viewport.left - viewport.right) / 2 : diagram.scrollLeft;
      const top = item.top < viewport.top || item.bottom > viewport.bottom
        ? diagram.scrollTop + (item.top + item.bottom - viewport.top - viewport.bottom) / 2 : diagram.scrollTop;
      if (left !== diagram.scrollLeft || top !== diagram.scrollTop) diagram.scrollTo({ left, top,
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
  layout();
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
      root.removeEventListener('keydown', keyboard); resize.disconnect();
      underlay.remove(); overlay.remove(); meta.replaceChildren();
      if (!root.querySelector('[data-step-meta]')) meta.remove();
      controls.replaceChildren(); transport.replaceChildren();
    },
  };
}
