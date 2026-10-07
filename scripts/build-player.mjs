import { build } from 'esbuild';
import assert from 'node:assert/strict';

export async function buildPlayer() {
  const result = await build({
    entryPoints: ['src/export-player.ts'], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2024', minify: true, metafile: true,
  });
  const code = result.outputFiles[0].text;
  const inputs = Object.keys(result.metafile.inputs);
  assert(inputs.every(input => !input.includes('node_modules/')), 'Offline player must have no runtime package dependency');
  assert(!/mermaid|katex|https?:\/\//iu.test(code), 'Offline player must have no Mermaid or remote dependency');
  return { code, inputs };
}
