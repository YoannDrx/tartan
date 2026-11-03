import type { AthleteSessionCard } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { View } from "react-native";
import { BarGlyph } from "../ui/glyphs";
import { Check, Play } from "../ui/icons";
import { StatusGlyph } from "../ui/status";
import { Button, T, Tag } from "../ui/primitives";
import { radius, scene, Scene, space, usePalette } from "../ui/theme";

type HeroProps = {
  card: AthleteSessionCard;
  pending: boolean;
  onValidate: (status: "done" | "partial") => void;
  onStart: () => void;
  onEdit: () => void;
};

const metaLine = (card: AthleteSessionCard) =>
  [
    card.startTime?.replace(":", " h "),
    card.location,
    card.durationMin ? m.mobile.today.minutes(card.durationMin) : null,
    card.exerciseCount ? m.mobile.today.exercises(card.exerciseCount) : null,
  ]
    .filter(Boolean)
    .join(" · ");

// Question posée pour une séance à venir ; pour celle du jour, voir AttendanceLink.
export const AttendanceRow = ({
  card,
  onAnswer,
}: {
  card: AthleteSessionCard;
  onAnswer: (status: "present" | "absent") => void;
}) => {
  const answered = card.attendance !== "unknown";
  if (answered) {
    const present = card.attendance === "present";
    return (
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 }}>
          <T variant="small" style={{ flex: 1 }}>
            {present ? m.mobile.today.attendanceYesDone : m.mobile.today.attendanceNoDone}
          </T>
          <Button
            label={m.mobile.today.attendanceChange}
            variant="secondary"
            compact
            onPress={() => onAnswer(present ? "absent" : "present")}
            accessibilityLabel={`${m.mobile.today.attendanceChange} : ${present ? m.today.attendanceNo : m.today.attendanceYes}`}
          />
        </View>
        {!present && card.hasAutonomous ? (
          <T variant="caption" tone="muted">
            {m.today.switchedAutonomous}
          </T>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">{m.today.attendanceQuestion}</T>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button
          testID="attendance-yes"
          label={m.today.attendanceYes}
          variant="secondary"
          compact
          style={{ flex: 1 }}
          onPress={() => onAnswer("present")}
        />
        <Button
          testID="attendance-no"
          label={m.today.attendanceNo}
          variant="secondary"
          compact
          style={{ flex: 1 }}
          onPress={() => onAnswer("absent")}
        />
      </View>
    </View>
  );
};

// Séance du jour : un simple lien, et seulement si une version autonomie existe.
export const AttendanceLink = ({
  card,
  onAnswer,
}: {
  card: AthleteSessionCard;
  onAnswer: (status: "present" | "absent") => void;
}) => {
  if (!card.hasAutonomous) return null;
  const absent = card.attendance === "absent";
  return (
    <View style={{ gap: 2 }}>
      <Button
        testID="attendance-link"
        label={absent ? m.today.comingAfterAll : m.today.notComing}
        variant="ghost"
        compact
        style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
        onPress={() => onAnswer(absent ? "present" : "absent")}
      />
      {absent ? (
        <T variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {m.today.switchedAutonomous}
        </T>
      ) : null}
    </View>
  );
};

// Séance de saut : une ligne d'arrivée coupe le haut de la carte, avec le pictogramme de barre.
const SessionCardBody = ({ card, pending, onValidate, onStart, onEdit }: HeroProps) => {
  const p = usePalette();
  const jump = card.type === "jump";
  const validated = card.status === "done" || card.status === "partial";
  return (
    <>
      <View style={{ gap: space.sm, paddingRight: jump ? space.huge : 0 }}>
        {jump ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: "absolute",
              top: -space.xl,
              bottom: 0,
              right: space.md,
              width: 7,
              backgroundColor: p.text,
            }}
          />
        ) : null}
        <T variant="display" heading>
          {card.title}
        </T>
        {metaLine(card) ? (
          <T variant="small" tone="muted">
            {metaLine(card)}
          </T>
        ) : null}
        {card.coachName ? (
          <T variant="caption" tone="muted">
            {m.today.sentBy(card.coachName)}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: 2 }}>
          {jump ? <BarGlyph size={22} color={p.text} /> : null}
          <Tag label={m.sessionType[card.type]} tone={card.type === "jump" ? "jump" : "neutral"} />
          <Tag label={m.variant[card.variant]} />
        </View>
      </View>

      {validated ? (
        <View style={{ gap: space.md }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
            accessibilityLiveRegion="polite"
            accessible
          >
            <StatusGlyph status={card.status as "done" | "partial"} size={44} />
            <View style={{ flex: 1 }}>
              <T variant="title2">{card.status === "partial" ? m.today.validatedPartial : m.today.validated}</T>
              {pending ? (
                <T variant="caption" tone="muted">
                  {m.mobile.today.pending}
                </T>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={m.mobile.today.edit} variant="secondary" compact style={{ flex: 1 }} onPress={onEdit} />
            <Button
              label={m.mobile.today.viewProgram}
              variant="secondary"
              compact
              style={{ flex: 1 }}
              onPress={onStart}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {card.status === "missed" ? (
            <T variant="small" tone="muted">
              {m.mobile.today.missed}
            </T>
          ) : null}
          <Button testID="validate-done" label={m.today.quickDone} icon={Check} onPress={() => onValidate("done")} />
          <Button
            testID="validate-partial"
            label={m.today.quickPartial}
            variant="secondary"
            onPress={() => onValidate("partial")}
          />
          <Button
            testID="start-session"
            label={m.today.start}
            icon={Play}
            variant="secondary"
            compact
            onPress={onStart}
          />
        </View>
      )}
    </>
  );
};

// La séance du jour est le seul point focal en craie ; les autres séances restent sur l'encre.
export const SessionHero = ({ secondary, ...props }: HeroProps & { secondary?: boolean }) => (
  <Scene scene={secondary ? "card" : "hero"}>
    <View
      testID={secondary ? undefined : "session-hero"}
      style={{
        borderRadius: secondary ? radius.card : radius.hero,
        padding: space.xl,
        gap: space.lg,
        overflow: "hidden",
        backgroundColor: secondary ? scene.card : scene.hero,
      }}
    >
      <SessionCardBody {...props} />
    </View>
  </Scene>
);
