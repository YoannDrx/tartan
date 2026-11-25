import type {
  ExerciseCategory,
  ExerciseClassification,
  ExerciseFamily,
  ExerciseGuide,
  ExerciseInput,
} from "@tartan/contracts";

export type CatalogueDraft = {
  key: string;
  name: string;
  aliases: string[];
  family: ExerciseFamily;
  category: ExerciseCategory;
  movement: NonNullable<ExerciseClassification["movement"]>;
  equipment: NonNullable<ExerciseClassification["equipment"]>;
  level: ExerciseGuide["level"];
  loadKind: NonNullable<ExerciseInput["strengthLoadKind"]> | null;
  sides?: ExerciseGuide["counting"]["sides"];
  countingCue?: string;
  checkpoint?: string;
  unit?: ExerciseGuide["counting"]["unit"];
  objective: string;
  setup: string;
  steps: [string, string, ...string[]];
  mistakes: [string, ...string[]];
  easier: string;
  progression: string;
  breathing?: string;
  // Une fiche ajoutée après la relecture du fondateur reste « en préparation » jusqu'à la sienne.
  review?: "pending";
};

export type FamilyDraft = Omit<CatalogueDraft, "family" | "category">;
