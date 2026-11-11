import { MAX_LOG_EVENTS, MAX_TICKS, SIM_VERSION } from "./constants";
import { MAX_ENTRY, entryChannel, entryDelta, entryPress } from "./log";
import { DIGEST_START, type GameEvent, type SimState, digestState, isValidSeed } from "./sim";

export type ReplayError =
  // La graine n'est pas un entier non signé sur 32 bits.
  | "invalid-seed"
  // Le journal n'est pas un tableau.
  | "malformed-log"
  // Plus de 2 000 changements d'appui.
  | "too-many-events"
  // Une entrée n'est pas un entier dans les bornes.
  | "malformed-entry"
  // L'épreuve ne lit pas ce canal.
  | "unknown-channel"
  // Un changement tombe au-delà des 90 s.
  | "too-long"
  // Appui sur un canal déjà tenu, relâchement d'un canal libre, ou deux changements du même canal au même pas.
  | "repeated-transition"
  // Un changement est daté après la fin de la partie.
  | "input-after-finish"
  // La partie n'est pas finie au bout des 90 s.
  | "unfinished";

export type ReplayResult<S extends SimState> =
  | {
      readonly ok: true;
      readonly version: number;
      readonly score: number;
      // Nombre de pas joués jusqu'à la fin.
      readonly ticks: number;
      // Empreinte de tous les états traversés, non signée.
      readonly digest: number;
      readonly state: S;
    }
  // `index` désigne l'entrée fautive, ou -1 quand la faute ne tient pas à une entrée.
  | { readonly ok: false; readonly error: ReplayError; readonly index: number };

const refuse = (error: ReplayError, index = -1) => ({ ok: false, error, index }) as const;

// Rejoue un journal complet et calcule le score. C'est la seule source de vérité d'un classement :
// le serveur ne reçoit que la graine et le journal, jamais le score.
// Un journal n'a qu'une écriture valide : tout ce qui est redondant ou hors bornes est refusé.
export function replay<S extends SimState>(
  event: GameEvent<S>,
  seed: number,
  inputs: readonly number[],
): ReplayResult<S> {
  if (!isValidSeed(seed)) return refuse("invalid-seed");
  const log: unknown = inputs;
  if (!Array.isArray(log)) return refuse("malformed-log");
  if (log.length > MAX_LOG_EVENTS) return refuse("too-many-events");

  let state = event.init(seed);
  let digest = digestState(DIGEST_START, state);
  let held = 0;
  // Canaux déjà modifiés au pas courant.
  let touched = 0;

  for (let index = 0; index < log.length; index += 1) {
    const entry: unknown = log[index];
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > MAX_ENTRY) {
      return refuse("malformed-entry", index);
    }
    const channel = entryChannel(entry);
    if (channel >= event.channels) return refuse("unknown-channel", index);
    const delta = entryDelta(entry);
    const target = state.tick + delta;
    if (target >= MAX_TICKS) return refuse("too-long", index);
    if (delta > 0) touched = 0;
    const bit = 1 << channel;
    if ((touched & bit) !== 0 || ((held & bit) !== 0) === entryPress(entry)) {
      return refuse("repeated-transition", index);
    }
    while (state.tick < target && !state.finished) {
      state = event.step(state, held);
      digest = digestState(digest, state);
    }
    if (state.finished) return refuse("input-after-finish", index);
    held ^= bit;
    touched |= bit;
  }

  while (!state.finished && state.tick < MAX_TICKS) {
    state = event.step(state, held);
    digest = digestState(digest, state);
  }
  if (!state.finished || state.score === null) return refuse("unfinished");

  return { ok: true, version: SIM_VERSION, score: state.score, ticks: state.tick, digest: digest >>> 0, state };
}
