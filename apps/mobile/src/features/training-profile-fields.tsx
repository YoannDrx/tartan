import type { TrainingProfile } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { Button, Chip, T } from "../ui/primitives";
import { space } from "../ui/theme";

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
}) => {
  const [open, setOpen] = useState<keyof TrainingProfile | null>(null);
  return (
    <View style={{ gap: space.md }}>
      <T variant="caption" tone="muted">
        {m.trainingProfile.hint}
      </T>
      {(Object.keys(choices) as (keyof TrainingProfile)[]).map((key) => (
        <View key={key} style={{ gap: space.sm }}>
          <Button
            label={m.trainingProfile[key]}
            variant="secondary"
            disabled={disabled}
            onPress={() => setOpen(open === key ? null : key)}
          />
          <T variant="caption" tone="muted">
            {value[key].map((id) => (choices[key] as Record<string, string>)[id] ?? id).join(", ") ||
              m.trainingProfile.notSpecified}
          </T>
          {open === key ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {Object.entries(choices[key]).map(([id, label]) => (
                <Chip
                  key={id}
                  label={label}
                  active={(value[key] as string[]).includes(id)}
                  onPress={() => {
                    if (!disabled)
                      onChange({
                        ...value,
                        [key]: (value[key] as string[]).includes(id)
                          ? value[key].filter((entry) => entry !== id)
                          : [...value[key], id],
                      });
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
};
