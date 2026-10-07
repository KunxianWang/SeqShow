import { expect, test } from 'vitest';
import { defaultChoices, deriveSteps } from '../../src/core/playback';
import { fixtures } from '../m0/fixtures';

test.each(fixtures)('$id: default path and each authored branch path retain the expected step IDs', fixture => {
  expect(deriveSteps(fixture.model, defaultChoices(fixture.model)).map(step => step.id)).toEqual(fixture.paths[0].ids);
  for (const path of fixture.paths) {
    expect(deriveSteps(fixture.model, path.choices).map(step => step.id)).toEqual(path.ids);
  }
});

test('an invalid branch cannot silently select an unrelated path', () => {
  const login = fixtures.find(fixture => fixture.id === 'login')!;
  expect(() => deriveSteps(login.model, { auth: 'unknown' })).toThrow('Unknown branch for auth');
});
