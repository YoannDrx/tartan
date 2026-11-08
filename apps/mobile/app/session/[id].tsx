import { celebrationFromResponse } from "@tartan/domain";
import type { SessionCelebration } from "@tartan/contracts";
import type { ResolvedItem } from "@tartan/contracts";
import { countSets, formatDuration } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Pressable, Vibration, View } from "react-native";
import { ExerciseVideo, parseMedia, SPEEDS } from "../../src/features/media";
import { recordValidation, ValidationSheet, type ValidationTarget } from "../../src/features/validation-sheet";
import { useActiveSpace, useSessionDetail, useToday } from "../../src/lib/queries";
import { useSessionProgress } from "../../src/lib/session-progress";
import { ArrowRight, Check, Timer } from "../../src/ui/icons";
import { Button, Chip, T, Tag } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { color, radius, scene, space, usePalette } from "../../src/ui/theme";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;

// Compte à rebours fondé sur l'heure de fin : il reste juste si l'écran se met en veille.
const RestTimer = ({ seconds }: { seconds: number }) => {
  const p = usePalette();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endAt) return;
    const tick = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endAt) {
        setEndAt(null);
        Vibration.vibrate(400);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [endAt]);
  const left = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : seconds;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingLeft: space.lg,
        paddingRight: space.sm,
        paddingVertical: space.sm,
        borderRadius: radius.card,
        backgroundColor: p.surface,
      }}
    >
      <Timer size={22} color={p.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <T variant="small" style={{ flex: 1 }}>
        {m.mobile.sessionMode.restLabel}
      </T>
      <T
        variant="figure"
        style={{ fontSize: 22, lineHeight: 26 }}
        accessibilityLiveRegion={endAt ? "none" : "polite"}
        accessibilityLabel={`${m.mobile.sessionMode.restLabel} ${formatDuration(left)}`}
      >
        {clock(left)}
      </T>
      <Button
        testID="rest-toggle"
        label={endAt ? m.sessionMode.stopRest : m.sessionMode.startRest}
        variant="secondary"
        compact
        onPress={() => {
          if (endAt) setEndAt(null);
          else {
            setNow(Date.now());
            setEndAt(Date.now() + seconds * 1000);
          }
        }}
      />
    </View>
  );
};

