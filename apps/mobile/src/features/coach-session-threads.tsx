import { useQuery } from "@tanstack/react-query";
import type { SessionThreadTarget } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { Button, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";
import { ThreadConversation } from "./session-thread";

export function CoachSessionThreads({
  target,
  athleteName,
  onClose,
}: {
  target: SessionThreadTarget & { athleteId: string };
  athleteName: string;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["coach-session-thread-context", target.orgId, target.sessionId, target.athleteId],
    queryFn: () => api.athleteSessionForCoach(target.orgId, target.sessionId, target.athleteId),
    gcTime: 0,
    staleTime: 0,
  });
  const [selected, setSelected] = useState<{ itemRef?: string; label: string; note?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible
      title={selected?.label ?? `${m.sessionThread.coachThreads} · ${athleteName}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {selected ? (
        <>
          <Button
            compact
            variant="ghost"
            label={`${m.common.back} · ${athleteName}`}
            disabled={busy}
            onPress={() => setSelected(null)}
          />
          {selected.note ? <T variant="small">{selected.note}</T> : null}
          <ThreadConversation target={{ ...target, itemRef: selected.itemRef }} onBusyChange={setBusy} />
        </>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : !detail.data ? (
        <LoadingState />
      ) : (
        <>
          {detail.data.log?.status === "done" && detail.data.healthConsent ? (
            <Button
              variant="secondary"
              label={m.sessionThread.debrief}
              onPress={() => setSelected({ label: m.sessionThread.debrief, note: detail.data.log?.comment })}
            />
          ) : null}
          {detail.data.blocks.map((block) => {
            const exercises = block.items.filter((item) => item.kind !== "recovery");
            if (!exercises.length) return null;
            return (
              <View key={block.ref} style={{ gap: space.sm }}>
                <T variant="smallStrong">{block.name}</T>
                {exercises.map((item) => {
                  const rounds =
                    item.rounds?.map((round) => m.builder.sequence.round(round.name, round.round, round.rounds)) ?? [];
                  const label = [item.name, ...rounds].join(" · ");
                  return (
                    <Button
                      key={item.ref}
                      variant="secondary"
                      label={label}
                      onPress={() => setSelected({ itemRef: item.ref, label, note: item.prescription.notes })}
                    />
                  );
                })}
              </View>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
