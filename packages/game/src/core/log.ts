import { MAX_CHANNELS, MAX_TICKS } from "./constants";

// Le journal d'une partie est une suite d'entiers, un par changement d'appui :
//   (deltaTick << 2) | (canal << 1) | appui
// deltaTick : nombre de pas écoulés depuis le changement précédent (depuis le départ pour le premier).
// canal : 0 ou 1. appui : 1 quand le canal s'enfonce, 0 quand il se relâche.
// Un changement daté du pas T vaut pour le pas qui fait passer la partie de T à T + 1.

export interface Transition {
  readonly tick: number;
  readonly channel: number;
  readonly press: boolean;
}

// Plus grande valeur qu'une entrée peut prendre : au-delà, le pas dépasse forcément la durée d'une partie.
export const MAX_ENTRY = ((MAX_TICKS - 1) << 2) | 3;

export const encodeEntry = (deltaTick: number, channel: number, press: boolean): number =>
  (deltaTick << 2) | (channel << 1) | (press ? 1 : 0);

export const entryDelta = (entry: number): number => entry >>> 2;
export const entryChannel = (entry: number): number => (entry >>> 1) & 1;
export const entryPress = (entry: number): boolean => (entry & 1) === 1;

// Côté joueur : passe d'une liste de changements datés au journal à envoyer.
export function encodeLog(transitions: readonly Transition[]): number[] {
  const log: number[] = [];
  let last = 0;
  for (const { tick, channel, press } of transitions) {
    if (!Number.isInteger(tick) || tick < last || tick >= MAX_TICKS) throw new RangeError("invalid transition tick");
    if (!Number.isInteger(channel) || channel < 0 || channel >= MAX_CHANNELS) {
      throw new RangeError("invalid transition channel");
    }
    log.push(encodeEntry(tick - last, channel, press));
    last = tick;
  }
  return log;
}

// Lecture d'un journal déjà validé, pour un fantôme ou une rediffusion.
export function decodeLog(log: readonly number[]): Transition[] {
  const transitions: Transition[] = [];
  let tick = 0;
  for (const entry of log) {
    tick += entryDelta(entry);
    transitions.push({ tick, channel: entryChannel(entry), press: entryPress(entry) });
  }
  return transitions;
}
