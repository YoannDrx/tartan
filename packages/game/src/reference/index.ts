import { hurdles } from "../events/hurdles";
import { longJump } from "../events/long-jump";
import { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS } from "./hurdles";
import { LONG_JUMP_FUZZ, LONG_JUMP_REFERENCE_RUNS } from "./long-jump";

export { fuzzLog, fuzzSummary } from "./fuzz";
export { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS, type ReferenceRun } from "./hurdles";
export { LONG_JUMP_FUZZ, LONG_JUMP_REFERENCE_RUNS } from "./long-jump";

// Toutes les épreuves et leurs parties de référence : la preuve inter-moteurs les rejoue toutes.
export const REFERENCES = [
  { event: hurdles, runs: HURDLES_REFERENCE_RUNS, fuzz: HURDLES_FUZZ },
  { event: longJump, runs: LONG_JUMP_REFERENCE_RUNS, fuzz: LONG_JUMP_FUZZ },
] as const;
