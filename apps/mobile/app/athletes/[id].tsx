import { formatHeight } from "@tartan/domain";
import { capitalize, formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { BarSheetRow, VideoRow } from "../../src/features/video-bits";
import {
  useActiveSpace,
  useAthleteStats,
  useAthleteVideos,
  useBarSheet,
  useCoachAthleteFile,
} from "../../src/lib/queries";
import type { CoachAthleteFile } from "../../src/lib/schemas";
import { AlertTriangle, ChevronRight, UserPlus } from "../../src/ui/icons";
import { Button, Divider, ListSurface, SectionTitle, T, Tag } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc } from "../../src/ui/status";
import { radius, scene, space, usePalette } from "../../src/ui/theme";

const day = (iso: string) => capitalize(formatDayMonth(iso));
const fullDay = (iso: string) => `${day(iso)} ${iso.slice(0, 4)}`;
const mark = (value: number, unit: string) =>
  unit === "cm" ? `${formatHeight(value)} m` : `${String(value).replace(".", ",")} ${unit}`;
const discipline = (key: string) => (m.mobile.progress.discipline as Record<string, string>)[key] ?? key;
const testKind = (kind: string) => (m.testKind as Record<string, string>)[kind] ?? kind;
const bodyArea = (key: string) => (m.bodyArea as Record<string, string>)[key] ?? key;

const injuryLabel = (injury: CoachAthleteFile["injuries"][number]) =>
  m.mobile.athletePage.injuryRow(
    bodyArea(injury.bodyArea),
    injury.side === "none" ? null : m.bodySide[injury.side],
    m.injuryStatus[injury.status],
  );

const Section = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <View style={{ gap: space.sm }}>
    <SectionTitle right={aside}>{title}</SectionTitle>
    {children}
  </View>
);

const FigureRow = ({ label, value }: { label: string; value: string }) => (
  <View
    accessible
    accessibilityLabel={`${label} : ${value}`}
    style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 52 }}
  >
    <T variant="small" tone="muted" style={{ flex: 1 }}>
      {label}
    </T>
    <T variant="figure">{value}</T>
  </View>
);

const MarkRow = ({ title, detail, value, badge }: { title: string; detail: string; value: string; badge?: string }) => (
  <View
    accessible
    style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 60 }}
  >
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="smallStrong">{title}</T>
      <T variant="caption" tone="muted">
        {detail}
      </T>
      {badge ? <Tag label={badge} tone="brand" /> : null}
    </View>
    <T variant="figure" style={{ fontSize: 24, lineHeight: 28 }}>
      {value}
    </T>
  </View>
);

const InjuryAlert = ({ injury }: { injury: CoachAthleteFile["injuries"][number] }) => {
  const p = usePalette();
  return (
    <ListSurface>
      <View
        accessible
        accessibilityLiveRegion="polite"
        style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 64 }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.thumb,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: scene.status.missed,
          }}
        >
          <AlertTriangle size={20} color={p.onStatus} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <T variant="smallStrong" style={{ color: scene.text }}>
            {injuryLabel(injury)}
          </T>
          {injury.restrictions ? (
            <T variant="caption" style={{ color: scene.textMuted }}>
              {injury.restrictions}
            </T>
          ) : null}
        </View>
      </View>
    </ListSurface>
  );
};

