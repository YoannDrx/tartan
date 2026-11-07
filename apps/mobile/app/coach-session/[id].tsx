import { tokens } from "@tartan/design-tokens";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { CommentsSection } from "../../src/features/comments";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace, useCoachSession } from "../../src/lib/queries";
import type { CoachSessionDetail } from "../../src/lib/schemas";
import { Camera, Send } from "../../src/ui/icons";
import { Button, Chip, Divider, IconButton, ListSurface, SectionTitle, T, Tag } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc } from "../../src/ui/status";
import { space } from "../../src/ui/theme";

type Athlete = CoachSessionDetail["athletes"][number];

const AthleteRow = ({
  athlete,
  onRemind,
  reminding,
  onSets,
}: {
  athlete: Athlete;
  onRemind: () => void;
  reminding: boolean;
  onSets?: () => void;
}) => {
  const late = athlete.status === "missed" || athlete.status === "upcoming";
  const doneSets = athlete.sets.filter((s) => s.done).length;
  const meta = [
    athlete.variant ? m.variant[athlete.variant] : null,
    athlete.rpe ? m.mobile.coach.rpe(athlete.rpe) : null,
    athlete.durationMin ? m.mobile.coach.duration(athlete.durationMin) : null,
    athlete.sets.length > 0 ? m.mobile.coach.setsDone(doneSets, athlete.sets.length) : null,
    athlete.attendance === "absent" ? m.mobile.coach.absent : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const areaName = athlete.pain
    ? ((m.bodyArea as Record<string, string>)[athlete.pain.bodyArea] ?? athlete.pain.bodyArea)
    : null;
  const sideName =
    athlete.pain && athlete.pain.side !== "none" ? (m.bodySide as Record<string, string>)[athlete.pain.side] : null;
  const area = areaName ? [areaName, sideName].filter(Boolean).join(" ") : null;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space.md,
        paddingLeft: space.md,
        paddingRight: space.xs,
        paddingVertical: space.md,
        alignItems: "flex-start",
        minHeight: 60,
      }}
    >
      <StatusDisc status={athlete.status} label={`${athlete.name} : ${m.status[athlete.status]}`} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="smallStrong">{athlete.name}</T>
        <T variant="caption" tone="muted">
          {meta || m.mobile.coach.noValidation}
        </T>
        {athlete.pain && area ? (
          <T variant="caption" tone="danger">
            {m.mobile.coach.pain(area, athlete.pain.intensity)}
          </T>
        ) : null}
        {athlete.comment ? <T variant="small">{athlete.comment}</T> : null}
        {onSets ? (
          <Button
            compact
            variant="secondary"
            label={m.progression.coachSetsTitle}
            accessibilityLabel={`${m.progression.coachSetsTitle} · ${athlete.name}`}
            onPress={onSets}
          />
        ) : null}
      </View>
      {late ? (
        <IconButton
          icon={Send}
          label={m.mobile.a11y.remindAthlete(athlete.name)}
          tone="filled"
          onPress={onRemind}
          disabled={reminding}
        />
      ) : null}
    </View>
  );
};

// Aucune présence présumée : tant que le coach n'a rien touché, la ligne reste non renseignée.
const RollCallRow = ({
  name,
  status,
  onChange,
}: {
  name: string;
  status: "present" | "absent" | null;
  onChange: (status: "present" | "absent") => void;
}) => (
  <View
    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, minHeight: 60 }}
    accessibilityRole="radiogroup"
    accessibilityLabel={name}
  >
    <T variant="bodyStrong" style={{ flex: 1 }}>
      {name}
    </T>
    <Chip
      testID={`roll-present-${name}`}
      tall
      label={m.mobile.coach.present}
      active={status === "present"}
      onPress={() => onChange("present")}
      accessibilityLabel={`${name} : ${m.mobile.coach.present}`}
    />
    <Chip
      testID={`roll-absent-${name}`}
      tall
      label={m.mobile.coach.absent}
      active={status === "absent"}
      onPress={() => onChange("absent")}
      accessibilityLabel={`${name} : ${m.mobile.coach.absent}`}
    />
  </View>
);

