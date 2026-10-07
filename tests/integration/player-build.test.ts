import { expect, test } from 'vitest';
import { buildPlayer } from '../../scripts/build-player.mjs';

test('the export entry bundles shared playback into one dependency-free script', async () => {
  const { code, inputs } = await buildPlayer();
  expect(inputs).toContain('src/player.ts');
  expect(inputs).toContain('src/core/playback.ts');
  expect(inputs).not.toContain('src/core/parser.ts');
  expect(inputs.every(input => input.startsWith('src/'))).toBe(true);
  expect(code).not.toMatch(/\bimport\s|\brequire\s*\(|mermaid|katex|https?:\/\//iu);
  expect(code).not.toMatch(/<\/script/iu);
});
