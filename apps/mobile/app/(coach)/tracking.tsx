import { tokens } from "@tartan/design-tokens";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TrackingGrid } from "@tartan/contracts";
import { compareTrackingRows } from "@tartan/domain";
import { formatDayMonth, formatWeekdayShort, m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useWeekNavigator, WeekNav } from "../../src/features/agenda";
import { groupAlerts, type AthleteAlertGroup } from "../../src/lib/alerts";
import { api } from "../../src/lib/api";
import { localIsoDate } from "../../src/lib/dates";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace, useAlerts, useGroups, useTracking } from "../../src/lib/queries";
import { AlertTriangle, ChevronRight, Clock, Send, UserPlus, Users } from "../../src/ui/icons";
import { Button, Chip, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc, StatusGlyph } from "../../src/ui/status";
import { radius, scene, space, usePalette } from "../../src/ui/theme";

type Row = TrackingGrid["rows"][number];
type Session = TrackingGrid["sessions"][number];

const ROW_HEIGHT = 56;
const NAME_WIDTH = 124;
const CELL_WIDTH = 46;
const PCT_WIDTH = 46;
const HEADER_HEIGHT = 44;
const VISIBLE_ALERTS = 2;

const lateSessions = (row: Row, sessions: Session[], today: string): Session[] =>
  sessions.filter((s) => {
    if (s.date > today) return false;
    const cell = row.cells.find((c) => c.sessionId === s.id);
    return cell?.status === "missed" || cell?.status === "upcoming";
  });

// Une ligne par athlète : pastille teintée, titre, détail et motifs secondaires, chevron.
const AlertRow = ({ group, onPress }: { group: AthleteAlertGroup; onPress: () => void }) => {
  const p = usePalette();
  const { main, others } = group;
  const high = main.severity === "high";
  const Icon = main.kind === "missed_streak" ? Clock : AlertTriangle;
  const detail = [main.detail, ...others.map((o) => m.coach.alertKind[o.kind])].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${main.title}. ${detail}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        minHeight: 64,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.thumb,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: high ? p.status.missed : p.status.partial,
        }}
      >
        <Icon size={20} color={p.onStatus} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="smallStrong">{main.title}</T>
        {detail ? (
          <T variant="caption" tone="muted">
            {detail}
          </T>
        ) : null}
      </View>
      <ChevronRight size={18} color={p.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
};

