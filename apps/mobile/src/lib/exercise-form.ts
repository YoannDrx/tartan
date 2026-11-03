import { exerciseInput, type ExerciseInput, type Prescription } from "@tartan/contracts";
import { parseInstagramUrl, parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m } from "@tartan/i18n";

export const NUMBER_FIELDS = ["sets", "reps", "distance_m", "duration_s", "rest_s", "ground_contacts"] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];

export type ExerciseDraft = {
  id?: string;
  name: string;
  category: string;
  cues: string;
  // Hors du formulaire mobile : gardés tels quels, l'API remplace ce qu'elle reçoit.
  tags: string[];
  base: Prescription;
  numbers: Record<NumberField, string>;
  url: string;
  title: string;
  startS: string;
  endS: string;
};

export type DraftResult =
  { ok: true; input: ExerciseInput } | { ok: false; field: "name" | "cues" | "url" | "clip" | "form"; message: string };

const toNumber = (value: string): number | undefined => {
  const clean = value.trim().replace(",", ".");
  return clean === "" ? undefined : Number(clean);
};

export const prescriptionFrom = (draft: Pick<ExerciseDraft, "base" | "numbers">): Prescription => {
  const next: Record<string, unknown> = { ...draft.base };
  for (const key of NUMBER_FIELDS) {
    const value = toNumber(draft.numbers[key]);
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as Prescription;
};

export const buildExerciseInput = (draft: ExerciseDraft): DraftResult => {
  if (!draft.name.trim()) return { ok: false, field: "name", message: "Donne un nom à l'exercice" };
  const cues = draft.cues
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cues.length > 5) return { ok: false, field: "cues", message: m.mobile.exerciseForm.tooManyCues };
  if (cues.some((c) => c.length > 120)) return { ok: false, field: "cues", message: m.mobile.exerciseForm.cueTooLong };
  const url = draft.url.trim();
  const customTitle = draft.title.trim() || null;
  let media: ExerciseInput["media"] = null;
  if (parseInstagramUrl(url)) {
    media = { kind: "instagram", url, customTitle };
  } else if (url) {
    if (!parseYouTubeUrl(url)) return { ok: false, field: "url", message: m.exercises.linkInvalid };
    const startS = toNumber(draft.startS) ?? null;
    const endS = toNumber(draft.endS) ?? null;
    if (!validateClipRange(startS, endS)) return { ok: false, field: "clip", message: m.exercises.clipInvalid };
    media = { kind: "youtube", url, customTitle, startS, endS };
  }
  const input: ExerciseInput = {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    category: draft.category as ExerciseInput["category"],
    tags: draft.tags,
    cues,
    defaultPrescription: prescriptionFrom(draft),
    media,
  };
  // Le même contrat que le serveur : un nombre hors bornes s'arrête ici, sans aller-retour.
  return exerciseInput.safeParse(input).success
    ? { ok: true, input }
    : { ok: false, field: "form", message: m.errors.invalid };
};
