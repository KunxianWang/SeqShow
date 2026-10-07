import { resolve } from 'node:path';
import { defineConfig, normalizePath } from 'vite';
import { buildPlayer } from './scripts/build-player.mjs';

const virtualId = 'virtual:seqshow-export-player';
const resolvedId = `\0${virtualId}`;

export default defineConfig(({ command }) => {
  let playerInputs = new Set<string>();
  return {
    base: './',
    build: { target: 'es2024' },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    plugins: [{
      name: 'seqshow-export-player',
      resolveId(id) { if (id === virtualId) return resolvedId; },
      async load(id) {
        if (id !== resolvedId) return;
        const { code, inputs } = await buildPlayer();
        playerInputs = new Set(inputs.map(input => normalizePath(resolve(input))));
        playerInputs.forEach(input => this.addWatchFile(input));
        if (command === 'build') this.emitFile({ type: 'asset', fileName: 'export-player.js', source: code });
        return `export default ${JSON.stringify(code)};`;
      },
      handleHotUpdate({ file, server }) {
        if (!playerInputs.has(normalizePath(file))) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
        return [];
      },
    }],
  };
});
