import type { PlannedSet, Prescription } from "@tartan/contracts";
import { estimatedOneRm, PLATE_STEP_KG, roundToPlate } from "./charges";

type Load = NonNullable<Prescription["load"]>;

/** La référence de force figée sur l'exercice, quand sa charge est en pourcentage. */
export type SetReference = { value: number; kind: string; stepKg?: number; exerciseKey?: string } | null | undefined;

/** Le nombre de séries prescrites : le détail série par série fait foi quand il existe. */
export const prescribedSetCount = (p: Pick<Prescription, "sets" | "setPlan">): number =>
  p.setPlan?.length ?? p.sets ?? 1;

/**
 * Les kilos d'une série détaillée. En kilos, tels quels ; en pourcentage, d'après la référence figée sur
 * l'exercice, sinon en proportion de la charge déjà calculée pour la première série de travail.
 * Null quand rien ne permet de la calculer : l'interface le dit, elle n'invente pas.
 */
export const plannedSetLoadKg = (
  set: PlannedSet,
  prescription: Pick<Prescription, "load">,
  resolvedLoadKg: number | null = null,
  reference?: SetReference,
): number | null => {
  const load = set.load;
  if (!load) return null;
  if (load.type === "kg") return load.value;
  // La référence ne vaut que pour le test qu'elle mesure.
  if (reference && (!reference.exerciseKey || reference.exerciseKey === load.test)) {
    const oneRm = estimatedOneRm({
      value: reference.value,
      kind: reference.kind === "three_rm" ? "three_rm" : "one_rm",
    });
    return roundToPlate((oneRm * load.value) / 100, reference.stepKg ?? PLATE_STEP_KG);
  }
  const base = prescription.load;
  if (resolvedLoadKg === null || base?.type !== "pct_1rm" || base.value === 0) return null;
  return roundToPlate((resolvedLoadKg * load.value) / base.value);
};

const formatNumber = (n: number): string => String(n).replace(".", ",");

/** Une série détaillée : « 5 rép. à 60 kg », ou son pourcentage quand les kilos manquent. */
export const formatPlannedSet = (set: PlannedSet, kg: number | null): string => {
  const reps = set.reps ? `${set.reps} rép.` : "";
  const load =
    kg !== null
      ? `${formatNumber(kg)} kg`
      : set.load?.type === "pct_1rm"
        ? `${formatNumber(set.load.value)} % du max`
        : "";
  return reps && load ? `${reps} à ${load}` : reps || load || "1 série";
};

/** « 2 × 5 rép. à 60 kg, 3 rép. à 80 kg » : les séries identiques qui se suivent sont regroupées. */
export const formatSetPlan = (
  prescription: Pick<Prescription, "load" | "setPlan">,
  resolvedLoadKg: number | null = null,
  reference?: SetReference,
): string => {
  const plan = prescription.setPlan ?? [];
  const run = (sets: PlannedSet[]) => {
    const out: { text: string; count: number }[] = [];
    for (const set of sets) {
      const text = formatPlannedSet(set, plannedSetLoadKg(set, prescription, resolvedLoadKg, reference));
      const previous = out.at(-1);
      if (previous?.text === text) previous.count += 1;
      else out.push({ text, count: 1 });
    }
    return out.map(({ text, count }) => (count > 1 ? `${count} × ${text}` : text)).join(", ");
  };
  const warmup = plan.filter((set) => set.warmup);
  const work = plan.filter((set) => !set.warmup);
  return [warmup.length ? `Échauffement ${run(warmup)}` : "", run(work)].filter(Boolean).join(" · ");
};

const firstWork = (plan: PlannedSet[]) => plan.find((set) => !set.warmup) ?? plan[0];

/**
 * Pose un détail série par série en gardant `sets`, `reps` et `load` alignés sur lui (nombre de séries,
 * première série de travail), pour les clients qui ne lisent pas encore le détail.
 */
export const withSetPlan = (prescription: Prescription, plan: PlannedSet[]): Prescription => {
  const { setPlan: _old, reps: _reps, load: _load, ...rest } = prescription;
  const first = firstWork(plan);
  if (!plan.length || !first) return withoutSetPlan(prescription);
  return {
    ...rest,
    sets: plan.length,
    setPlan: plan,
    ...(first.reps ? { reps: first.reps } : {}),
    ...(first.load ? { load: first.load } : prescription.load ? { load: prescription.load } : {}),
  };
};

/** Revenir à une prescription uniforme : le résumé des séries reste celui de la première série de travail. */
export const withoutSetPlan = (prescription: Prescription): Prescription => {
  const { setPlan: _plan, ...rest } = prescription;
  return rest;
};

/** Le point de départ d'un détail : autant de séries que prescrites, toutes identiques. */
export const startSetPlan = (prescription: Prescription): PlannedSet[] =>
  Array.from({ length: Math.min(Math.max(prescription.sets ?? 3, 1), 30) }, () => ({
    ...(prescription.reps ? { reps: prescription.reps } : {}),
    ...(prescription.load ? { load: { ...prescription.load } } : {}),
  }));

/** Changer l'unité de charge de l'exercice change celle de chaque série, sans perdre les nombres saisis. */
export const setPlanLoadUnit = (plan: PlannedSet[], unit: Load | undefined): PlannedSet[] =>
  plan.map((set) => {
    const { load, ...rest } = set;
    if (!unit) return rest;
    const value = load?.value ?? unit.value;
    return { ...rest, load: unit.type === "kg" ? { type: "kg", value } : { type: "pct_1rm", value, test: unit.test } };
  });
