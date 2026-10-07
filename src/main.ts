import './player.css';
import css from './player.css?raw';
import runtime from 'virtual:seqshow-export-player';
import { loginExample } from './examples';
import { renderSequence } from './renderer/mermaid-adapter';
import { mountPlayer } from './player';
import { exportHtml } from './export';

const root = document.querySelector<HTMLElement>('[data-player]')!;
const download = root.querySelector<HTMLButtonElement>('[data-export]')!;
const error = root.querySelector<HTMLElement>('[data-error]')!;
let player: ReturnType<typeof mountPlayer> | undefined;

async function start() {
  const svg = await renderSequence(loginExample);
  root.querySelector('[data-diagram]')!.replaceChildren(svg);
  player = mountPlayer(root, loginExample);
  download.disabled = false;
  download.onclick = () => {
    try {
      const html = exportHtml(svg, loginExample, player!.snapshot().choices, runtime, css);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'seqshow-login.html'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      error.textContent = '';
    } catch (reason) { error.textContent = `Export failed: ${String(reason)}`; }
  };
}

start().catch(reason => {
  root.querySelector('[data-status]')!.textContent = 'Example could not load.';
  error.textContent = String(reason);
});

if (import.meta.hot) import.meta.hot.dispose(() => player?.destroy());
