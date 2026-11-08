import { View } from "react-native";
import type { ConfirmedStrengthRecord } from "@tartan/contracts";
import { historyNumber, m, strengthRecordConvention, strengthRecordLabel } from "@tartan/i18n";
import { Card, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

export function ConfirmedRecords({ records }: { records: ConfirmedStrengthRecord[] }) {
  if (!records.length) return null;
  return (
    <Card>
      <View accessibilityLiveRegion="polite" style={{ gap: space.md }}>
        <SectionTitle>{m.strengthRecords.confirmed}</SectionTitle>
        <T tone="muted">{m.strengthRecords.confirmedHint}</T>
        {records.map((record) => (
          <View key={record.eventId} accessible style={{ gap: space.xs }}>
            <T variant="smallStrong">
              {record.exerciseName} · {strengthRecordLabel(record)} :{" "}
              {record.kind === "reps_at_load"
                ? m.strengthRecords.repsValue(historyNumber(record.value))
                : `${historyNumber(record.value)} kg`}
            </T>
            <T tone="muted">{strengthRecordConvention(record)}</T>
          </View>
        ))}
      </View>
    </Card>
  );
}
