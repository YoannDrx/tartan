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
  unit?: ExerciseGuide["counting"]["unit"];
  objective: string;
  setup: string;
  steps: [string, string, ...string[]];
  mistakes: [string, ...string[]];
  easier: string;
  progression: string;
  breathing?: string;
};

export type FamilyDraft = Omit<CatalogueDraft, "family" | "category">;
