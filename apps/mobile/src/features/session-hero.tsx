import type { AthleteSessionCard } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { View } from "react-native";
import { LaneArcs } from "../ui/glyphs";
import { Check, Play } from "../ui/icons";
import { StatusGlyph } from "../ui/status";
import { Button, T, Tag } from "../ui/primitives";
import { color, radius, space } from "../ui/theme";

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

// Carte héros : fond Piste pour une séance de saut, surface blanche pour le reste.
export const SessionHero = ({ card, pending, onValidate, onStart, onEdit }: HeroProps) => {
  const jump = card.type === "jump";
  const validated = card.status === "done" || card.status === "partial";
  const titleTone = jump ? "white" : "default";
  const mutedTone = jump ? "white" : "muted";
  const outline = jump ? "onBrandOutline" : "secondary";
  return (
    <View
      testID="session-hero"
      style={{
        borderRadius: radius.hero,
        padding: space.xl,
        gap: space.lg,
        overflow: "hidden",
        backgroundColor: jump ? color.brand : color.surface,
        borderWidth: jump ? 0 : 1,
        borderColor: color.border,
      }}
    >
      <View
        style={{ position: "absolute", right: -60, bottom: -60 }}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LaneArcs color={jump ? color.white : color.brand} opacity={jump ? 0.18 : 0.1} />
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="display" tone={titleTone} heading>
          {card.title}
        </T>
        {metaLine(card) ? (
          <T variant="small" tone={mutedTone}>
            {metaLine(card)}
          </T>
        ) : null}
        {card.coachName ? (
          <T variant="caption" tone={mutedTone}>
            {m.today.sentBy(card.coachName)}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 2 }}>
          <Tag label={m.sessionType[card.type]} tone={jump ? "onBrand" : "neutral"} />
          <Tag label={m.variant[card.variant]} tone={jump ? "onBrand" : "neutral"} />
        </View>
      </View>

      {validated ? (
        <View style={{ gap: space.md }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
            accessibilityLiveRegion="polite"
            accessible
          >
            <View
              style={{ backgroundColor: jump ? color.white : "transparent", borderRadius: 26, padding: jump ? 4 : 0 }}
            >
              <StatusGlyph status={card.status as "done" | "partial"} size={44} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="title2" tone={titleTone}>
                {card.status === "partial" ? m.today.validatedPartial : m.today.validated}
              </T>
              {pending ? (
                <T variant="caption" tone={mutedTone}>
                  {m.mobile.today.pending}
                </T>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={m.mobile.today.edit} variant={outline} compact style={{ flex: 1 }} onPress={onEdit} />
            <Button
              label={m.mobile.today.viewProgram}
              variant={outline}
              compact
              style={{ flex: 1 }}
              onPress={onStart}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {card.status === "missed" ? (
            <T variant="small" tone={mutedTone}>
              {m.mobile.today.missed}
            </T>
          ) : null}
          <Button
            testID="validate-done"
            label={m.today.quickDone}
            icon={Check}
            variant={jump ? "onBrand" : "primary"}
            onPress={() => onValidate("done")}
          />
          <Button
            testID="validate-partial"
            label={m.today.quickPartial}
            variant={outline}
            onPress={() => onValidate("partial")}
          />
          <Button
            testID="start-session"
            label={m.today.start}
            icon={Play}
            variant={outline}
            compact
            onPress={onStart}
          />
        </View>
      )}
    </View>
  );
};
