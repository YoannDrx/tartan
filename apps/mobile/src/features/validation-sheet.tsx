import { celebrationFromResponse } from "@tartan/domain";
import { ConfirmedRecords } from "./confirmed-records";
import type { SessionCelebration, BodyArea, BodySide, PainInput, SessionLogInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { feedbackAfterPendingLogs, versionAfterPendingLogs } from "../lib/sync/queue-core";
import { submitValidation, useOpQueue } from "../lib/sync/op-queue";
import { StatusGlyph } from "../ui/status";
import { Button, Chip, Field, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { space } from "../ui/theme";
import { ValidationBurst } from "./validation-burst";

type Sets = SessionLogInput["sets"];
type Status = "done" | "partial";

export type ValidationTarget = {
  orgId: string;
  sessionId: string;
  variant: "club" | "autonomous";
  plannedMinutes: number | null;
  sessionVersion?: number;
  logVersion?: number;
};

export type ExistingLog = {
  rpe: number | null;
  durationMin: number | null;
  comment: string | null;
  pain?: PainInput | null;
  version?: number;
};

// Le premier toucher enregistre : c'est le critère n°1 du produit. La feuille n'ajoute que du facultatif.
export const recordValidation = async (target: ValidationTarget, status: Status, sets: Sets = []) => {
  if (target.sessionVersion === undefined || target.logVersion === undefined)
    return { state: "error" as const, message: m.progression.sessionConflict };
  const expectedVersion = versionAfterPendingLogs(
    useOpQueue.getState().items,
    target.orgId,
    target.sessionId,
    target.sessionVersion,
    target.logVersion,
  );
  if (expectedVersion === null) return { state: "error" as const, message: m.offline.needsReview };
  const result = await submitValidation(target.orgId, target.sessionId, {
    writeScope: "status",
    status,
    variantDone: target.variant,
    sets,
    expectedVersion,
    expectedSessionVersion: target.sessionVersion,
  });
  return result.state === "error" ? result : { ...result, nextVersion: expectedVersion + 1 };
};

const Scale = ({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (n: number) => void;
  label: (n: number) => string;
}) => (
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
      <View key={n} style={{ flexBasis: "18%", flexGrow: 1 }}>
        <Chip label={String(n)} tall active={value === n} onPress={() => onChange(n)} accessibilityLabel={label(n)} />
      </View>
    ))}
  </View>
);

const AREAS = Object.keys(m.bodyArea) as BodyArea[];
const SIDES = (Object.keys(m.bodySide) as BodySide[]).filter((s) => s !== "none");

type Props = {
  target: ValidationTarget;
  status: Status;
  // Vrai juste après l'enregistrement ; faux quand on revient modifier une séance déjà validée.
  justRecorded: boolean;
  celebration?: SessionCelebration | null;
  existing?: ExistingLog | null;
  healthConsent: boolean;
  dark?: boolean;
  onClose: () => void;
};

