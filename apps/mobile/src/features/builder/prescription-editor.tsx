import type { Prescription } from "@tartan/contracts";
import { m, strengthTestLabel } from "@tartan/i18n";
import { useId, useState } from "react";
import { Alert, View } from "react-native";
import { Button, Chip, Field, T } from "../../ui/primitives";
import { Sheet } from "../../ui/sheet";
import { space } from "../../ui/theme";
import {
  builderErrors,
  numericFields,
  parsePrescriptionFields,
  prescriptionFields,
  type PrescriptionFields,
} from "./form";

export const PrescriptionEditor = ({
  title,
  exercise,
  value,
  testKeys,
  intensityEnabled,
  onApply,
  onClose,
  fields,
  onFieldsChange,
}: {
  title: string;
  exercise: { id: string; name: string };
  value: Prescription;
  testKeys: string[];
  intensityEnabled: boolean;
  onApply: (value: Prescription) => void;
  onClose: () => void;
  fields: PrescriptionFields;
  onFieldsChange: (fields: PrescriptionFields) => void;
}) => {
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const uid = useId();
  const labels = {
    sets: m.builder.sets,
    reps: m.builder.reps,
    distance_m: m.builder.distance,
    duration_s: m.builder.durationS,
    rest_s: m.builder.rest,
    ground_contacts: m.builder.contacts,
    count: m.nativeBuilder.count,
    height_cm: m.nativeBuilder.height,
  };
  const update = (patch: Partial<typeof fields>) => onFieldsChange({ ...fields, ...patch });
  const keys = [...new Set([...testKeys, ...(fields.test ? [fields.test] : [])])].filter(
    (key) => !key.startsWith("exercise:") || key === `exercise:${exercise.id}`,
  );
  const apply = () => {
    const result = parsePrescriptionFields(fields);
    if (!result.success) {
      setError(builderErrors(result.error.issues));
      return;
    }
    onApply(result.data);
  };
  const close = () => {
    if (JSON.stringify(fields) === JSON.stringify(prescriptionFields(value))) {
      onClose();
      return;
    }
    Alert.alert(m.builder.setPrescription, m.nativeBuilder.discardPrescription, [
      { text: m.common.cancel, style: "cancel" },
      { text: m.common.delete, style: "destructive", onPress: onClose },
    ]);
  };
  return (
    <Sheet visible title={title} onClose={close} footer={<Button label={m.nativeBuilder.apply} onPress={apply} />}>
      <T variant="bodyStrong">{exercise.name}</T>
      {error ? (
        <T tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      {numericFields
        .filter((key) => advanced || (key !== "count" && key !== "height_cm"))
        .map((key) => (
          <Field
            key={key}
            nativeID={`${uid}-${key}`}
            label={labels[key]}
            value={fields[key]}
            onChangeText={(text) => update({ [key]: text })}
            keyboardType="decimal-pad"
          />
        ))}
      <T variant="smallStrong">{m.builder.load}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        {(["none", "kg", "pct_1rm"] as const).map((type) => (
          <Chip
            key={type}
            label={type === "none" ? m.nativeBuilder.noLoad : type === "kg" ? m.builder.loadKg : m.builder.loadPct}
            active={fields.loadType === type}
            onPress={() => update({ loadType: type })}
          />
        ))}
      </View>
      {fields.loadType !== "none" ? (
        <Field
          nativeID={`${uid}-load`}
          label={m.nativeBuilder.loadValue}
          value={fields.loadValue}
          keyboardType="decimal-pad"
          onChangeText={(loadValue) => update({ loadValue })}
        />
      ) : null}
      {fields.loadType === "pct_1rm" ? (
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{m.nativeBuilder.chooseReference}</T>
          {keys.map((key) => (
            <Chip
              key={key}
              label={key === `exercise:${exercise.id}` ? exercise.name : strengthTestLabel(key)}
              active={fields.test === key}
              onPress={() => update({ test: key })}
            />
          ))}
        </View>
      ) : null}
      {intensityEnabled || fields.intensityType !== "none" ? (
        <>
          <T variant="smallStrong">{m.nativeBuilder.intensity}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {(["none", "rpe", "rir"] as const).map((type) => (
              <Chip
                key={type}
                label={type === "none" ? m.nativeBuilder.noIntensity : type.toUpperCase()}
                active={fields.intensityType === type}
                onPress={() => update({ intensityType: type })}
              />
            ))}
          </View>
          <T variant="caption" tone="muted">
            {m.nativeBuilder.intensityHint}
          </T>
          {fields.intensityType !== "none" ? (
            <Field
              nativeID={`${uid}-intensity`}
              label={m.nativeBuilder.intensityValue}
              value={fields.intensityValue}
              keyboardType="decimal-pad"
              onChangeText={(intensityValue) => update({ intensityValue })}
            />
          ) : null}
        </>
      ) : null}
      <Button
        variant="secondary"
        label={advanced ? m.nativeBuilder.hideAdvanced : m.nativeBuilder.advanced}
        onPress={() => setAdvanced(!advanced)}
      />
      <Field
        nativeID={`${uid}-unit`}
        label={m.nativeBuilder.unit}
        value={fields.unit}
        maxLength={30}
        onChangeText={(unit) => update({ unit })}
      />
      <Field
        nativeID={`${uid}-tempo`}
        label={m.builder.tempo}
        value={fields.tempo}
        maxLength={20}
        onChangeText={(tempo) => update({ tempo })}
      />
      <Field
        nativeID={`${uid}-notes`}
        label={m.builder.notes}
        value={fields.notes}
        maxLength={Math.max(500, fields.notes.length)}
        hint={fields.notes.length > 500 ? m.aiPlanner.textLimit(fields.notes.length, 500) : undefined}
        multiline
        onChangeText={(notes) => update({ notes })}
      />
    </Sheet>
  );
};
