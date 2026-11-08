import { useState } from "react";
import { View } from "react-native";
import type { StrengthRecordValue } from "@tartan/contracts";
import { historyDate, historyNumber, m, strengthRecordConvention, strengthRecordLabel } from "@tartan/i18n";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

const t = m.strengthRecords;
export function StrengthRecords({ records }: { records: StrengthRecordValue[] | undefined }) {
  const [kind, setKind] = useState<StrengthRecordValue["kind"]>("load_at_reps");
  const [choosing, setChoosing] = useState(false);
  const [limit, setLimit] = useState(10);
  if (!records) return null;
  const selected = records.filter((record) => record.kind === kind);
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <SectionTitle>{t.title}</SectionTitle>
        <T tone="muted">{t.scope}</T>
        <T variant="smallStrong">{t.kinds[kind]}</T>
        <Button label={t.measure} variant="secondary" expanded={choosing} onPress={() => setChoosing((old) => !old)} />
        {choosing
          ? Object.entries(t.kinds).map(([key, label]) => (
              <Button
                key={key}
                label={label}
                variant="secondary"
                selected={kind === key}
                onPress={() => {
                  setKind(key as StrengthRecordValue["kind"]);
                  setChoosing(false);
                  setLimit(10);
                }}
              />
            ))
          : null}
        {kind === "estimated_one_rm" ? <T tone="muted">{t.estimate}</T> : null}
        {!selected.length ? (
          <T>{t.empty}</T>
        ) : (
          selected.slice(0, limit).map((record) => (
            <View key={record.comparisonKey} accessible style={{ gap: space.xs }}>
              <T variant="smallStrong">
                {strengthRecordLabel(record)} ·{" "}
                {record.kind === "reps_at_load"
                  ? t.repsValue(historyNumber(record.value))
                  : `${historyNumber(record.value)} kg`}
              </T>
              <T>
                {record.baseline ? t.baseline : t.record} · {historyDate(record.date)}
              </T>
              <T tone="muted">{strengthRecordConvention(record)}</T>
            </View>
          ))
        )}
        {selected.length > limit ? (
          <Button label={t.more} variant="secondary" onPress={() => setLimit((old) => old + 10)} />
        ) : null}
      </View>
    </Card>
  );
}