export default function CoachSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, orgId, space: active } = useActiveSpace();
  const detail = useCoachSession(orgId, id);
  const router = useRouter();
  const client = useQueryClient();
  const [rollCall, setRollCall] = useState<Record<string, "present" | "absent"> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Le coach n'est prévenu qu'au moment où il en a besoin : des absents, et pas de version autonomie.
  const [needsAutonomous, setNeedsAutonomous] = useState(false);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["coach-session", orgId, id] });
    void client.invalidateQueries({ queryKey: ["tracking", orgId] });
  };

  const remind = useMutation({
    mutationFn: (athleteIds?: string[]) => api.remind(orgId, id, athleteIds),
    onSuccess: (result) => setMessage(m.mobile.coach.remindDone(result.count)),
    onError: (error) => setMessage(errorMessage(error)),
  });
  const saveRoll = useMutation({
    mutationFn: (entries: { athleteId: string; status: "present" | "absent" }[]) =>
      api.rollCall(orgId, id, { entries }),
    onSuccess: (result) => {
      setRollCall(null);
      setNeedsAutonomous(result.absentCount > 0 && !result.hasAutonomous);
      setMessage(
        result.absentCount > 0 && !result.hasAutonomous
          ? m.coach.noAutonomous
          : m.coach.rollCallDone(result.hasAutonomous ? result.absentCount : 0),
      );
      refresh();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const generate = useMutation({
    mutationFn: () => api.generateAutonomous(orgId, id),
    onSuccess: () => {
      setMessage(m.mobile.coach.generated);
      refresh();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  if (me.data && !orgId) return <Redirect href="/" />;
  if (detail.isPending) {
    return (
      <StackScreen world="couloir">
        <LoadingState />
      </StackScreen>
    );
  }
  if (!detail.data) {
    return (
      <StackScreen world="couloir">
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </StackScreen>
    );
  }
  const session = detail.data;
  const subtitle = [capitalize(formatDateLong(session.date)), session.startTime?.replace(":", " h "), session.location]
    .filter(Boolean)
    .join(" · ");
  const late = session.athletes.filter((a) => a.status === "missed" || a.status === "upcoming");

  return (
    <StackScreen
      world="couloir"
      title={session.title}
      subtitle={subtitle}
      footer={
        rollCall ? (
          <View style={{ gap: space.sm }}>
            <Button
              testID="roll-save"
              label={m.coach.rollCallSave}
              loading={saveRoll.isPending}
              disabled={Object.keys(rollCall).length === 0}
              onPress={() =>
                saveRoll.mutate(Object.entries(rollCall).map(([athleteId, status]) => ({ athleteId, status })))
              }
            />
            <Button label={m.common.cancel} variant="secondary" compact onPress={() => setRollCall(null)} />
          </View>
        ) : undefined
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        <Tag label={m.sessionType[session.type]} tone={session.type === "jump" ? "jump" : "neutral"} />
        {session.hasAutonomous ? <Tag label={m.builder.versionAutonomous} /> : null}
        {session.publishedAt ? null : <Tag label={m.mobile.coach.draft} tone="brand" />}
      </View>

      {message ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {message}
        </T>
      ) : null}

      {session.athletes.length === 0 ? <EmptyState body={m.mobile.coach.noAudience} /> : null}

      {rollCall ? (
        <View style={{ gap: space.sm }}>
          <T variant="small" tone="muted">
            {m.mobile.coach.rollCallHint}
          </T>
          <ListSurface>
            {session.athletes.map((a, i) => (
              <View key={a.athleteId}>
                {i > 0 ? <Divider /> : null}
                <RollCallRow
                  name={a.name}
                  status={rollCall[a.athleteId] ?? null}
                  onChange={(status) => setRollCall({ ...rollCall, [a.athleteId]: status })}
                />
              </View>
            ))}
          </ListSurface>
        </View>
      ) : session.athletes.length > 0 ? (
        <>
          <View style={{ gap: space.sm }}>
            {session.publishedAt ? (
              <Button
                testID="open-roll-call"
                label={m.coach.rollCall}
                onPress={() =>
                  setRollCall(
                    Object.fromEntries(
                      session.athletes.flatMap((a) =>
                        a.attendance === "unknown" ? [] : [[a.athleteId, a.attendance] as const],
                      ),
                    ),
                  )
                }
              />
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {active?.progressionEnabled && session.canEdit && session.publishedAt ? (
                <Button
                  label={m.prescriptionRefresh.title}
                  variant="secondary"
                  compact
                  onPress={() => router.push({ pathname: "/refresh-loads/[id]", params: { id } })}
                />
              ) : null}
              {late.length > 0 && session.publishedAt ? (
                <Button
                  label={m.coach.remind}
                  icon={Send}
                  variant="secondary"
                  compact
                  style={{ flexGrow: 1 }}
                  accessibilityLabel={m.coach.remindAll}
                  loading={remind.isPending}
                  onPress={() => remind.mutate(undefined)}
                />
              ) : null}
              {session.type === "jump" ? (
                <Button
                  label={m.mobile.coach.filmSession}
                  icon={Camera}
                  variant="secondary"
                  compact
                  style={{ flexGrow: 1 }}
                  onPress={() => router.push({ pathname: "/capture", params: { sessionId: session.id } })}
                />
              ) : null}
            </View>
            {needsAutonomous && !session.hasAutonomous && session.canEdit ? (
              <Button
                label={m.coach.generateAutonomous}
                variant="secondary"
                compact
                loading={generate.isPending}
                onPress={() => generate.mutate()}
              />
            ) : null}
          </View>
          <ListSurface>
            {session.athletes.map((a, i) => (
              <View key={a.athleteId}>
                {i > 0 ? <Divider /> : null}
                <AthleteRow
                  athlete={a}
                  reminding={remind.isPending}
                  onRemind={() => remind.mutate([a.athleteId])}
                  onSets={
                    active?.progressionEnabled && session.canEdit && session.publishedAt
                      ? () => router.push({ pathname: "/coach-sets/[id]", params: { id, athleteId: a.athleteId } })
                      : undefined
                  }
                />
              </View>
            ))}
          </ListSurface>
        </>
      ) : null}

      {rollCall ? null : (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.comments.title}</SectionTitle>
          <CommentsSection orgId={orgId} entityType="session" entityId={session.id} />
        </View>
      )}
    </StackScreen>
  );
}
