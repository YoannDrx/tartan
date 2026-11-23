import {
  chooseStrengthReference,
  strengthTestInput,
  type ExerciseSummary,
  type StrengthTestInput,
} from "@tartan/contracts";

export const parseStrengthKg = (text: string): number => {
  const value = text.trim().replace(",", ".");
  return /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
};

export const buildStrengthTest = (
  athleteId: string,
  exercise: ExerciseSummary,
  values: {
    value: string;
    kind: "one_rm" | "three_rm" | "estimated";
    date: string;
    selectAsReference: boolean;
  },
) =>
  strengthTestInput.safeParse({
    athleteId,
    exerciseId: exercise.id,
    exerciseKey: `exercise:${exercise.id}`,
    value: parseStrengthKg(values.value),
    kind: values.kind,
    date: values.date,
    selectAsReference: values.selectAsReference,
  });

// Le corps envoyé à `POST /athletes/[athleteId]/strength-tests` : la fiche est dans l'adresse, et la route refuse un
// corps qui la répète (`.strict()`). Sans cela, chaque test noté depuis l'app native revenait en « Invalid body ».
export const strengthTestBody = ({
  athleteId: _athleteId,
  ...body
}: StrengthTestInput): Omit<StrengthTestInput, "athleteId"> => body;

export const buildWorkingReference = (value: string) =>
  chooseStrengthReference.safeParse({ source: "working", valueKg: parseStrengthKg(value) });
