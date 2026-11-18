import { exerciseGuide, type ExerciseConciseGuide, type ExerciseGuide, type ExerciseFamily } from "@tartan/contracts";
import { CONCISE_APPROVED_FAMILIES, CONCISE_BY_FAMILY } from "./exercise-catalog/concise";
import { STARTER_LIBRARY, type StarterExercise } from "./starter-library";
import type { CatalogueDraft } from "./exercise-catalog/types";
import { STRENGTH_CATALOG } from "./exercise-catalog/strength";
import { WEIGHTLIFTING_CATALOG } from "./exercise-catalog/weightlifting";
import { MOBILITY_CATALOG } from "./exercise-catalog/mobility";
import { PLYOMETRICS_CATALOG } from "./exercise-catalog/plyometrics";
import { RUNNING_CATALOG } from "./exercise-catalog/running";
import { CORE_CATALOG } from "./exercise-catalog/core";
import { COORDINATION_CATALOG } from "./exercise-catalog/coordination";
import { STAIRS_CATALOG } from "./exercise-catalog/stairs";
import { VARIANTS_CATALOG } from "./exercise-catalog/variants";
import { WARMUP_CATALOG } from "./exercise-catalog/warmup";

export const EXERCISE_CATALOG_VERSION = 5;
export type CatalogExercise = StarterExercise & { catalogKey: string; catalogVersion: number; guide: ExerciseGuide };

const familyTags: Record<ExerciseFamily, string[]> = {
  strength: ["Force"],
  weightlifting: ["Force", "Puissance", "Haltérophilie"],
  mobility: ["Mobilité"],
  plyometrics: ["Puissance"],
  running: ["Vitesse", "Course"],
  core: ["Force", "Gainage"],
  coordination: ["Coordination"],
  stairs: ["Escaliers"],
  warmup: ["Échauffement"],
};

const countingExplanation = (entry: CatalogueDraft) => {
  const unit = entry.unit ?? "repetitions";
  const base = {
    repetitions:
      entry.key === "clean-and-jerk"
        ? "Une répétition comprend un épaulé et un jeté terminés."
        : "Une répétition correspond à un cycle complet du mouvement décrit.",
    seconds: "Le temps indiqué correspond à la durée de maintien ou d'effort, récupération exclue.",
    meters: "La distance indiquée correspond au parcours d'effort, retour de récupération exclu.",
    contacts:
      "Un contact correspond à une réception ; une réception simultanée sur les deux pieds compte pour un contact.",
    steps: "Une unité correspond à une marche franchie ; la descente de récupération n'est pas incluse.",
  }[unit];
  return `${base} ${entry.sides === "each_side" ? "La quantité prescrite est à réaliser de chaque côté." : entry.sides === "alternating_total" ? "La quantité est un total, côtés alternés ; elle n'est pas à doubler." : "La quantité indiquée est le total de la série."}`;
};

const loadExplanation = (entry: CatalogueDraft, loadKind: StarterExercise["strengthLoadKind"]) => {
  if (loadKind === "bodyweight")
    return "Poids du corps : ne saisis pas ta masse corporelle comme charge. Un ajout de lest demande une convention distincte.";
  if (loadKind === "external_total") {
    if (entry.equipment.includes("barbell"))
      return "Charge totale en kg : barre et disques inclus, sans la masse corporelle.";
    if (entry.equipment.includes("dumbbells"))
      return "Charge externe totale en kg : additionne les haltères utilisés simultanément. Avec un seul haltère, indique sa masse.";
    if (entry.equipment.includes("medicine_ball")) return "Indique la masse du ballon en kg, sans la masse corporelle.";
    return "Indique la charge externe affichée en kg ; les valeurs de machines différentes ne sont pas directement comparables.";
  }
  return entry.equipment.includes("bands")
    ? "La résistance de l'élastique n'est pas une charge en kg : précise le modèle et la tension dans les consignes."
    : "Aucune charge externe n'est définie pour cette fiche ; ne renseigne pas la masse corporelle en kg.";
};