const SetButton = ({ index, done, onPress }: { index: number; done: boolean; onPress: () => void }) => {
  const p = usePalette();
  return (
    <Pressable
      testID={`set-${index}`}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? m.sessionMode.setDone(index + 1) : m.sessionMode.setTodo(index + 1)}
      style={({ pressed }) => ({
        flexBasis: "18%",
        flexGrow: 1,
        minWidth: 60,
        height: 56,
        borderRadius: radius.card,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: done ? p.status.done : p.surface,
        borderWidth: done ? 0 : 1,
        borderColor: p.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {done ? (
        <Check
          size={22}
          color={p.onStatus}
          strokeWidth={2.6}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : (
        <T variant="figure" style={{ fontSize: 22, lineHeight: 26 }} accessibilityElementsHidden>
          {index + 1}
        </T>
      )}
    </Pressable>
  );
};

const NO_PROGRESS: Record<string, boolean[]> = {};

const flatten = (blocks: { items: ResolvedItem[] }[]): ResolvedItem[] => blocks.flatMap((b) => b.items);

export default function SessionMode() {
  const { id, i } = useLocalSearchParams<{ id: string; i?: string }>();
  const router = useRouter();
  const { me, orgId } = useActiveSpace();
  const detail = useSessionDetail(orgId, id);
  const today = useToday(orgId);
  const items = useMemo(() => flatten(detail.data?.blocks ?? []), [detail.data?.blocks]);
  const [index, setIndex] = useState(() => Math.max(0, Number(i ?? 0) || 0));
  const [rate, setRate] = useState<number>(0.5);
  const [finished, setFinished] = useState<{
    status: "done" | "partial";
    target: ValidationTarget;
    celebration?: SessionCelebration | null;
  } | null>(null);
  const validating = finished !== null;
  const sending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const progress = useSessionProgress((s) => s.bySession[id] ?? NO_PROGRESS);
  const toggle = useSessionProgress((s) => s.toggle);
  const clearProgress = useSessionProgress((s) => s.clear);

  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/today")), [router]);

  const confirmQuit = useCallback(() => {
    Alert.alert(m.sessionMode.quit, m.sessionMode.quitConfirm, [
      { text: m.mobile.sessionMode.continueLater, style: "cancel" },
      { text: m.mobile.sessionMode.quitNow, style: "destructive", onPress: leave },
    ]);
  }, [leave]);

  // Retour Android : confirmation, jamais de sortie sèche ; la feuille se ferme d'abord.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!validating) confirmQuit();
        return true;
      });
      return () => sub.remove();
    }, [confirmQuit, validating]),
  );

  if (me.data && !orgId) return <Redirect href="/" />;
  if (detail.isPending) {
    return (
      <StackScreen dark backIcon="close" onBack={leave}>
        <LoadingState />
      </StackScreen>
    );
  }
  if (!detail.data) {
    return (
      <StackScreen dark backIcon="close" onBack={leave}>
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </StackScreen>
    );
  }
  const session = detail.data;
  const item = items[Math.min(index, items.length - 1)];

  if (!item) {
    return (
      <StackScreen dark backIcon="close" onBack={leave} title={session.title}>
        <T>{m.mobile.sessionMode.empty}</T>
      </StackScreen>
    );
  }

  const total = countSets(item);
  const sets = progress[item.ref] ?? Array.from({ length: total }, () => false);
  const doneCount = sets.filter(Boolean).length;
  const last = index >= items.length - 1;
  const restSeconds = item.prescription.rest_s;
  const allSetsDone = items.every((it) => (progress[it.ref] ?? []).filter(Boolean).length >= countSets(it));

  const target = {
    orgId,
    sessionId: session.id,
    variant: session.variant,
    plannedMinutes: session.durationMin,
    sessionVersion: session.sessionVersion,
    logVersion: session.log?.version ?? session.logVersion ?? 0,
  };
  const setLogs = items.flatMap((it) =>
    (progress[it.ref] ?? []).map((done, setIndex) => ({ itemRef: it.ref, setIndex, done })),
  );

  return (
    <StackScreen
      dark
      right={
        session.progressionEnabled ? (
          <Button
            compact
            variant="secondary"
            label={m.progression.setsTitle}
            onPress={() => router.push(`/session-sets/${id}` as never)}
          />
        ) : undefined
      }
      backIcon="close"
      backLabel={m.sessionMode.quit}
      onBack={confirmQuit}
      subtitle={m.sessionMode.exerciseOf(index + 1, items.length)}
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            testID="session-previous"
            label={m.sessionMode.previous}
            variant="secondary"
            disabled={index === 0}
            style={{ flex: 1 }}
            onPress={() => setIndex(index - 1)}
          />
          {last ? (
            <Button
              testID="session-finish"
              label={m.sessionMode.finish}
              icon={Check}
              style={{ flex: 2 }}
              disabled={saving}
              onPress={async () => {
                if (sending.current) return;
                sending.current = true;
                setSaving(true);
                const status = allSetsDone ? "done" : "partial";
                const result = await recordValidation(target, status, setLogs);
                sending.current = false;
                setSaving(false);
                if (result.state === "error") {
                  setSaveError(result.message);
                  return;
                }
                setSaveError(null);
                clearProgress(id);
                setFinished({
                  status,
                  celebration: result.state === "sent" ? celebrationFromResponse(result.data) : null,
                  target: { ...target, logVersion: result.nextVersion },
                });
              }}
            />
          ) : (
            <Button
              testID="session-next"
              label={m.sessionMode.next}
              icon={ArrowRight}
              style={{ flex: 2 }}
              onPress={() => setIndex(index + 1)}
            />
          )}
        </View>
      }
    >
      {saveError ? (
        <T tone="danger" accessibilityRole="alert">
          {saveError}
        </T>
      ) : null}
      <View
        style={{ flexDirection: "row", gap: space.xs }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {items.map((it, n) => (
          <View
            key={it.ref}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: n <= index ? scene.actionOnCard : color.ink3,
            }}
          />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="display" heading>
          {item.name}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
          <Tag label={(m.exerciseCategory as Record<string, string>)[item.category] ?? item.category} />
          {item.summary ? (
            <T variant="small" tone="muted" style={{ flexShrink: 1 }}>
              {item.summary}
            </T>
          ) : null}
        </View>
        {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null ? (
          <T variant="caption" tone="link">
            {m.today.loadMissing}
          </T>
        ) : null}
      </View>

      {parseMedia(item.media) ? <ExerciseVideo key={item.ref} media={parseMedia(item.media)} rate={rate} /> : null}

      {parseMedia(item.media) ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
          accessibilityRole="radiogroup"
          accessibilityLabel={m.sessionMode.speed}
        >
          <T variant="caption" tone="muted">
            {m.sessionMode.speed}
          </T>
          {SPEEDS.map((s) => (
            <Chip
              key={s.value}
              tall
              minWidth={64}
              label={s.label}
              active={rate === s.value}
              onPress={() => setRate(s.value)}
            />
          ))}
        </View>
      ) : null}

      {item.cues.length > 0 || item.prescription.notes ? (
        <View
          style={{ padding: space.lg, borderRadius: radius.card, backgroundColor: scene.cardRaised, gap: space.sm }}
          accessibilityLabel={m.sessionMode.cues}
          accessible
        >
          {[...item.cues, ...(item.prescription.notes ? [item.prescription.notes] : [])].map((cue) => (
            <T key={cue} variant="small">
              {cue}
            </T>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T variant="section" heading>
            {m.sessionMode.sets}
          </T>
          <T variant="figure" accessibilityLabel={m.mobile.sessionMode.setsCount(doneCount, total)}>
            {doneCount} / {total}
          </T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {sets.map((done, n) => (
            <SetButton key={n} index={n} done={done} onPress={() => toggle(id, item.ref, n, total)} />
          ))}
        </View>
      </View>

      {restSeconds ? <RestTimer key={`${item.ref}-rest`} seconds={restSeconds} /> : null}

      {finished ? (
        <ValidationSheet
          dark
          target={finished.target}
          existing={session.log}
          status={finished.status}
          justRecorded
          celebration={finished.celebration}
          healthConsent={today.data?.healthConsent ?? false}
          onClose={() => router.replace("/today")}
        />
      ) : null}
    </StackScreen>
  );
}
