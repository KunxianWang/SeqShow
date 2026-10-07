import { mountPlayer } from './player';

const data = JSON.parse(document.getElementById('seqshow-data')!.textContent!);
mountPlayer(document.querySelector<HTMLElement>('[data-player]')!, data.model, data.choices);
