import type { Prescription } from "@tartan/contracts";
import { m, strengthTestLabel } from "@tartan/i18n";
import { Plus, Trash2 } from "lucide-react-native";
import { useId, useState } from "react";
import { Alert, View } from "react-native";
import { Button, Chip, Field, IconButton, T } from "../../ui/primitives";
import { Sheet } from "../../ui/sheet";
import { radius, space, usePalette } from "../../ui/theme";
import {
  builderErrors,
  MAX_PLANNED_SETS,
  numericFields,
  parsePrescriptionFields,
  prescriptionFields,
  startSetPlanFields,
  type PlannedSetFields,
  type PrescriptionFields,
} from "./form";

const setPlanText = m.builder.setPlan;

/** Série par série : pyramide, séries d'échauffement. Chaque série a ses répétitions et sa charge. */
const SetPlanFields = ({
  fields,
  onChange,
  uid,
}: {
  fields: PrescriptionFields;
  onChange: (patch: Partial<PrescriptionFields>) => void;
  uid: string;
}) => {
  const p = usePalette();
  const plan = fields.setPlan;
  const update = (index: number, patch: Partial<PlannedSetFields>) =>
    plan && onChange({ setPlan: plan.map((set, i) => (i === index ? { ...set, ...patch } : set)) });
  return (
    <View style={{ gap: space.sm }}>
      <Chip
        tall
        testID="set-plan-toggle"
        label={setPlanText.toggle}
        active={Boolean(plan)}
        onPress={() => {
          if (plan) {
            // Revenir à l'uniforme : la première série de travail devient la prescription de toutes.
            const first = plan.find((set) => !set.warmup) ?? plan[0];
            onChange({
              setPlan: undefined,
              sets: String(plan.length),
              reps: first?.reps ?? fields.reps,
              ...(fields.loadType !== "none" && first?.load ? { loadValue: first.load } : {}),
            });
          } else onChange({ setPlan: startSetPlanFields(fields) });
        }}
      />
      {plan ? (
        <>
          <T variant="caption" tone="muted">
            {setPlanText.hint}
          </T>
          {plan.map((set, index) => (
            <View
              key={index}
              testID={`set-plan-${index}`}
              accessibilityLabel={setPlanText.set(index + 1)}
              style={{ gap: space.sm, padding: space.sm, borderRadius: radius.button, backgroundColor: p.raised }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <T variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>
                  {setPlanText.set(index + 1)}
                </T>
                <Chip
                  tall
                  testID={`set-plan-warmup-${index}`}
                  label={setPlanText.warmup}
                  accessibilityLabel={`${setPlanText.warmup} · ${setPlanText.set(index + 1)}`}
                  active={set.warmup}
                  onPress={() => update(index, { warmup: !set.warmup })}
                />
                <View style={{ marginLeft: "auto" }}>
                  <IconButton
                    icon={Trash2}
                    label={setPlanText.remove(index + 1)}
                    disabled={plan.length === 1}
                    onPress={() => onChange({ setPlan: plan.filter((_, i) => i !== index) })}
                  />
                </View>
              </View>
              {/* Côte à côte sur téléphone ; l'un sous l'autre quand le texte est agrandi. */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Field
                  nativeID={`${uid}-set-${index}-reps`}
                  testID={`set-plan-reps-${index}`}
                  containerStyle={{ flexGrow: 1, flexBasis: 128 }}
                  label={m.builder.reps}
                  accessibilityLabel={`${m.builder.reps} · ${setPlanText.set(index + 1)}`}
                  value={set.reps}
                  keyboardType="number-pad"
                  onChangeText={(reps) => update(index, { reps })}
                />
                {fields.loadType !== "none" ? (
                  <Field
                    nativeID={`${uid}-set-${index}-load`}
                    testID={`set-plan-load-${index}`}
                    containerStyle={{ flexGrow: 1, flexBasis: 128 }}
                    label={fields.loadType === "kg" ? m.builder.sequence.loadKg : m.builder.loadPct}
                    accessibilityLabel={`${fields.loadType === "kg" ? m.builder.sequence.loadKg : m.builder.loadPct} · ${setPlanText.set(index + 1)}`}
                    value={set.load}
                    keyboardType="decimal-pad"
                    onChangeText={(load) => update(index, { load })}
                  />
                ) : null}
              </View>
            </View>
          ))}
          {plan.length < MAX_PLANNED_SETS ? (
            <Button
              compact
              variant="secondary"
              icon={Plus}
              testID="set-plan-add"
              label={setPlanText.add}
              onPress={() => onChange({ setPlan: [...plan, { ...plan[plan.length - 1]!, warmup: false }] })}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
};

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
    <Sheet visible title={title} onClose={close} footer={<Button label={m.nativeBuilder.apply} testID="prescription-apply" onPress={apply} />}>
      <T variant="bodyStrong">{exercise.name}</T>
      {error ? (
        <T tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      {numericFields
        .filter((key) => advanced || (key !== "count" && key !== "height_cm"))
        // Avec un détail série par série, le nombre de séries et les répétitions se lisent série par série.
        .filter((key) => !fields.setPlan || (key !== "sets" && key !== "reps"))
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
      {fields.loadType !== "none" && !fields.setPlan ? (
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
      <SetPlanFields fields={fields} onChange={update} uid={uid} />
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
