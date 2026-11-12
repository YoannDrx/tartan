import type { AthleteId } from "@tartan/mascot/athletes";

// L'athlète qui accompagne chaque rubrique (DESIGN.md, « Le groupe »). Les rubriques que la table ne nomme pas
// prennent celui de la rubrique la plus proche : les athlètes vont avec le suivi, les phases avec le calendrier,
// le planificateur et l'accueil de l'athlète avec les séances.
export const RUBRIC_ATHLETE = {
  calendrier: "hurdles",
  phases: "hurdles",
  annonces: "hurdles",
  progres: "poleVault",
  seances: "tripleJump",
  planificateur: "tripleJump",
  aujourdhui: "tripleJump",
  exercices: "discus",
  suivi: "longJump",
  athletes: "longJump",
  videos: "highJump",
} as const satisfies Record<string, AthleteId>;

export type Rubric = keyof typeof RUBRIC_ATHLETE;
