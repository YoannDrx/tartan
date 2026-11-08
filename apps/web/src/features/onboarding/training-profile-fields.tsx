"use client";

import type { TrainingProfile } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { CheckRow } from "@/components/ui/field";

const choices = {
  disciplines: m.disciplines,
  trainingObjectives: m.trainingProfile.objectives,
  availableEquipment: m.trainingProfile.equipment,
};

export const TrainingProfileFields = ({
  value,
  onChange,
  disabled = false,
}: {
  value: TrainingProfile;
  onChange: (value: TrainingProfile) => void;
  disabled?: boolean;
}) => (
  <div className="flex flex-col gap-3">
    <p className="t-caption text-soft">{m.trainingProfile.hint}</p>
    {(Object.keys(choices) as (keyof TrainingProfile)[]).map((key) => (
      <details key={key} className="rounded-button border border-card-line px-3">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {m.trainingProfile[key]}
          <span className="mt-1 block text-sm font-normal text-soft">
            {value[key].map((id) => (choices[key] as Record<string, string>)[id] ?? id).join(", ") ||
              m.trainingProfile.notSpecified}
          </span>
        </summary>
        <fieldset disabled={disabled} className="grid gap-x-4 pb-3 tablet:grid-cols-2">
          <legend className="sr-only">{m.trainingProfile[key]}</legend>
          {Object.entries(choices[key]).map(([id, label]) => (
            <CheckRow
              key={id}
              label={label}
              checked={(value[key] as string[]).includes(id)}
              onChange={(event) =>
                onChange({
                  ...value,
                  [key]: event.target.checked ? [...value[key], id] : value[key].filter((entry) => entry !== id),
                })
              }
            />
          ))}
        </fieldset>
      </details>
    ))}
  </div>
);
