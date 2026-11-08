import type { PerformedSetDraftRow, PreviousExerciseSets, ResolvedItem } from "@tartan/contracts";
import { previousSetsForItem } from "@tartan/domain";
import { historyDate, m, realizedSetLabel } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, T } from "../ui/primitives";
import { space } from "../ui/theme";

export function PreviousSets({
  item,
  rows,
  previous,
  athleteId,
}: {
  item: ResolvedItem;
  rows: PerformedSetDraftRow[];
  previous?: PreviousExerciseSets[];
  athleteId?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  if (!previous || !item.exerciseId || !athleteId) return null;
  const groups = previousSetsForItem(item, rows, previous);
  return (
    <View style={{ gap: space.sm }}>
      <T heading variant="smallStrong">
        {m.exerciseHistory.lastTime}
      </T>
      <T variant="caption" tone="muted">
        {m.exerciseHistory.lastTimeHint}
      </T>
      {!groups.length ? (
        <T tone="muted">{m.exerciseHistory.noComparable}</T>
      ) : (
        groups.map((group, index) => (
          <View key={`${group.sessionId}:${index}`} style={{ gap: space.sm }}>
            <T variant="smallStrong">{m.exerciseHistory.previousOn(historyDate(group.date), group.startTime)}</T>
            {group.sets.slice(0, expanded ? undefined : 3).map((set) => (
              <T key={`${set.itemRef}:${set.setIndex}`}>{realizedSetLabel(set, group.convention)}</T>
            ))}
            {group.sets.length > 3 ? (
              <Button
                label={m.exerciseHistory.moreSets}
                variant="secondary"
                expanded={expanded}
                onPress={() => setExpanded((old) => !old)}
              />
            ) : null}
            {group.totalSets > group.sets.length ? (
              <T tone="muted">{m.exerciseHistory.limitedSets(group.sets.length, group.totalSets)}</T>
            ) : null}
            <Button
              label={m.exerciseHistory.openExercise}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/exercise-history/[athleteId]",
                  params: { athleteId, exercise: item.exerciseId!, days: "365", to: group.date },
                })
              }
            />
          </View>
        ))
      )}
    </View>
  );
}
