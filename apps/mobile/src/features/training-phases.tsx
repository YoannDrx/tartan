import type { TrainingPhaseQuery, TrainingPhaseSummary } from "@tartan/contracts";
import { trainingPhaseBand, trainingPhaseProgress } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { localIsoDate } from "../lib/dates";
import { useActiveSpace } from "../lib/queries";
import { Button, SectionTitle, T, Tag } from "../ui/primitives";
import { ErrorState, LoadingState } from "../ui/states";
import { color, space, usePalette } from "../ui/theme";

export function useTrainingPhases(query: TrainingPhaseQuery) {
  const { orgId, me, space: active } = useActiveSpace();
  return useQuery({
    queryKey: ["training-phases", orgId, me.data?.id, active?.role, query],
    queryFn: () => api.trainingPhases(orgId, query),
    enabled: Boolean(orgId && active?.phasesEnabled),
  });
}
export function NativePhaseList({
  phases,
  from,
  to,
  today,
  actions,
}: {
  phases: TrainingPhaseSummary[];
  from: string;
  to: string;
  today: string;
  actions?: (phase: TrainingPhaseSummary) => ReactNode;
}) {
  const palette = usePalette();
  const t = m.trainingPhases;
  return (
    <View style={{ gap: space.lg }}>
      {!phases.length ? <T tone="muted">{t.noPhase}</T> : null}
      {phases.map((phase) => {
        const band = trainingPhaseBand(phase, { startDate: from, endDate: to });
        const progress = trainingPhaseProgress(phase, today);
        return (
          <View
            key={phase.id}
            style={{
              gap: space.sm,
              paddingVertical: space.md,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <SectionTitle>{phase.name}</SectionTitle>
            <T tone="muted">
              {phase.targetName} · {t.kinds[phase.kind]}
            </T>
            <Tag label={phase.shared ? t.shared : t.draft} />
            <T>
              {historyDate(phase.startDate)} – {historyDate(phase.endDate)}
            </T>
            {band ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ height: 6, borderRadius: 3, backgroundColor: palette.surfaceAlt, overflow: "hidden" }}
              >
                <View
                  style={{
                    height: 6,
                    marginLeft: `${band.offset * 100}%`,
                    width: `${band.width * 100}%`,
                    borderRadius: 3,
                    backgroundColor: phase.shared ? color.brand : palette.textMuted,
                  }}
                />
              </View>
            ) : null}
            {progress ? <T variant="smallStrong">{t.week(progress.week, progress.weeks)}</T> : null}
            {phase.objective ? <T variant="smallStrong">{phase.objective}</T> : null}
            {phase.description ? <T>{phase.description}</T> : null}
            {phase.privateNote ? (
              <>
                <T variant="smallStrong">{t.privateNote}</T>
                <T tone="muted">{phase.privateNote}</T>
              </>
            ) : null}
            {actions?.(phase)}
          </View>
        );
      })}
    </View>
  );
}
export function NativeCalendarPhases({ from, to, groupId }: { from: string; to: string; groupId?: string }) {
  const { space: active } = useActiveSpace();
  const phases = useTrainingPhases({ from, to, groupId });
  const router = useRouter();
  const today = localIsoDate();
  if (!active?.phasesEnabled) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Button
        variant="secondary"
        label={m.trainingPhases.title}
        onPress={() =>
          router.push({ pathname: "/training-phases", params: { from, to, ...(groupId ? { groupId } : {}) } })
        }
      />
      {phases.isPending ? <LoadingState /> : null}
      {phases.isError ? <ErrorState error={phases.error} onRetry={() => void phases.refetch()} /> : null}
      {phases.data && !phases.isError ? (
        <NativePhaseList
          phases={phases.data.phases}
          from={from}
          to={to}
          today={today >= from && today <= to ? today : from}
        />
      ) : null}
    </View>
  );
}
