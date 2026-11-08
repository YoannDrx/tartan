import { estimateOneRm, percentageTable } from "./progression";

export const calculatorNumber = (text: string): number | null => {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value <= 1000 ? value : null;
};

// Même saisie et mêmes bornes sur web et natif. Aucun effet sur une référence enregistrée.
export const strengthCalculator = (values: { load: string; reps: string; reference: string }, stepKg = 1.25) => {
  const load = calculatorNumber(values.load);
  const parsedReps = /^\d+$/.test(values.reps.trim()) ? Number(values.reps.trim()) : null;
  const reps = parsedReps !== null && parsedReps >= 1 && parsedReps <= 10 ? parsedReps : null;
  const reference = calculatorNumber(values.reference);
  const estimate = load !== null && reps !== null ? estimateOneRm(load, reps) : null;
  return {
    estimate,
    measured: reps === 1,
    reference,
    canUseEstimate: estimate !== null && estimate <= 1000,
    errors: {
      load: values.load.trim() !== "" && load === null,
      reps: values.reps.trim() !== "" && reps === null,
      reference: values.reference.trim() !== "" && reference === null,
    },
    rows: reference !== null ? percentageTable(reference, stepKg) : [],
  };
};