const Grid = ({
  grid,
  onCell,
  onRow,
  onSession,
}: {
  grid: TrackingGrid;
  onCell: (row: Row, session: Session) => void;
  onRow: (row: Row) => void;
  onSession: (session: Session) => void;
}) => {
  // Sans séance cette semaine, l'athlète passe en bas : les lignes utiles restent groupées.
  const rows = useMemo(
    () =>
      [...grid.rows].sort((a, b) => {
        const idle = Number(a.cells.every((c) => !c.status)) - Number(b.cells.every((c) => !c.status));
        return idle || compareTrackingRows(a, b);
      }),
    [grid.rows],
  );
  const line = scene.cardLine;
  const sep = { borderBottomWidth: 1, borderBottomColor: line } as const;
  return (
    <ListSurface>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: NAME_WIDTH, borderRightWidth: 1, borderRightColor: line }}>
          <View style={[{ height: HEADER_HEIGHT, justifyContent: "center", paddingHorizontal: space.md }, sep]}>
            <T variant="caption" tone="muted">
              {m.coach.athleteCol}
            </T>
          </View>
          {rows.map((row) => (
            <Pressable
              key={row.athleteId}
              onPress={() => onRow(row)}
              accessibilityRole="button"
              accessibilityLabel={[
                row.name,
                row.hasPain ? m.mobile.coach.alertFor : null,
                row.activeInjury ? m.coach.activeInjury : null,
              ]
                .filter(Boolean)
                .join(", ")}
              style={[
                {
                  height: ROW_HEIGHT,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  paddingHorizontal: space.sm,
                },
                sep,
              ]}
            >
              {/* Sur téléphone, la colonne sert à lire le nom : ni initiales ni groupe. */}
              <T
                variant="caption"
                numberOfLines={2}
                maxFontSizeMultiplier={1.2}
                style={{ flex: 1, fontFamily: tokens.font.bodyStrong }}
              >
                {row.name}
              </T>
              {row.hasPain || row.activeInjury ? <AlertTriangle size={14} color={scene.status.missed} /> : null}
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flexGrow: 1 }}>
            <View style={[{ height: HEADER_HEIGHT, flexDirection: "row" }, sep]}>
              {grid.sessions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onSession(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}, ${formatDayMonth(s.date)}`}
                  style={{ width: CELL_WIDTH, flexGrow: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <T
                    variant="caption"
                    tone={s.date === localIsoDate() ? "link" : "default"}
                    maxFontSizeMultiplier={1.1}
                    style={{ fontFamily: tokens.font.bodyStrong }}
                  >
                    {formatWeekdayShort(s.date)}
                  </T>
                  <T
                    variant="caption"
                    tone="muted"
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.1}
                    style={{ fontSize: 12 }}
                  >
                    {m.mobile.sessionTypeShort[s.type]}
                  </T>
                </Pressable>
              ))}
            </View>
            {rows.map((row) => (
              <View key={row.athleteId} style={[{ height: ROW_HEIGHT, flexDirection: "row" }, sep]}>
                {grid.sessions.map((s) => {
                  const cell = row.cells.find((c) => c.sessionId === s.id);
                  if (!cell?.status) {
                    return (
                      <View
                        key={s.id}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={{ width: CELL_WIDTH, flexGrow: 1, alignItems: "center", justifyContent: "center" }}
                      >
                        <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: scene.controlLine }} />
                      </View>
                    );
                  }
                  const status = cell.status;
                  return (
                    <Pressable
                      key={s.id}
                      testID={`cell-${row.athleteId}-${s.id}`}
                      onPress={() => onCell(row, s)}
                      accessibilityRole="button"
                      accessibilityLabel={m.mobile.a11y.cell(row.name, s.title, m.status[status])}
                      style={({ pressed }) => ({
                        width: CELL_WIDTH,
                        flexGrow: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <StatusGlyph status={status} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={{ width: PCT_WIDTH, borderLeftWidth: 1, borderLeftColor: line }}>
          <View style={[{ height: HEADER_HEIGHT, justifyContent: "center", alignItems: "center" }, sep]}>
            <T variant="caption" tone="muted">
              {m.coach.doneCol}
            </T>
          </View>
          {rows.map((row) => (
            <View
              key={row.athleteId}
              style={[{ height: ROW_HEIGHT, alignItems: "center", justifyContent: "center" }, sep]}
            >
              <T variant="figure" style={{ fontSize: 17 }} maxFontSizeMultiplier={1.1}>
                {row.completionPct === null ? "" : `${row.completionPct}%`}
              </T>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.md }}>
        {(["done", "partial", "missed", "upcoming"] as const).map((status) => (
          <View key={status} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <StatusGlyph status={status} size={14} />
            <T variant="caption" tone="muted">
              {m.status[status]}
            </T>
          </View>
        ))}
      </View>
    </ListSurface>
  );
};

type AthleteFocus = { row: Row; focus?: Session; alert?: AthleteAlertGroup };

const AthleteSheet = ({
  orgId,
  focus,
  sessions,
  today,
  week,
  onClose,
}: {
  orgId: string;
  focus: AthleteFocus;
  sessions: Session[];
  today: string;
  week: string;
  onClose: () => void;
}) => {
  const router = useRouter();
  const client = useQueryClient();
  const { row, alert } = focus;
  const late = lateSessions(row, sessions, today);
  const target = focus.focus && late.some((s) => s.id === focus.focus?.id) ? focus.focus : late[late.length - 1];
  const [done, setDone] = useState<string | null>(null);
  const remind = useMutation({
    mutationFn: () => api.remind(orgId, (target as Session).id, [row.athleteId]),
    onSuccess: (result) => {
      setDone(m.mobile.coach.remindDone(result.count));
      void client.invalidateQueries({ queryKey: ["tracking", orgId] });
    },
  });
  return (
    <Sheet
      visible
      title={row.name}
      onClose={onClose}
      footer={
        target ? (
          <Button
            testID="remind-athlete"
            icon={Send}
            label={m.mobile.coach.remindAthlete(row.name)}
            loading={remind.isPending}
            disabled={Boolean(done)}
            onPress={() => remind.mutate()}
          />
        ) : undefined
      }
    >
      {alert ? (
        <View style={{ gap: space.xs }}>
          {[alert.main, ...alert.others].map((a) => (
            <View key={a.id} style={{ gap: 1 }}>
              <T variant="smallStrong">{a.title}</T>
              {a.detail ? (
                <T variant="small" tone="muted">
                  {a.detail}
                </T>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <Button
        testID="open-athlete-file"
        label={m.mobile.athletePage.open}
        variant="secondary"
        compact
        onPress={() => {
          onClose();
          router.push(`/athletes/${row.athleteId}`);
        }}
      />
      {done ? (
        <T accessibilityLiveRegion="polite" variant="small">
          {done}
        </T>
      ) : null}
      {remind.isError ? (
        <T tone="danger" variant="small">
          {errorMessage(remind.error)}
        </T>
      ) : null}
      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.coach.weekOf(formatDayMonth(week))}</SectionTitle>
        {sessions.map((s) => {
          const cell = row.cells.find((c) => c.sessionId === s.id);
          if (!cell?.status) return null;
          const meta = [
            formatWeekdayShort(s.date),
            cell.rpe ? m.mobile.coach.rpe(cell.rpe) : null,
            cell.variant ? m.variant[cell.variant] : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                onClose();
                router.push(`/coach-session/${s.id}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, ${m.status[cell.status]}, ${m.mobile.coach.openSession}`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                minHeight: 52,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <StatusDisc status={cell.status} />
              <View style={{ flex: 1 }}>
                <T variant="smallStrong">{s.title}</T>
                <T variant="caption" tone="muted">
                  {meta}
                </T>
              </View>
              <ChevronRight
                size={18}
                color={scene.textMuted}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
};

export default function Tracking() {
  const { orgId, space: active } = useActiveSpace();
  const nav = useWeekNavigator();
  const [groupId, setGroupId] = useState<string | undefined>();
  const groups = useGroups(orgId);
  const tracking = useTracking(orgId, nav.week, groupId);
  const alerts = useAlerts(orgId);
  const router = useRouter();
  const client = useQueryClient();
  const today = localIsoDate();
  const [focus, setFocus] = useState<AthleteFocus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [allAlerts, setAllAlerts] = useState(false);
  const alertGroups = useMemo(() => groupAlerts(alerts.data ?? []), [alerts.data]);

  const grid = tracking.data;
  const late = useMemo(() => {
    if (!grid) return [];
    return grid.sessions
      .filter((s) => s.date <= today)
      .map((s) => ({
        session: s,
        athleteIds: grid.rows.filter((r) => lateSessions(r, [s], today).length > 0).map((r) => r.athleteId),
      }))
      .filter((entry) => entry.athleteIds.length > 0);
  }, [grid, today]);

  const remindAll = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(late.map((entry) => api.remind(orgId, entry.session.id, entry.athleteIds)));
      return results.reduce((sum, r) => sum + r.count, 0);
    },
    onSuccess: (count) => {
      setMessage(m.mobile.coach.remindDone(count));
      void client.invalidateQueries({ queryKey: ["tracking", orgId] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const invite = () =>
    router.push(groupId ? { pathname: "/invite", params: { groupId } } : "/invite");

  const refresh = () => {
    void tracking.refetch();
    void alerts.refetch();
    void groups.refetch();
  };

  const athleteCount = grid?.rows.length ?? 0;
  const canInvite = active?.role === "owner" || active?.role === "coach";

  return (
    <TabScreen title={m.coach.trackingTitle} refreshing={tracking.isRefetching} onRefresh={refresh}>
      <WeekNav {...nav} />

      {groups.data && groups.data.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip
            label={m.mobile.coach.filter(
              m.coach.allGroups,
              groups.data.reduce((n, g) => n + g.athleteCount, 0),
            )}
            active={!groupId}
            onPress={() => setGroupId(undefined)}
          />
          {groups.data.map((g) => (
            <Chip key={g.id} label={g.name} active={groupId === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </ScrollView>
      ) : null}

      {alertGroups.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.coach.alerts}</SectionTitle>
          <ListSurface>
            {(allAlerts ? alertGroups : alertGroups.slice(0, VISIBLE_ALERTS)).map((group, index) => (
              <View key={group.athleteId}>
                {index > 0 ? <Divider /> : null}
                <AlertRow
                  group={group}
                  onPress={() => {
                    const row = grid?.rows.find((r) => r.athleteId === group.athleteId);
                    if (row) setFocus({ row, alert: group });
                    else {
                      // L'athlète est hors du filtre affiché : on revient à la vue complète.
                      setGroupId(undefined);
                      nav.reset();
                    }
                  }}
                />
              </View>
            ))}
          </ListSurface>
          {!allAlerts && alertGroups.length > VISIBLE_ALERTS ? (
            <Button
              label={m.coach.allAlerts(alertGroups.length)}
              variant="ghost"
              compact
              style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
              onPress={() => setAllAlerts(true)}
            />
          ) : null}
        </View>
      ) : null}

      {tracking.isPending ? <LoadingState /> : null}
      {tracking.isError && !grid ? <ErrorState error={tracking.error} onRetry={() => void tracking.refetch()} /> : null}

      {grid && athleteCount === 0 ? (
        <EmptyState
          body={m.coach.noAthletes}
          action={
            canInvite ? (
              <Button testID="open-invite" label={m.mobile.invitePage.open} icon={UserPlus} onPress={invite} />
            ) : undefined
          }
        />
      ) : null}
      {grid && athleteCount > 0 && grid.sessions.length === 0 ? <EmptyState body={m.coach.noSessions} /> : null}

      {grid && athleteCount > 0 && grid.sessions.length > 0 ? (
        <>
          <Grid
            grid={grid}
            onCell={(row, session) => setFocus({ row, focus: session })}
            onRow={(row) => setFocus({ row })}
            onSession={(session) => router.push(`/coach-session/${session.id}`)}
          />
          {late.length > 0 ? (
            <Button
              testID="remind-all"
              icon={Send}
              variant="secondary"
              label={m.coach.remindAll}
              loading={remindAll.isPending}
              onPress={() => {
                setMessage(null);
                remindAll.mutate();
              }}
            />
          ) : null}
        </>
      ) : null}
      {grid && athleteCount > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Button
            testID="open-athletes"
            label={m.mobile.athletePage.listLink}
            icon={Users}
            variant="secondary"
            compact
            style={{ flexGrow: 1 }}
            onPress={() => router.push("/athletes")}
          />
          {canInvite ? (
            <Button
              testID="open-invite"
              label={m.mobile.invitePage.open}
              icon={UserPlus}
              variant="secondary"
              compact
              style={{ flexGrow: 1 }}
              onPress={invite}
            />
          ) : null}
        </View>
      ) : null}
      {message ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {message}
        </T>
      ) : null}

      {focus && grid ? (
        <AthleteSheet
          orgId={orgId}
          focus={focus}
          sessions={grid.sessions}
          today={today}
          week={grid.weekStart}
          onClose={() => setFocus(null)}
        />
      ) : null}
    </TabScreen>
  );
}
