import { expect, test } from 'vitest';
import type { SequenceDocument } from '../../src/core/model';
import { deriveSteps, initialPlayback, transition, type PlaybackState, type PlaybackAction } from '../../src/core/playback';
import { parsedFixtures } from '../fixtures/parsed';

const model = parsedFixtures.find(f => f.id === 'parsed-multiple')!.model;
const empty: SequenceDocument = { participants: [], nodes: [] };
function apply(state: PlaybackState, ...actions: PlaybackAction[]) {
  return actions.reduce((state, action) => transition(model, state, action), state);
}

test('overview and clamped manual navigation pause and select the correct current message', () => {
  let state = initialPlayback(model);
  expect(state).toEqual({ index: 0, playing: false, choices: { 'alt:1': 'alt:1:first', 'alt:2': 'alt:2:first' } });
  expect(deriveSteps(model, state.choices)[state.index - 1]).toBeUndefined();
  state = apply(state, { type: 'PREVIOUS' }, { type: 'NEXT' });
  expect(state.index).toBe(1);
  expect(deriveSteps(model, state.choices)[state.index - 1].text).toBe('start');
  state = apply(state, { type: 'PLAY' }, { type: 'NEXT' });
  expect(state).toMatchObject({ index: 2, playing: false });
  state = apply(state, { type: 'PLAY' }, { type: 'PREVIOUS' });
  expect(state).toMatchObject({ index: 1, playing: false });
  state = apply(state, ...Array.from({ length: 8 }, (): PlaybackAction => ({ type: 'NEXT' })));
  expect(state).toMatchObject({ index: 4, playing: false });
  state = apply(state, ...Array.from({ length: 8 }, (): PlaybackAction => ({ type: 'PREVIOUS' })));
  expect(state).toMatchObject({ index: 0, playing: false });
});

test('PLAY starts immediately, pause/resume stays on the current step, and the last tick stops', () => {
  let state = apply(initialPlayback(model), { type: 'PLAY' });
  expect(state).toMatchObject({ index: 1, playing: true });
  state = apply(state, { type: 'PLAY' }, { type: 'TICK' }, { type: 'PAUSE' }, { type: 'TICK' });
  expect(state).toMatchObject({ index: 2, playing: false });
  state = apply(state, { type: 'PLAY' });
  expect(state).toMatchObject({ index: 2, playing: true });
  state = apply(state, { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' });
  expect(state).toMatchObject({ index: 4, playing: false });
  state = apply(state, { type: 'PLAY' });
  expect(state).toMatchObject({ index: 1, playing: true });
});

test.each([['first', 'first', 4], ['first', 'second', 5], ['second', 'first', 5], ['second', 'second', 6]] as const)(
  'branch selection %s/%s resets and pauses with %i steps', (first, second, count) => {
    let state = apply(initialPlayback(model), { type: 'PLAY' }, { type: 'TICK' },
      { type: 'CHOOSE_BRANCH', id: 'alt:1', caseId: `alt:1:${first}` });
    expect(state).toMatchObject({ index: 0, playing: false });
    state = apply(state, { type: 'PLAY' }, { type: 'CHOOSE_BRANCH', id: 'alt:2', caseId: `alt:2:${second}` });
    expect(state).toMatchObject({ index: 0, playing: false });
    expect(deriveSteps(model, state.choices)).toHaveLength(count);
    const choices = { ...state.choices };
    state = apply(state, { type: 'PLAY' }, { type: 'RESET' });
    expect(state).toEqual({ index: 0, playing: false, choices });
  });

test('invalid selections, missing selections and invalid seeks are rejected without mutating the input', () => {
  const state = initialPlayback(model);
  Object.freeze(state); Object.freeze(state.choices);
  expect(() => initialPlayback(model, { 'alt:1': 'bogus' })).toThrow('Unknown branch');
  expect(() => initialPlayback(model, { missing: 'bogus' })).toThrow('Unknown alternative');
  expect(() => deriveSteps(model, {})).toThrow('Unknown branch');
  expect(() => transition(model, state, { type: 'CHOOSE_BRANCH', id: 'alt:1', caseId: 'alt:2:first' })).toThrow('Unknown branch');
  expect(() => transition(model, state, { type: 'CHOOSE_BRANCH', id: 'missing', caseId: 'x' })).toThrow('Unknown alternative');
  for (const index of [-1, 5, 1.5, NaN, Infinity]) expect(() => transition(model, state, { type: 'SEEK', index })).toThrow('Invalid step index');
  expect(transition(model, state, { type: 'SEEK', index: 4 })).toMatchObject({ index: 4, playing: false });
  expect(state.index).toBe(0);
});

test('zero steps cannot start playing and single-step replay stops immediately', () => {
  for (const type of ['PLAY', 'NEXT', 'PREVIOUS', 'RESET', 'TICK'] as const) {
    expect(transition(empty, initialPlayback(empty), { type })).toEqual(initialPlayback(empty));
  }
  const document = parsedFixtures.find(f => f.id === 'parsed-empty-path')!.model;
  const zero = transition(document, initialPlayback(document), { type: 'PLAY' });
  expect(zero).toMatchObject({ index: 0, playing: false });
  const chosen = transition(document, zero, { type: 'CHOOSE_BRANCH', id: 'alt:1', caseId: 'alt:1:second' });
  const single = transition(document, chosen, { type: 'PLAY' });
  expect(single).toMatchObject({ index: 1, playing: false });
  expect(transition(document, single, { type: 'PLAY' })).toEqual(single);
});