export const ValidationSheet = ({
  target,
  status: initialStatus,
  justRecorded,
  celebration,
  existing,
  healthConsent,
  dark,
  onClose,
}: Props) => {
  const [initialFeedback] = useState(() => {
    const feedback = feedbackAfterPendingLogs(
      existing,
      useOpQueue.getState().items,
      target.orgId,
      target.sessionId,
      existing?.version ?? 0,
    );
    return healthConsent ? feedback : { ...feedback, rpe: null, pain: null };
  });
  const [baseline, setBaseline] = useState({
    rpe: initialFeedback.rpe ?? null,
    duration: initialFeedback.durationMin ? String(initialFeedback.durationMin) : "",
    comment: initialFeedback.comment ?? "",
    pain: initialFeedback.pain ?? null,
  });
  const [status, setStatus] = useState(initialStatus);
  const [startingVersion] = useState(() =>
    target.sessionVersion !== undefined && target.logVersion !== undefined
      ? versionAfterPendingLogs(
          useOpQueue.getState().items,
          target.orgId,
          target.sessionId,
          target.sessionVersion,
          target.logVersion,
        )
      : null,
  );
  const version = useRef(startingVersion);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [rpe, setRpe] = useState<number | null>(initialFeedback.rpe ?? null);
  const [duration, setDuration] = useState(initialFeedback.durationMin ? String(initialFeedback.durationMin) : "");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [comment, setComment] = useState(initialFeedback.comment ?? "");
  const [painOn, setPainOn] = useState(Boolean(initialFeedback.pain));
  const [area, setArea] = useState<BodyArea | null>(initialFeedback.pain?.bodyArea ?? null);
  const [side, setSide] = useState<BodySide>(initialFeedback.pain?.side ?? "none");
  const [intensity, setIntensity] = useState(initialFeedback.pain?.intensity ?? 5);
  const [painError, setPainError] = useState<string | null>(null);
  // Seule une séance faite en entier déclenche le grand moment : jamais une validation partielle.
  const [receipt, setReceipt] = useState(celebration ?? null);
  const [burst, setBurst] = useState(celebration && initialStatus === "done" ? 1 : 0);
  const [announce, setAnnounce] = useState(justRecorded);

  // L'état reste annoncé aux lecteurs d'écran, avec ou sans animation.
  useEffect(() => {
    if (announce)
      AccessibilityInfo.announceForAccessibility(status === "partial" ? m.today.validatedPartial : m.today.validated);
  }, [announce, status]);

  const currentPain = painOn && area ? { bodyArea: area, side, intensity } : null;
  const dirty =
    rpe !== baseline.rpe ||
    duration !== baseline.duration ||
    comment.trim() !== baseline.comment ||
    JSON.stringify(currentPain) !== JSON.stringify(baseline.pain) ||
    (painOn && !area);

  const send = async (nextStatus: Status): Promise<boolean> => {
    if (busy.current) return false;
    if (version.current === null || target.sessionVersion === undefined) {
      setSendError(m.progression.sessionConflict);
      return false;
    }
    let durationMin: number | null = null;
    if (duration.trim()) {
      const parsed = Number(duration);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 600) {
        setDurationError(m.mobile.validation.durationInvalid);
        return false;
      }
      durationMin = parsed;
    }
    if (healthConsent && painOn && !area) {
      setPainError(m.mobile.validation.painAreaRequired);
      return false;
    }
    const pain: PainInput | null = healthConsent && painOn && area ? { bodyArea: area, side, intensity } : null;
    busy.current = true;
    setSending(true);
    setSendError(null);
    const result = await submitValidation(target.orgId, target.sessionId, {
      writeScope: "feedback",
      expectedVersion: version.current,
      expectedSessionVersion: target.sessionVersion,
      status: nextStatus,
      variantDone: target.variant,
      ...(rpe !== baseline.rpe ? { rpe: healthConsent ? rpe : null } : {}),
      ...(duration !== baseline.duration ? { durationMin } : {}),
      ...(comment.trim() !== baseline.comment ? { comment: comment.trim() || null } : {}),
      ...(JSON.stringify(currentPain) !== JSON.stringify(baseline.pain) ? { pain } : {}),
    });
    busy.current = false;
    setSending(false);
    if (result.state === "error") {
      setSendError(result.message);
      return false;
    }
    const nextCelebration = result.state === "sent" ? celebrationFromResponse(result.data) : null;
    if (nextCelebration) {
      setReceipt(nextCelebration);
      setBurst((old) => old + 1);
    }
    version.current += 1;
    setBaseline({ rpe, duration, comment: comment.trim(), pain: currentPain });
    return true;
  };

  // Rien de saisi ne se perd, quel que soit le bouton touché.
  const finish = async () => {
    if (busy.current) return;
    if (!dirty) {
      onClose();
      return;
    }
    if (await send(status)) onClose();
  };

  // Une erreur de touche se corrige sans ressaisie.
  const switchStatus = async () => {
    const next: Status = status === "done" ? "partial" : "done";
    if (!(await send(next))) return;
    setStatus(next);
    setAnnounce(true);
    if (next !== "done") {
      setBurst(0);
      setReceipt(null);
    }
  };

  return (
    <Sheet
      visible
      dark={dark}
      title={status === "partial" ? m.today.validatedPartial : m.today.validated}
      titleIcon={
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <StatusGlyph status={status} size={28} />
        </View>
      }
      overlay={burst > 0 ? <ValidationBurst key={burst} recordCount={receipt?.records.length ?? 0} /> : null}
      onClose={finish}
      headerAction={
        <Button disabled={sending} testID="validation-finish" label={m.validation.finish} onPress={finish} />
      }
    >
      {sendError ? (
        <T tone="danger" accessibilityRole="alert">
          {sendError}
        </T>
      ) : null}
      <ConfirmedRecords records={receipt?.records ?? []} />
      {healthConsent ? (
        <View style={{ gap: space.sm }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.sm }}
          >
            <T variant="smallStrong">{m.validation.rpe}</T>
            <T variant="caption" tone="muted">
              {m.validation.rpeHint}
            </T>
          </View>
          <Scale value={rpe} onChange={(n) => setRpe(rpe === n ? null : n)} label={m.mobile.a11y.rpeValue} />
        </View>
      ) : null}

      <Field
        label={m.mobile.validation.duration}
        value={duration}
        onChangeText={(v) => {
          setDuration(v.replace(/[^0-9]/g, ""));
          setDurationError(null);
        }}
        keyboardType="number-pad"
        placeholder={target.plannedMinutes ? String(target.plannedMinutes) : undefined}
        error={durationError}
        maxLength={3}
      />

      <Field
        label={m.validation.comment}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={1000}
        placeholder={m.validation.commentPlaceholder}
      />

      {healthConsent ? (
        <View style={{ gap: space.md }}>
          <Button
            testID="validation-pain"
            label={painOn ? m.mobile.validation.painRemove : m.validation.pain}
            variant={painOn ? "secondary" : "danger"}
            compact
            onPress={() => {
              setPainOn(!painOn);
              setPainError(null);
            }}
            style={{ alignSelf: "flex-start" }}
          />
          {painOn ? (
            <View style={{ gap: space.md }}>
              <T variant="smallStrong">{m.validation.painArea}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {AREAS.map((a) => (
                  <Chip
                    key={a}
                    tall
                    label={m.bodyArea[a]}
                    active={area === a}
                    onPress={() => {
                      setArea(a);
                      setPainError(null);
                    }}
                  />
                ))}
              </View>
              {painError ? (
                <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
                  {painError}
                </T>
              ) : null}
              <T variant="smallStrong">{m.validation.painSide}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {SIDES.map((s) => (
                  <Chip
                    key={s}
                    tall
                    label={m.bodySide[s]}
                    active={side === s}
                    onPress={() => setSide(side === s ? "none" : s)}
                  />
                ))}
              </View>
              <T variant="smallStrong">{m.validation.painIntensity}</T>
              <Scale value={intensity} onChange={setIntensity} label={m.mobile.a11y.intensityValue} />
            </View>
          ) : null}
        </View>
      ) : (
        <T variant="caption" tone="muted">
          {m.validation.healthDisabled}
        </T>
      )}

      <Button
        disabled={sending}
        testID="validation-details"
        label={m.validation.addDetails}
        variant="secondary"
        onPress={finish}
      />
      <Button
        disabled={sending}
        testID="validation-switch"
        label={status === "done" ? m.today.quickPartial : m.today.quickDone}
        variant="ghost"
        compact
        onPress={switchStatus}
      />
    </Sheet>
  );
};
