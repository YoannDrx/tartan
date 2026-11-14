import { Check } from "lucide-react-native";
import type { PlannerSelection } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { DateField } from "../ui/date-field";
import { Button, Field, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

const t = m.aiPlanner;
export function NativePlannerMode({
  selection,
  objective,
  disabled,
  verifiedCatalogAvailable,
  onChange,
}: {
  selection: PlannerSelection;
  objective: string;
  disabled: boolean;
  verifiedCatalogAvailable: boolean;
  onChange: (selection: PlannerSelection) => void;
}) {
  const [equipment, setEquipment] = useState(selection.brief?.equipment.join(", ") ?? "");
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{t.mode}</SectionTitle>
      {(["format", "propose"] as const).map((mode) => (
        <Button
          key={mode}
          testID={`planner-mode-${mode}`}
          variant="secondary"
          label={mode === "format" ? t.formatMode : t.proposeMode}
          selected={(selection.mode ?? "format") === mode}
          icon={(selection.mode ?? "format") === mode ? Check : undefined}
          disabled={disabled}
          onPress={() => {
            if (!selection.brief) setEquipment("");
            onChange({
              ...selection,
              mode,
              ...(mode === "propose" ? { exerciseIds: [] } : {}),
              brief:
                mode === "propose"
                  ? (selection.brief ?? {
                      objective,
                      date: selection.period.from,
                      durationMin: 45,
                      level: "intermediate",
                      equipment: [],
                    })
                  : undefined,
            });
          }}
        />
      ))}
      {selection.mode === "propose" && selection.brief ? (
        <>
          <T>{t.proposalNotice}</T>
          {!verifiedCatalogAvailable ? <T accessibilityLiveRegion="polite">{t.verifiedCatalogRequired}</T> : null}
          <DateField
            label={t.proposalDate}
            value={selection.brief.date}
            editable={!disabled}
            min={selection.period.from}
            max={selection.period.to}
            onChangeText={(date) => onChange({ ...selection, brief: { ...selection.brief!, date } })}
          />
          <Field
            label={t.proposalDuration}
            value={String(selection.brief.durationMin)}
            keyboardType="number-pad"
            editable={!disabled}
            onChangeText={(value) =>
              onChange({ ...selection, brief: { ...selection.brief!, durationMin: Number(value) } })
            }
          />
          <T variant="smallStrong">{t.proposalLevel}</T>
          {(["beginner", "intermediate", "advanced"] as const).map((level) => (
            <Button
              key={level}
              variant="secondary"
              label={t.proposalLevels[level]}
              selected={selection.brief!.level === level}
              icon={selection.brief!.level === level ? Check : undefined}
              disabled={disabled}
              onPress={() => onChange({ ...selection, brief: { ...selection.brief!, level } })}
            />
          ))}
          <Field
            label={t.proposalEquipment}
            value={equipment}
            editable={!disabled}
            onChangeText={(value) => {
              setEquipment(value);
              onChange({
                ...selection,
                brief: {
                  ...selection.brief!,
                  equipment: value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              });
            }}
          />
        </>
      ) : null}
    </View>
  );
}
