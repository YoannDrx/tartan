import { api } from "../../src/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { celebrationFromResponse, combinedWeek, programItems as programOf } from "@tartan/domain";
import type { SessionCelebration } from "@tartan/contracts";
import { dailyMantra, type EncouragementTone, capitalize, formatDateLong, m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { AthleteAfterSession, AthleteWelcome } from "../../src/features/athlete-onboarding";
import { CommentsSection } from "../../src/features/comments";
import { ExerciseRow, parseMedia } from "../../src/features/media";
import { PersonalFirstSteps } from "../../src/features/personal-first-steps";
import { Regularity } from "../../src/features/regularity";
import { AttendanceLink, AttendanceRow, SessionHero } from "../../src/features/session-hero";
import { recordValidation, ValidationSheet, type ValidationTarget } from "../../src/features/validation-sheet";
import { WeekStrip } from "../../src/features/week-strip";
import { localIsoDate } from "../../src/lib/dates";
import { personalAthleteOf } from "../../src/lib/personal-space";
import { useActiveSpace, usePrefetchUpcomingSessions, useSessionDetail, useToday } from "../../src/lib/queries";
import { submitAttendance, useOpQueue } from "../../src/lib/sync/op-queue";
import { applyPendingToCard, applyPendingToToday, pendingLogFor } from "../../src/lib/sync/queue-core";
import { MessageSquare, Pin } from "../../src/ui/icons";
import { Button, Card, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { scene, space } from "../../src/ui/theme";
import type { AthleteSessionCard } from "@tartan/contracts";

const nextLine = (card: AthleteSessionCard) =>
  [capitalize(formatDateLong(card.date)), card.startTime?.replace(":", " h "), card.location]
    .filter(Boolean)
    .join(" · ");

function DailyMantra({ tone }: { tone?: EncouragementTone }) {
  const [message, setMessage] = useState(() => dailyMantra(tone));
  useEffect(() => {
    const refresh = () => setMessage(dailyMantra(tone));
    refresh();
    const timer = setInterval(refresh, 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [tone]);
  return <T tone="muted">{message}</T>;
}

export default function Today() {
  const { me, orgId, space: active } = useActiveSpace();
  // L'athlète autonome, dans son espace personnel : il planifie lui-même, sans coach ni groupe à qui répondre.
  const self = personalAthleteOf(active);
  const personal = Boolean(self);
  const notebook = me.data?.spaces.find((s) => s.kind === "personal");
  const extraOrg = !personal ? (notebook?.organizationId ?? "") : "";
  const extra = useToday(extraOrg);
  const signup = useQuery({
    queryKey: ["signup-options"],
    queryFn: api.signupOptions,
    enabled: Boolean(me.data && !notebook),
  });
  const today = useToday(orgId);
  const client = useQueryClient();
  usePrefetchUpcomingSessions(orgId);
  const items = useOpQueue((s) => s.items);
  const router = useRouter();
  const date = localIsoDate();
  const [sheet, setSheet] = useState<{
    card: AthleteSessionCard;
    status: "done" | "partial";
    justRecorded: boolean;
    target: ValidationTarget;
    celebration?: SessionCelebration | null;
  } | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const personalCard = (id: string) => personal || Boolean(extra.data?.today.some((c) => c.id === id));
  const targetOf = (card: AthleteSessionCard): ValidationTarget => ({
    orgId: !personal && personalCard(card.id) ? extraOrg : orgId,
    sessionId: card.id,
    variant: card.variant,
    plannedMinutes: card.durationMin,
    sessionVersion: card.sessionVersion,
    logVersion: card.logVersion,
  });

  // Premier toucher : c'est enregistré. La feuille qui s'ouvre ne contient que du facultatif.
  const validate = async (card: AthleteSessionCard, status: "done" | "partial") => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    const target = targetOf(card);
    const result = await recordValidation(target, status);
    submitting.current = false;
    setSaving(false);
    if (result.state === "error") {
      setSaveError(result.message);
      return;
    }
    setSaveError(null);
    // Une première validation referme l'accueil et ouvre la carte facultative, ici comme sur les autres appareils.
    void client.invalidateQueries({ queryKey: ["onboarding", orgId] });
    void client.invalidateQueries({ queryKey: ["athlete-welcome", orgId] });
    setSheet({
      card,
      status,
      justRecorded: true,
      celebration: result.state === "sent" ? celebrationFromResponse(result.data) : null,
      target: { ...target, logVersion: result.nextVersion },
    });
  };
  const edit = (card: AthleteSessionCard) =>
    setSheet({
      card,
      status: card.status === "partial" ? "partial" : "done",
      justRecorded: false,
      target: targetOf(card),
    });

  const view = useMemo(() => {
    const merged = today.data ? applyPendingToToday(today.data, items, date) : null;
    // Dans son espace personnel, la séance vient de lui : aucune mention « envoyée par ».
    return merged && personal
      ? { ...merged, today: merged.today.map((card) => ({ ...card, coachName: null })) }
      : merged;
  }, [today.data, items, date, personal]);
  const main = view?.today.find((c) => c.status === "upcoming" || c.status === "missed") ?? view?.today[0] ?? null;
  const others = view?.today.filter((c) => c.id !== main?.id) ?? [];
  const next = [view?.next, extra.data?.next]
    .filter((card) => card != null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextPersonal = personal || Boolean(next && next.id === extra.data?.next?.id);
  const programCard = main ?? extra.data?.today[0] ?? next;
  const programPersonal = Boolean(
    programCard && (personalCard(programCard.id) || (programCard.id === next?.id && nextPersonal)),
  );
  const programOrg = !personal && programPersonal ? extraOrg : orgId;
  const program = useSessionDetail(programOrg, programCard?.id);
  const sheetDetail = useSessionDetail(sheet?.target.orgId ?? orgId, sheet?.card.id);
  // Un circuit repasse par les mêmes exercices : chacun une fois, avec ses passages, ouvert à son premier passage.
  const programItems = useMemo(() => {
    const steps = program.data?.blocks.flatMap((b) => b.items) ?? [];
    return programOf(steps).map(({ item, passes }) => ({ ...item, passes, step: steps.indexOf(item) }));
  }, [program.data?.blocks]);

  const greeting = view?.firstName ? m.today.greeting(view.firstName) : m.nav.aujourdhui;

  return (
    <TabScreen
      title={greeting}
      subtitle={capitalize(formatDateLong(date))}
      refreshing={today.isRefetching}
      onRefresh={() => {
        void today.refetch();
        if (extraOrg) void extra.refetch();
        void client.invalidateQueries({ queryKey: ["onboarding", orgId] });
        void client.invalidateQueries({ queryKey: ["sign-in-methods"] });
      }}
    >
      {saveError ? (
        <T tone="danger" accessibilityRole="alert">
          {saveError}
        </T>
      ) : null}
      {today.isPending ? <LoadingState /> : null}
      {extraOrg && extra.isError && !extra.data ? (
        <ErrorState error={extra.error} onRetry={() => void extra.refetch()} />
      ) : null}
      {today.isError && !view ? <ErrorState error={today.error} onRetry={() => void today.refetch()} /> : null}
      {view ? (
        <>
          {/* Un jour sans séance, l'accueil de l'athlète ouvre l'écran ; un jour de séance, il passe dessous. */}
          <AthleteWelcome
            orgId={orgId}
            sessionToday={view.today.length > 0 || Boolean(extra.data?.today.length)}
            placement="top"
          />
          <WeekStrip
            week={combinedWeek(view.week, extra.data ? applyPendingToToday(extra.data, items, date).week : undefined)}
            today={date}
          />

          {main && <SectionTitle>{personal ? m.brand.personalSession : m.brand.clubSession}</SectionTitle>}
          {main ? (
            <SessionHero
              card={main}
              pending={saving || Boolean(pendingLogFor(items, main.id))}
              onValidate={(status) => validate(main, status)}
              onEdit={() => edit(main)}
              onStart={() => router.push(`/session/${main.id}`)}
            />
          ) : extra.data?.today.length ? null : personal ? (
            <EmptyState body={m.mobile.solo.todayEmpty} />
          ) : (
            <EmptyState
              body={view.next ? m.mobile.today.restDay : m.today.noneYet}
              title={view.next ? m.today.empty : undefined}
            />
          )}

          {!main && personal ? (
            <Button
              testID="today-plan-session"
              label={m.mobile.solo.planSession}
              onPress={() =>
                router.push({ pathname: "/session-builder/[id]", params: { id: "new", date: localIsoDate() } })
              }
            />
          ) : null}

          {main && main.status === "upcoming" && !personal ? (
            <AttendanceLink
              card={main}
              onAnswer={(status) => void submitAttendance(orgId, main.id, status)}
              onReason={(reason) => void submitAttendance(orgId, main.id, "absent", reason)}
            />
          ) : null}

          {me.data?.preferences?.homeTone !== "off" && <DailyMantra tone={me.data?.preferences?.homeTone} />}
          {others.map((card) => (
            <SessionHero
              key={card.id}
              secondary
              card={card}
              pending={saving || Boolean(pendingLogFor(items, card.id))}
              onValidate={(status) => validate(card, status)}
              onEdit={() => edit(card)}
              onStart={() => router.push(`/session/${card.id}`)}
            />
          ))}

          {extra.data?.today.map((raw) => {
            const card = applyPendingToCard(raw, items);
            return (
              <View key={card.id}>
                <SectionTitle>{m.brand.personalSession}</SectionTitle>
                <SessionHero
                  card={{ ...card, coachName: null }}
                  secondary
                  pending={saving || Boolean(pendingLogFor(items, card.id))}
                  onValidate={(status) => validate(card, status)}
                  onEdit={() => edit(card)}
                  onStart={() => router.push({ pathname: "/session/[id]", params: { id: card.id, carnet: "1" } })}
                />
              </View>
            );
          })}
          {notebook?.aiPlannerEnabled || (!notebook && signup.data?.athlete) ? (
            <Button
              testID="personal-planner"
              label={m.aiPlanner.personalCreate}
              variant="secondary"
              onPress={() => {
                if (notebook) {
                  router.push("/planner");
                } else router.push({ pathname: "/(auth)/onboarding/solo", params: { ensuite: "planificateur" } });
              }}
            />
          ) : null}
          <AthleteWelcome
            orgId={orgId}
            sessionToday={view.today.length > 0 || Boolean(extra.data?.today.length)}
            placement="after"
          />
          {/* Ses premiers pas, après la séance du jour : jamais devant elle, jamais par-dessus. */}
          {self ? <PersonalFirstSteps orgId={orgId} athleteId={self} /> : null}
          <AthleteAfterSession orgId={orgId} />
          {!personal && <Button label={m.nav.annonces} variant="ghost" onPress={() => router.push("/news")} />}

          {main?.coachNote && !personal ? (
            <Card>
              <View style={{ gap: space.xs + 2 }}>
                <SectionTitle>{m.today.coachWord}</SectionTitle>
                <T variant="body">{main.coachNote}</T>
                {main.coachName ? (
                  <T variant="caption" tone="muted">
                    {main.coachName}
                  </T>
                ) : null}
              </View>
            </Card>
          ) : null}

          {view.regularity ? <Regularity {...view.regularity} /> : null}

          {!main && !extra.data?.today.length && next ? (
            <Card>
              <View style={{ gap: 2 }}>
                <T variant="title2" heading>
                  {next.title}
                </T>
                <T variant="small" tone="muted">
                  {`${m.today.next} : ${nextLine(next)}`}
                </T>
              </View>
              {nextPersonal ? null : (
                <AttendanceRow
                  card={applyPendingToCard(next, items)}
                  onAnswer={(status) => void submitAttendance(orgId, next.id, status)}
                  onReason={(reason) => void submitAttendance(orgId, next.id, "absent", reason)}
                />
              )}
            </Card>
          ) : null}

          {view.focus ? (
            <View style={{ gap: space.sm }}>
              <SectionTitle>{m.today.focusTitle}</SectionTitle>
              <Card>
                {view.focus.coachNote ? <T variant="body">{view.focus.coachNote}</T> : null}
                {view.focus.cues.map((item) => (
                  <T key={item.exercise} variant="small">
                    {`${item.exercise} : ${item.cue}`}
                  </T>
                ))}
                {view.focus.video ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push(`/video/${view.focus?.video?.id}`)}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <T variant="smallStrong">
                      {[view.focus.video.exerciseName, view.focus.video.text].filter(Boolean).join(" : ")}
                    </T>
                  </Pressable>
                ) : null}
              </Card>
            </View>
          ) : null}

          {programCard ? (
            <View style={{ gap: space.sm }}>
              <SectionTitle>{m.today.program}</SectionTitle>
              {program.isPending ? <LoadingState inline /> : null}
              {program.isError && !program.data ? (
                <ErrorState message={m.mobile.today.programError} onRetry={() => void program.refetch()} />
              ) : null}
              {program.data && programItems.length === 0 ? <T variant="small">{m.mobile.today.noExercises}</T> : null}
              {programItems.length > 0 ? (
                <ListSurface>
                  {programItems.map((item, index) => (
                    <View key={item.ref}>
                      {index > 0 ? <Divider /> : null}
                      <ExerciseRow
                        name={item.name}
                        category={item.category}
                        summary={item.passes > 1 ? `${item.summary}, ${m.today.passes(item.passes)}` : item.summary}
                        hasVideo={Boolean(parseMedia(item.media))}
                        accessibilityHint={m.today.start}
                        onPress={() =>
                          router.push({
                            pathname: "/session/[id]",
                            params: {
                              id: programCard.id,
                              i: String(item.step),
                              carnet: programPersonal ? "1" : undefined,
                            },
                          })
                        }
                      />
                    </View>
                  ))}
                </ListSurface>
              ) : null}
              {programPersonal ? null : (
                <Button
                  label={m.mobile.today.commentsOpen}
                  icon={MessageSquare}
                  variant="secondary"
                  compact
                  onPress={() => setCommentsOpen(true)}
                />
              )}
            </View>
          ) : null}

          {view.pinnedAnnouncement ? (
            <ListSurface style={{ flexDirection: "row", gap: space.md, padding: space.lg }}>
              <Pin size={18} color={scene.link} accessibilityElementsHidden importantForAccessibility="no" />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="small">{view.pinnedAnnouncement.body}</T>
                {view.pinnedAnnouncement.authorName ? (
                  <T variant="caption" tone="muted">
                    {view.pinnedAnnouncement.authorName}
                  </T>
                ) : null}
              </View>
            </ListSurface>
          ) : null}
        </>
      ) : null}

      {sheet && sheetDetail.data ? (
        <ValidationSheet
          target={
            sheet.justRecorded
              ? sheet.target
              : {
                  ...sheet.target,
                  sessionVersion: sheetDetail.data.sessionVersion,
                  logVersion: sheetDetail.data.log?.version ?? sheetDetail.data.logVersion ?? 0,
                }
          }
          status={sheet.status}
          justRecorded={sheet.justRecorded}
          celebration={sheet.celebration}
          existing={sheetDetail.data.log}
          healthConsent={(sheet.target.orgId === extraOrg ? extra.data?.healthConsent : view?.healthConsent) ?? false}
          personal={personalCard(sheet.card.id)}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet && !sheetDetail.data ? (
        <Sheet visible title={m.validation.title} onClose={() => setSheet(null)}>
          {sheetDetail.isError ? (
            <ErrorState error={sheetDetail.error} onRetry={() => void sheetDetail.refetch()} />
          ) : (
            <LoadingState />
          )}
        </Sheet>
      ) : null}

      {commentsOpen && programCard ? (
        <Sheet visible title={m.comments.title} onClose={() => setCommentsOpen(false)}>
          <CommentsSection orgId={programOrg} entityType="session" entityId={programCard.id} />
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
