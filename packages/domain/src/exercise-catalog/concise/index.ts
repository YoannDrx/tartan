import type { ExerciseFamily } from "@tartan/contracts";
import { COORDINATION_CONCISE } from "./coordination";
import { CORE_CONCISE } from "./core";
import { MOBILITY_CONCISE } from "./mobility";
import { PLYOMETRICS_CONCISE } from "./plyometrics";
import type { ConciseCatalog } from "./rules";
import { RUNNING_CONCISE } from "./running";
import { STAIRS_CONCISE } from "./stairs";
import { STRENGTH_CONCISE } from "./strength";
import { WARMUP_CONCISE } from "./warmup";
import { WEIGHTLIFTING_CONCISE } from "./weightlifting";

export { CONCISE_RULES, conciseProblems, type ConciseCatalog, type ConciseDraft } from "./rules";

export const CONCISE_BY_FAMILY: Record<ExerciseFamily, ConciseCatalog> = {
  strength: STRENGTH_CONCISE,
  weightlifting: WEIGHTLIFTING_CONCISE,
  mobility: MOBILITY_CONCISE,
  plyometrics: PLYOMETRICS_CONCISE,
  running: RUNNING_CONCISE,
  core: CORE_CONCISE,
  coordination: COORDINATION_CONCISE,
  stairs: STAIRS_CONCISE,
  warmup: WARMUP_CONCISE,
};

/**
 * Les familles dont le fondateur a validé la version concise. Tant qu'une famille n'y est pas, le texte complet
 * qu'il a déjà relu reste accessible sous « Détail ». Une validation s'ajoute ici, par une PR qui le dit.
 */
export const CONCISE_APPROVED_FAMILIES: readonly ExerciseFamily[] = [];
