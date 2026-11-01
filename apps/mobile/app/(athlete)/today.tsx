import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { CommentsSection } from "../../src/features/comments";
import { ExerciseRow, parseMedia } from "../../src/features/media";
import { AttendanceLink, AttendanceRow, SessionHero } from "../../src/features/session-hero";
import { recordValidation, ValidationSheet, type ValidationTarget } from "../../src/features/validation-sheet";
import { WeekStrip } from "../../src/features/week-strip";
import { localIsoDate } from "../../src/lib/dates";
import { useActiveSpace, usePrefetchUpcomingSessions, useSessionDetail, useToday } from "../../src/lib/queries";
import { submitAttendance, useOpQueue } from "../../src/lib/sync/op-queue";
import { applyPendingToCard, applyPendingToToday, pendingLogFor } from "../../src/lib/sync/queue-core";
import { MessageSquare, Pin } from "../../src/ui/icons";
import { Button, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { color, radius, space, usePalette } from "../../src/ui/theme";
import type { AthleteSessionCard } from "@tartan/contracts";

const nextLine = (card: AthleteSessionCard) =>
  [capitalize(formatDateLong(card.date)), card.startTime?.replace(":", " h "), card.location]
    .filter(Boolean)
    .join(" · ");

export default function Today() {
  const { orgId } = useActiveSpace();
  const today = useToday(orgId);
  usePrefetchUpcomingSessions(orgId);
  const items = useOpQueue((s) => s.items);
  const router = useRouter();
  const p = usePalette();
  const date = localIsoDate();
  const [sheet, setSheet] = useState<{
    card: AthleteSessionCard;
    status: "done" | "partial";
    justRecorded: boolean;
  } | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const targetOf = (card: AthleteSessionCard): ValidationTarget => ({
    orgId,
    sessionId: card.id,
    variant: card.variant,
    plannedMinutes: card.durationMin,
  });

  // Premier toucher : c'est enregistré. La feuille qui s'ouvre ne contient que du facultatif.
  const validate = (card: AthleteSessionCard, status: "done" | "partial") => {
    void recordValidation(targetOf(card), status);
    setSheet({ card, status, justRecorded: true });
  };
  const edit = (card: AthleteSessionCard) =>
    setSheet({ card, status: card.status === "partial" ? "partial" : "done", justRecorded: false });

  const view = useMemo(
    () => (today.data ? applyPendingToToday(today.data, items, date) : null),
    [today.data, items, date],
  );
  const main = view?.today.find((c) => c.status === "upcoming" || c.status === "missed") ?? view?.today[0] ?? null;
  const others = view?.today.filter((c) => c.id !== main?.id) ?? [];
  const programCard = main ?? view?.next ?? null;
  const program = useSessionDetail(orgId, programCard?.id);
  const programItems = useMemo(() => program.data?.blocks.flatMap((b) => b.items) ?? [], [program.data?.blocks]);

  const greeting = view?.firstName ? m.today.greeting(view.firstName) : m.nav.aujourdhui;

  return (
    <TabScreen
      title={greeting}
      subtitle={capitalize(formatDateLong(date))}
      refreshing={today.isRefetching}
      onRefresh={() => void today.refetch()}
    >
      {today.isPending ? <LoadingState /> : null}
      {today.isError && !view ? <ErrorState error={today.error} onRetry={() => void today.refetch()} /> : null}
      {view ? (
        <>
          {view.parentalConsentPending ? (
            <View style={{ backgroundColor: color.warningTint, borderRadius: radius.card, padding: space.md }}>
              <T variant="small" style={{ color: color.warningStrong }}>
                {m.parental.pendingBanner}
              </T>
            </View>
          ) : null}

          <WeekStrip week={view.week} today={date} />

          {main ? (
            <SessionHero
              card={main}
              pending={Boolean(pendingLogFor(items, main.id))}
              onValidate={(status) => validate(main, status)}
              onEdit={() => edit(main)}
              onStart={() => router.push(`/session/${main.id}`)}
            />
          ) : (
            <EmptyState
              body={view.next ? m.mobile.today.restDay : m.today.noneYet}
              title={view.next ? m.today.empty : undefined}
            />
          )}

          {main && main.status === "upcoming" ? (
            <AttendanceLink card={main} onAnswer={(status) => void submitAttendance(orgId, main.id, status)} />
          ) : null}

          {others.map((card) => (
            <SessionHero
              key={card.id}
              card={card}
              pending={Boolean(pendingLogFor(items, card.id))}
              onValidate={(status) => validate(card, status)}
              onEdit={() => edit(card)}
              onStart={() => router.push(`/session/${card.id}`)}
            />
          ))}

          {main?.coachNote ? (
            <View style={{ gap: space.xs + 2 }}>
              <SectionTitle>{m.today.coachWord}</SectionTitle>
              <T variant="body">{main.coachNote}</T>
              {main.coachName ? (
                <T variant="caption" tone="muted">
                  {main.coachName}
                </T>
              ) : null}
            </View>
          ) : null}

          {view.pinnedAnnouncement ? (
            <View
              style={{
                flexDirection: "row",
                gap: space.md,
                backgroundColor: p.surface,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: p.border,
                padding: space.md,
              }}
            >
              <Pin size={18} color={color.brandStrong} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="small">{view.pinnedAnnouncement.body}</T>
                {view.pinnedAnnouncement.authorName ? (
                  <T variant="caption" tone="muted">
                    {view.pinnedAnnouncement.authorName}
                  </T>
                ) : null}
              </View>
            </View>
          ) : null}

          {!main && view.next ? (
            <View style={{ gap: space.sm }}>
              <View
                style={{
                  backgroundColor: p.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: p.border,
                  padding: space.lg,
                  gap: space.md,
                }}
              >
                <View style={{ gap: 2 }}>
                  <T variant="title2" heading>
                    {view.next.title}
                  </T>
                  <T variant="small" tone="muted">
                    {`${m.today.next} : ${nextLine(view.next)}`}
                  </T>
                </View>
                <AttendanceRow
                  card={applyPendingToCard(view.next, items)}
                  onAnswer={(status) => void submitAttendance(orgId, (view.next as AthleteSessionCard).id, status)}
                />
              </View>
            </View>
          ) : null}

          {programCard ? (
            <View style={{ gap: space.sm }}>
              <SectionTitle>{m.today.program}</SectionTitle>
              {program.isPending ? <LoadingState inline /> : null}
              {program.isError && !program.data ? (
                <ErrorState message={m.mobile.today.programError} onRetry={() => void program.refetch()} />
              ) : null}
              {program.data && programItems.length === 0 ? (
                <T variant="small" tone="muted">
                  {m.mobile.today.noExercises}
                </T>
              ) : null}
              {programItems.length > 0 ? (
                <ListSurface>
                  {programItems.map((item, index) => (
                    <View key={item.ref}>
                      {index > 0 ? <Divider /> : null}
                      <ExerciseRow
                        name={item.name}
                        category={item.category}
                        summary={item.summary}
                        hasVideo={Boolean(parseMedia(item.media))}
                        accessibilityHint={m.today.start}
                        onPress={() =>
                          router.push({ pathname: "/session/[id]", params: { id: programCard.id, i: String(index) } })
                        }
                      />
                    </View>
                  ))}
                </ListSurface>
              ) : null}
              <Button
                label={m.mobile.today.commentsOpen}
                icon={MessageSquare}
                variant="secondary"
                compact
                onPress={() => setCommentsOpen(true)}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {sheet ? (
        <ValidationSheet
          target={targetOf(sheet.card)}
          status={sheet.status}
          justRecorded={sheet.justRecorded}
          existing={sheet.justRecorded || program.data?.id !== sheet.card.id ? null : program.data?.log}
          healthConsent={view?.healthConsent ?? false}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {commentsOpen && programCard ? (
        <Sheet visible title={m.comments.title} onClose={() => setCommentsOpen(false)}>
          <CommentsSection orgId={orgId} entityType="session" entityId={programCard.id} />
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