export default function AthleteFile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orgId, space: active } = useActiveSpace();
  const router = useRouter();
  const stats = useAthleteStats(orgId, id);
  const file = useCoachAthleteFile(orgId, id);
  const sheet = useBarSheet(orgId, id);
  const videos = useAthleteVideos(orgId, id);

  const detail = file.data;
  const canInvite = (active?.role === "owner" || active?.role === "coach") && detail && !detail.hasAccount;

  if (file.isPending || stats.isPending) {
    return (
      <StackScreen title={m.athletes.title}>
        <LoadingState />
      </StackScreen>
    );
  }
  if (!detail) {
    return (
      <StackScreen title={m.athletes.title}>
        <ErrorState message={m.mobile.athletePage.error} onRetry={() => void file.refetch()} />
      </StackScreen>
    );
  }

  const name = `${detail.firstName} ${detail.lastName}`.trim();
  const subtitle = [detail.level, detail.groups.map((g) => g.name).join(", ")].filter(Boolean).join(" · ");
  const cleared = (sheet.data?.rows ?? []).filter((r) => r.cleared).map((r) => r.heightCm);
  const bestCm = cleared.length > 0 ? Math.max(...cleared) : null;
  const weeks = (stats.data?.weeks ?? []).filter((w) => w.sessions > 0).reverse();
  const totals = weeks.reduce((sum, w) => ({ done: sum.done + w.done, all: sum.all + w.sessions }), { done: 0, all: 0 });
  const rate = totals.all > 0 ? Math.round((totals.done / totals.all) * 100) : null;
  const activeInjury = detail.injuries.find((i) => i.status !== "resolved");
  const figures: { label: string; value: string | null }[] = [
    { label: m.athletes.takeoffFoot, value: detail.takeoffFoot ? m.bodySide[detail.takeoffFoot] : null },
    { label: m.athletes.approachSteps, value: detail.approachSteps ? String(detail.approachSteps) : null },
    { label: m.athletes.bestBar, value: bestCm ? `${formatHeight(bestCm)} m` : null },
    { label: m.athletes.doneRate, value: rate !== null ? `${rate} %` : null },
  ];
  const shownFigures = figures.flatMap((f) => (f.value === null ? [] : [{ label: f.label, value: f.value }]));

  return (
    <StackScreen title={name} subtitle={subtitle}>
      {activeInjury ? <InjuryAlert injury={activeInjury} /> : null}

      {shownFigures.length > 0 ? (
        <ListSurface>
          {shownFigures.map((f, i) => (
            <View key={f.label}>
              {i > 0 ? <Divider /> : null}
              <FigureRow label={f.label} value={f.value} />
            </View>
          ))}
        </ListSurface>
      ) : null}

      {canInvite ? (
        <Button
          testID="athlete-invite"
          label={m.mobile.athletePage.inviteAthlete}
          icon={UserPlus}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/invite",
              params: { athleteId: detail.id, groupId: detail.groups[0]?.id ?? "" },
            })
          }
        />
      ) : null}

      {detail.goals || detail.particularities ? (
        <ListSurface style={{ padding: space.md, gap: space.md }}>
          {detail.goals ? (
            <View style={{ gap: 2 }}>
              <T variant="caption" tone="muted">
                {m.athletes.goals}
              </T>
              <T variant="small">{detail.goals}</T>
            </View>
          ) : null}
          {detail.particularities ? (
            <View style={{ gap: 2 }}>
              <T variant="caption" tone="muted">
                {m.athletes.particularities}
              </T>
              <T variant="small">{detail.particularities}</T>
            </View>
          ) : null}
        </ListSurface>
      ) : null}

      {sheet.data && sheet.data.rows.length > 0 ? (
        <Section title={m.video.barSheet}>
          <ListSurface style={{ padding: space.md }}>
            <BarSheetRow rows={sheet.data.rows} currentCm={bestCm} />
          </ListSurface>
        </Section>
      ) : null}

      <Section title={m.athletes.load}>
        <ListSurface>
          {stats.isError ? (
            <View style={{ padding: space.md }}>
              <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
            </View>
          ) : weeks.length === 0 ? (
            <T variant="small" tone="muted" style={{ padding: space.md }}>
              {m.mobile.athletePage.noLoad}
            </T>
          ) : (
            weeks.map((week, i) => (
              <View key={week.weekStart}>
                {i > 0 ? <Divider /> : null}
                <View
                  accessible
                  style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 56 }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="smallStrong">{m.athletes.weekOf(formatDayMonth(week.weekStart))}</T>
                    <T variant="caption" tone="muted">
                      {m.athletes.loadSessions(week.done, week.sessions)}
                    </T>
                  </View>
                  {week.load !== null ? <T variant="figure">{m.athletes.loadValue(week.load)}</T> : null}
                </View>
              </View>
            ))
          )}
        </ListSurface>
        {stats.data && stats.data.loadTrendPct !== null ? (
          <T variant="small">{m.athletes.loadTrend(stats.data.loadTrendPct)}</T>
        ) : null}
        {stats.data && !stats.data.healthVisible ? <T variant="small">{m.athletes.healthHidden}</T> : null}
      </Section>

      <>
          <Section title={m.athletes.records}>
            <ListSurface>
              {detail.performances.length === 0 ? (
                <T variant="small" tone="muted" style={{ padding: space.md }}>
                  {m.athletes.noRecords}
                </T>
              ) : (
                detail.performances.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 ? <Divider /> : null}
                    <MarkRow
                      title={discipline(p.discipline)}
                      detail={[fullDay(p.date), p.location].filter(Boolean).join(" · ")}
                      value={mark(p.mark, p.unit)}
                      badge={p.isPb ? m.athletes.record : undefined}
                    />
                  </View>
                ))
              )}
            </ListSurface>
          </Section>

          <Section title={m.athletes.tests}>
            <ListSurface>
              {detail.tests.length === 0 ? (
                <T variant="small" tone="muted" style={{ padding: space.md }}>
                  {m.athletes.noTests}
                </T>
              ) : (
                detail.tests.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 ? <Divider /> : null}
                    <MarkRow
                      title={strengthTestLabel(t.exerciseKey)}
                      detail={`${testKind(t.kind)} · ${fullDay(t.date)}`}
                      value={`${String(t.value).replace(".", ",")} kg`}
                    />
                  </View>
                ))
              )}
            </ListSurface>
          </Section>

          <Section title={m.athletes.injuries}>
            <ListSurface>
              {!detail.healthVisible ? (
                <T variant="small" tone="muted" style={{ padding: space.md }}>
                  {m.athletes.healthHidden}
                </T>
              ) : detail.injuries.length === 0 ? (
                <T variant="small" tone="muted" style={{ padding: space.md }}>
                  {m.athletes.noInjuries}
                </T>
              ) : (
                detail.injuries.map((injury, i) => (
                  <View key={injury.id}>
                    {i > 0 ? <Divider /> : null}
                    <View accessible style={{ padding: space.md, gap: 2, minHeight: 56 }}>
                      <T variant="smallStrong">{injuryLabel(injury)}</T>
                      <T variant="caption" tone="muted">
                        {[
                          m.mobile.athletePage.since(fullDay(injury.startDate)),
                          injury.endDate ? m.mobile.athletePage.until(fullDay(injury.endDate)) : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </T>
                      {injury.restrictions ? <T variant="small">{injury.restrictions}</T> : null}
                    </View>
                  </View>
                ))
              )}
            </ListSurface>
          </Section>

          <Section title={m.athletes.history}>
            <ListSurface>
              {detail.history.length === 0 ? (
                <T variant="small" tone="muted" style={{ padding: space.md }}>
                  {m.athletes.noHistory}
                </T>
              ) : (
                detail.history.map((h, i) => {
                  const status = h.status === "done" || h.status === "partial" ? h.status : "missed";
                  return (
                    <View key={h.id}>
                      {i > 0 ? <Divider /> : null}
                      <Pressable
                        onPress={() => router.push(`/coach-session/${h.sessionId}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${h.title}, ${fullDay(h.date)}, ${m.status[status]}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: space.md,
                          padding: space.md,
                          minHeight: 56,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <StatusDisc status={status} />
                        <View style={{ flex: 1, gap: 1 }}>
                          <T variant="smallStrong">{h.title}</T>
                          <T variant="caption" tone="muted">
                            {fullDay(h.date)}
                          </T>
                        </View>
                        <ChevronRight
                          size={18}
                          color={scene.textMuted}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ListSurface>
          </Section>
      </>

      {videos.data && videos.data.length > 0 ? (
        <Section title={m.mobile.athletePage.videos(videos.data.length)}>
          <ListSurface>
            {videos.data.map((video, i) => (
              <View key={video.id}>
                {i > 0 ? <Divider /> : null}
                <VideoRow video={video} showAthlete={false} onPress={() => router.push(`/video/${video.id}`)} />
              </View>
            ))}
          </ListSurface>
        </Section>
      ) : null}

    </StackScreen>
  );
}
