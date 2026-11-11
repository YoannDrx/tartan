// Noyau de simulation de Tartan Meeting. Déterministe : pas fixe de 120 Hz, entiers 32 bits,
// aucune horloge, aucun hasard hors graine. Le même journal donne le même score sur tout moteur.
// Les épreuves s'importent par leur propre chemin (`@tartan/game/events/hurdles`), pour qu'une
// page ne charge que la sienne.
export { MAX_CHANNELS, MAX_LOG_EVENTS, MAX_SEED, MAX_TICKS, SIM_VERSION, TICK_HZ } from "./core/constants";
export {
  MAX_ENTRY,
  type Transition,
  decodeLog,
  encodeEntry,
  encodeLog,
  entryChannel,
  entryDelta,
  entryPress,
} from "./core/log";
export { type ReplayError, type ReplayResult, replay } from "./core/replay";
export { rngNext, rngSeed } from "./core/rng";
export {
  type Edges,
  type EventRules,
  type GameEvent,
  type Input,
  type SimState,
  defineEvent,
  digestState,
  isPlausibleScore,
  isValidSeed,
} from "./core/sim";