const buildEntry = (entry: CatalogueDraft): CatalogExercise => {
  const previous = STARTER_LIBRARY.find((old) => old.name === entry.name);
  const strengthLoadKind = previous ? previous.strengthLoadKind : entry.loadKind;
  const guide = exerciseGuide.parse({
    catalogKey: entry.key,
    version: EXERCISE_CATALOG_VERSION,
    family: entry.family,
    level: entry.level,
    objective: entry.objective,
    setup: [entry.setup],
    steps: entry.steps,
    breathing:
      entry.breathing ??
      (entry.family === "strength"
        ? "Prépare le tronc avant la répétition et garde une respiration contrôlée ; évite une apnée prolongée sur toute la série."
        : null),
    mistakes: entry.mistakes,
    easier: entry.easier,
    progression: entry.progression,
    counting: {
      unit: entry.unit ?? "repetitions",
      sides: entry.sides ?? "total",
      explanation: countingExplanation(entry),
    },
    loadExplanation: loadExplanation(entry, strengthLoadKind),
    illustration: {
      status: "draft",
      path: `/exercise-guides/${entry.key}-v${EXERCISE_CATALOG_VERSION}.svg`,
      alt: `${entry.name} : positions clés du mouvement, de l'installation à la fin du geste.`,
      positions: [entry.setup, ...entry.steps],
      source: "tartan-original",
      rights: "Tartan",
    },
    technicalReview: entry.review ?? "approved",
  });
  return {
    catalogKey: entry.key,
    catalogVersion: EXERCISE_CATALOG_VERSION,
    name: entry.name,
    aliases: [...new Set([...(previous?.aliases ?? []), ...entry.aliases])],
    category: previous?.category ?? entry.category,
    classification: { movement: entry.movement, equipment: entry.equipment },
    tags: [...new Set([...(previous?.tags ?? []), ...familyTags[entry.family]])],
    cues: previous?.cues ?? entry.steps.slice(0, 2),
    strengthLoadKind,
    prescription: previous?.prescription ?? {},
    guide,
  };
};

export const EXERCISE_CATALOG: CatalogExercise[] = [
  ...STRENGTH_CATALOG,
  ...WEIGHTLIFTING_CATALOG,
  ...MOBILITY_CATALOG,
  ...PLYOMETRICS_CATALOG,
  ...RUNNING_CATALOG,
  ...CORE_CATALOG,
  ...COORDINATION_CATALOG,
  ...STAIRS_CATALOG,
  ...WARMUP_CATALOG,
  ...VARIANTS_CATALOG,
].map(buildEntry);

export const catalogExerciseByKey = (key: string) => EXERCISE_CATALOG.find((exercise) => exercise.catalogKey === key);

/** La version concise du guide d'une fiche du catalogue, prête à afficher ; `null` pour une clé inconnue. */
export const conciseGuideFor = (key: string): ExerciseConciseGuide | null => {
  const entry = catalogExerciseByKey(key);
  const draft = entry ? CONCISE_BY_FAMILY[entry.guide.family][key] : undefined;
  if (!entry || !draft) return null;
  const variant = (text: string | null, target: string | undefined) =>
    text === null ? null : { text, catalogKey: target ?? null };
  return {
    objective: draft.objective,
    setup: draft.setup,
    steps: draft.steps,
    mistakes: draft.mistakes,
    easier: variant(draft.easier, draft.easierKey),
    harder: variant(draft.harder, draft.harderKey),
    review: CONCISE_APPROVED_FAMILIES.includes(entry.guide.family) ? "approved" : "review",
  };
};

/**
 * Le guide enregistré dit-il encore mot pour mot le texte du catalogue ? Seul ce texte a une version concise :
 * un guide qu'un coach a réécrit s'affiche tel qu'il l'a écrit.
 */
export const guideMatchesCatalog = (
  guide: Pick<ExerciseGuide, "catalogKey" | "objective" | "setup" | "steps" | "mistakes">,
) => {
  const entry = catalogExerciseByKey(guide.catalogKey);
  if (!entry) return false;
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  return (
    entry.guide.objective === guide.objective &&
    same(entry.guide.setup, guide.setup) &&
    same(entry.guide.steps, guide.steps) &&
    same(entry.guide.mistakes, guide.mistakes)
  );
};

export {
  CONCISE_APPROVED_FAMILIES,
  CONCISE_BY_FAMILY,
  CONCISE_RULES,
  conciseProblems,
} from "./exercise-catalog/concise";
