import { hurdles } from "../events/hurdles";
import { longJump } from "../events/long-jump";
import { tripleJump } from "../events/triple-jump";
import { highJump } from "../events/high-jump";
import { poleVault } from "../events/pole-vault";
import { discus } from "../events/discus";
import { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS } from "./hurdles";
import { LONG_JUMP_FUZZ, LONG_JUMP_REFERENCE_RUNS } from "./long-jump";
import { TRIPLE_JUMP_FUZZ, TRIPLE_JUMP_REFERENCE_RUNS } from "./triple-jump";
import { HIGH_JUMP_FUZZ, HIGH_JUMP_REFERENCE_RUNS } from "./high-jump";
import { POLE_VAULT_FUZZ, POLE_VAULT_REFERENCE_RUNS } from "./pole-vault";
import { DISCUS_FUZZ, DISCUS_REFERENCE_RUNS } from "./discus";

export { fuzzLog, fuzzSummary } from "./fuzz";
export { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS, type ReferenceRun } from "./hurdles";
export { LONG_JUMP_FUZZ, LONG_JUMP_REFERENCE_RUNS } from "./long-jump";
export { TRIPLE_JUMP_FUZZ, TRIPLE_JUMP_REFERENCE_RUNS } from "./triple-jump";
export { HIGH_JUMP_FUZZ, HIGH_JUMP_REFERENCE_RUNS } from "./high-jump";
export { POLE_VAULT_FUZZ, POLE_VAULT_REFERENCE_RUNS } from "./pole-vault";
export { DISCUS_FUZZ, DISCUS_REFERENCE_RUNS } from "./discus";

// Toutes les épreuves et leurs parties de référence : la preuve inter-moteurs les rejoue toutes.
export const REFERENCES = [
  { event: hurdles, runs: HURDLES_REFERENCE_RUNS, fuzz: HURDLES_FUZZ },
  { event: longJump, runs: LONG_JUMP_REFERENCE_RUNS, fuzz: LONG_JUMP_FUZZ },
  { event: tripleJump, runs: TRIPLE_JUMP_REFERENCE_RUNS, fuzz: TRIPLE_JUMP_FUZZ },
  { event: highJump, runs: HIGH_JUMP_REFERENCE_RUNS, fuzz: HIGH_JUMP_FUZZ },
  { event: poleVault, runs: POLE_VAULT_REFERENCE_RUNS, fuzz: POLE_VAULT_FUZZ },
  { event: discus, runs: DISCUS_REFERENCE_RUNS, fuzz: DISCUS_FUZZ },
] as const;
