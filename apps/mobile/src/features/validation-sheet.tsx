import type { BodyArea, BodySide, PainInput, SessionLogInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { submitValidation } from "../lib/sync/op-queue";
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
};

export type ExistingLog = { rpe: number | null; durationMin: number | null; comment: string | null };

// Le premier toucher enregistre : c'est le critère n°1 du produit. La feuille n'ajoute que du facultatif.
export const recordValidation = (target: ValidationTarget, status: Status, sets: Sets = []) =>
  submitValidation(target.orgId, target.sessionId, { status, variantDone: target.variant, sets });

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
  existing?: ExistingLog | null;
  healthConsent: boolean;
  sets?: Sets;
  dark?: boolean;
  onClose: () => void;
};

export const ValidationSheet = ({
  target,
  status: initialStatus,
  justRecorded,
  existing,
  healthConsent,
  sets = [],
  dark,
  onClose,
}: Props) => {
  const [status, setStatus] = useState(initialStatus);
  const [rpe, setRpe] = useState<number | null>(existing?.rpe ?? null);
  const [duration, setDuration] = useState(existing?.durationMin ? String(existing.durationMin) : "");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [painOn, setPainOn] = useState(false);
  const [area, setArea] = useState<BodyArea | null>(null);
  const [side, setSide] = useState<BodySide>("none");
  const [intensity, setIntensity] = useState(5);
  const [painError, setPainError] = useState<string | null>(null);
  // Seule une séance faite en entier déclenche le grand moment : jamais une validation partielle.
  const [burst, setBurst] = useState(justRecorded && initialStatus === "done" ? 1 : 0);
  const [announce, setAnnounce] = useState(justRecorded);

  // L'état reste annoncé aux lecteurs d'écran, avec ou sans animation.
  useEffect(() => {
    if (announce)
      AccessibilityInfo.announceForAccessibility(status === "partial" ? m.today.validatedPartial : m.today.validated);
  }, [announce, status]);

  const initialDuration = existing?.durationMin ? String(existing.durationMin) : "";
  const dirty =
    rpe !== (existing?.rpe ?? null) ||
    duration !== initialDuration ||
    comment.trim() !== (existing?.comment ?? "") ||
    painOn;

  const send = (nextStatus: Status): boolean => {
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
    void submitValidation(target.orgId, target.sessionId, {
      status: nextStatus,
      variantDone: target.variant,
      rpe: healthConsent ? rpe : null,
      durationMin,
      comment: comment.trim() || null,
      pain,
      sets,
    });
    return true;
  };

  // Rien de saisi ne se perd, quel que soit le bouton touché.
  const finish = () => {
    if (!dirty) {
      onClose();
      return;
    }
    if (send(status)) onClose();
  };

  // Une erreur de touche se corrige sans ressaisie.
  const switchStatus = () => {
    const next: Status = status === "done" ? "partial" : "done";
    if (!send(next)) return;
    setStatus(next);
    setAnnounce(true);
    setBurst(next === "done" ? burst + 1 : 0);
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
      overlay={burst > 0 ? <ValidationBurst key={burst} /> : null}
      onClose={finish}
      headerAction={<Button testID="validation-finish" label={m.validation.finish} onPress={finish} />}
    >
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

      <Button testID="validation-details" label={m.validation.addDetails} variant="secondary" onPress={finish} />
      <Button
        testID="validation-switch"
        label={status === "done" ? m.today.quickPartial : m.today.quickDone}
        variant="ghost"
        compact
        onPress={switchStatus}
      />
    </Sheet>
  );
};
