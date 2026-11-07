import type { Prescription, SnapshotItem, StrengthTestKind } from "@tartan/contracts";

export const PLATE_STEP_KG = 1.25;

export type StrengthTest = {
  exerciseKey: string;
  value: number;
  kind: StrengthTestKind;
  date: string;
  stepKg?: number;
};

// Formule d'Epley, pour ramener un 3RM à un 1RM estimé.
export const estimatedOneRm = (test: Pick<StrengthTest, "value" | "kind">): number =>
  test.kind === "three_rm" ? test.value * (1 + 3 / 30) : test.value;

export const roundToPlate = (kg: number, step: number = PLATE_STEP_KG): number => Math.round(kg / step) * step;

export const latestTest = (tests: StrengthTest[], exerciseKey: string): StrengthTest | null =>
  tests.filter((t) => t.exerciseKey === exerciseKey).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

// Null = charge non calculable (pas de test) : l'interface doit le dire, pas inventer.
export const resolveLoadKg = (prescription: Prescription, tests: StrengthTest[]): number | null => {
  const load = prescription.load;
  if (!load) return null;
  if (load.type === "kg") return load.value;
  const test = latestTest(tests, load.test);
  if (!test) return null;
  return roundToPlate((estimatedOneRm(test) * load.value) / 100, test.stepKg ?? PLATE_STEP_KG);
};

export const applyOverride = (base: Prescription, override: Prescription | undefined): Prescription =>
  override ? { ...base, ...override } : base;

const formatNumber = (n: number): string => String(n).replace(".", ",");

export const formatPrescription = (p: Prescription, resolvedLoadKg: number | null = null): string => {
  const parts: string[] = [];
  const sets = p.sets ? `${p.sets} × ` : "";
  if (p.reps) parts.push(`${sets}${p.reps} rép.`);
  else if (p.count) parts.push(`${sets}${p.count} ${p.unit ?? ""}`.trim());
  else if (p.distance_m) parts.push(`${sets}${formatNumber(p.distance_m)} m`);
  else if (p.duration_s) parts.push(`${sets}${formatDuration(p.duration_s)}`);
  else if (p.sets) parts.push(`${p.sets} séries`);
  if (resolvedLoadKg !== null) parts.push(`${formatNumber(resolvedLoadKg)} kg`);
  else if (p.load?.type === "pct_1rm") parts.push(`${p.load.value} % du max`);
  if (p.ground_contacts) parts.push(`${p.ground_contacts} contacts`);
  if (p.tempo) parts.push(`tempo ${p.tempo}`);
  if (p.rest_s) parts.push(`récup ${formatDuration(p.rest_s)}`);
  return parts.join(" · ");
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${String(s).padStart(2, "0")}`;
};

export const countSets = (item: Pick<SnapshotItem, "prescription">): number => item.prescription.sets ?? 1;
