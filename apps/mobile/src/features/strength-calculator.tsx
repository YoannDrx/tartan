import { useState } from "react";
import { View } from "react-native";
import { strengthCalculator } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Button, Divider, Field, ListSurface, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

const number = (value: number, digits = 4) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
export const StrengthCalculator = ({ referenceKg, stepKg = 1.25 }: { referenceKg?: number; stepKg?: number }) => {
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [reference, setReference] = useState(referenceKg === undefined ? "" : String(referenceKg));
  const result = strengthCalculator({ load, reps, reference }, stepKg);
  return (
    <View style={{ gap: space.lg }}>
      <SectionTitle>{m.calculator.estimateTitle}</SectionTitle>
      <Field
        label={m.calculator.load}
        hint={m.calculator.loadHint}
        keyboardType="decimal-pad"
        maxLength={16}
        value={load}
        onChangeText={setLoad}
        error={result.errors.load ? m.calculator.invalidKg : undefined}
      />
      <Field
        label={m.calculator.reps}
        keyboardType="number-pad"
        maxLength={3}
        value={reps}
        onChangeText={setReps}
        error={result.errors.reps ? m.calculator.invalidReps : undefined}
      />
      <T variant="caption" tone="muted">
        {m.calculator.formula}
      </T>
      <T accessibilityLiveRegion="polite">
        {result.estimate === null
          ? m.calculator.estimateEmpty
          : `${result.measured ? m.calculator.measured : m.calculator.estimate} : ${number(result.estimate, 2)} kg`}
      </T>
      <Button
        variant="secondary"
        label={m.calculator.useEstimate}
        disabled={!result.canUseEstimate}
        onPress={() => result.estimate !== null && setReference(result.estimate.toFixed(2))}
      />
      <Divider />
      <SectionTitle>{m.calculator.tableTitle}</SectionTitle>
      <Field
        label={m.calculator.reference}
        hint={m.calculator.referenceHint}
        keyboardType="decimal-pad"
        maxLength={16}
        value={reference}
        onChangeText={setReference}
        error={result.errors.reference ? m.calculator.invalidKg : undefined}
      />
      <T variant="caption" tone="muted">
        {m.calculator.step(number(stepKg))}
      </T>
      {result.rows.length ? (
        <ListSurface>
          <View style={{ flexDirection: "row", gap: space.sm, padding: space.md }} accessible>
            <T variant="caption" style={{ flex: 1 }}>
              {m.calculator.percent}
            </T>
            <T variant="caption" style={{ flex: 1, textAlign: "right" }}>
              {m.calculator.exact}
            </T>
            <T variant="caption" style={{ flex: 1, textAlign: "right" }}>
              {m.calculator.rounded}
            </T>
          </View>
          {result.rows.map((row) => (
            <View key={row.percent}>
              <Divider />
              <View
                accessible
                accessibilityLabel={m.calculator.row(row.percent, number(row.exactKg), number(row.roundedKg))}
                style={{ flexDirection: "row", gap: space.sm, padding: space.md }}
              >
                <T style={{ flex: 1 }}>{row.percent} %</T>
                <T style={{ flex: 1, textAlign: "right" }}>{number(row.exactKg)}</T>
                <T variant="bodyStrong" style={{ flex: 1, textAlign: "right" }}>
                  {number(row.roundedKg)}
                </T>
              </View>
            </View>
          ))}
        </ListSurface>
      ) : (
        <T tone="muted">{m.calculator.tableEmpty}</T>
      )}
    </View>
  );
};
