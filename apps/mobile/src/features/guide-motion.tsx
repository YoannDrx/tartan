import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { positionAt, type ExerciseClip } from "@tartan/mascot/exercise";
import { exerciseClip } from "@tartan/mascot/exercises";
import { guidePositionAt } from "@tartan/mascot/v2/gesture";
import type { GestureView } from "@tartan/mascot/v2/project";
import { gestureEntry } from "@tartan/mascot/v2/registry";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { framePace } from "../lib/frame-pace";
import { ExerciseScene, GestureScene } from "../ui/exercise-scene";
import { Button, T } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";

const t = m.exerciseGuide.motion;

// Le réglage « réduire les animations » de l'appareil. `null` tant qu'on ne le connaît pas : rien ne bouge.
const useReducedMotion = () => {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => true)
      .then((value) => {
        if (!cancelled) setReduced(value);
      });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      listener.remove();
    };
  }, []);
  return reduced;
};

// Une pastille de position ou un choix de vue : une cible de 44 points, pleine quand elle est choisie.
const Chip = ({
  label,
  text,
  chosen,
  selected,
  onPress,
  testID,
}: {
  label: string;
  text: string;
  chosen: boolean;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minWidth: 44,
        height: 44,
        paddingHorizontal: text.length > 1 ? space.md : 0,
        borderRadius: radius.button,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: chosen ? p.accent : p.border,
        backgroundColor: chosen ? p.accent : "transparent",
      }}
    >
      <T variant="smallStrong" style={{ color: chosen ? p.accentText : p.text }}>
        {text}
      </T>
    </Pressable>
  );
};

// Le geste du guide : il tourne en boucle, une pastille par ligne du guide montre où il en est, la ligne en cours
// s'affiche dessous. En mouvement réduit : la frise des positions, dans l'ordre.
// Le nouveau moteur prend le geste dès qu'il le peut (`motionEngine`), avec ses deux vues ; un geste à reprendre
// garde l'ancien moteur.
export function GuideMotion({ guide }: { guide: ExerciseGuide }) {
  if (gestureEntry(guide.catalogKey)) return <GestureMotion guide={guide} />;
  const fallback = exerciseClip(guide.catalogKey);
  return fallback ? <ClipMotion guide={guide} clip={fallback} /> : null;
}

// --- Nouveau moteur ---------------------------------------------------------------------------------
// Chaque image passe par un rendu React, limité à trente images par seconde : la mise à jour directe des tracés
// (`setNativeProps`) n'a pas été éprouvée sur appareil sous la nouvelle architecture.
function GestureMotion({ guide }: { guide: ExerciseGuide }) {
  const entry = useMemo(() => gestureEntry(guide.catalogKey)!, [guide.catalogKey]);
  const { clip } = entry;
  const [width, setWidth] = useState(0);
  const [time, setTime] = useState(clip.positions[0]!.still);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<GestureView>(entry.native);
  const reduced = useReducedMotion();
  const running = playing && reduced === false;
  const lines = guide.illustration.positions;

  useEffect(() => {
    if (!running) return;
    const pace = framePace(30);
    let frame = requestAnimationFrame(function tick() {
      const elapsed = pace(Date.now());
      if (elapsed) setTime((current) => (current + elapsed / clip.duration) % 1);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, clip.duration]);

  const caption =
    guide.illustration.motion === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending;
  const views =
    entry.views.length > 1 ? (
      <View accessibilityLabel={t.view} style={{ flexDirection: "row", gap: space.xs }}>
        {entry.views.map((option) => (
          <Chip
            key={option}
            testID={`exercise-guide-view-${option}`}
            label={t.views[option]}
            text={t.views[option]}
            chosen={view === option}
            selected={view === option}
            onPress={() => setView(option)}
          />
        ))}
      </View>
    ) : null;

  if (reduced !== false)
    return (
      <View style={{ gap: space.sm }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View accessibilityLabel={t.positions} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {width > 0
            ? clip.positions.map((step) => (
                <View
                  key={step.guide}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`${t.position(step.guide)} : ${lines[step.guide] ?? guide.illustration.alt}`}
                  style={{ gap: space.xs, width: (width - space.sm) / 2 }}
                >
                  <GestureScene clip={clip} t={step.still} view={view} width={(width - space.sm) / 2} />
                  <T variant="small" tone="muted">
                    {t.position(step.guide)}
                  </T>
                </View>
              ))
            : null}
        </View>
        {views}
        <T variant="small" tone="muted">
          {`${t.reduced} ${caption}`}
        </T>
      </View>
    );

  const current = guidePositionAt(clip, time);
  const step = clip.positions[current]!;
  return (
    <View
      testID="exercise-guide-motion"
      style={{ gap: space.sm }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View accessible accessibilityRole="image" accessibilityLabel={guide.illustration.alt}>
        {width > 0 ? <GestureScene clip={clip} t={time} view={view} width={width} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
        <Button
          label={running ? t.pause : t.play}
          variant="secondary"
          compact
          selected={running}
          onPress={() => setPlaying(!running)}
          testID="exercise-guide-play"
        />
        <View accessibilityLabel={t.positions} style={{ flexDirection: "row", gap: space.xs }}>
          {clip.positions.map((option, index) => (
            <Chip
              key={option.guide}
              label={t.show(index + 1, t.position(option.guide))}
              text={String(index + 1)}
              chosen={current === index}
              selected={!running && current === index}
              onPress={() => {
                setPlaying(false);
                setTime(option.still);
              }}
            />
          ))}
        </View>
        {views}
      </View>
      <T accessibilityLiveRegion={running ? "none" : "polite"}>
        <T variant="smallStrong">{`${t.position(step.guide)} : `}</T>
        {lines[step.guide]}
      </T>
      <T variant="small" tone="muted">
        {caption}
      </T>
    </View>
  );
}

// --- Premier moteur : les gestes à reprendre, tant qu'ils ne sont pas réécrits ------------------------------
function ClipMotion({ guide, clip }: { guide: ExerciseGuide; clip: ExerciseClip }) {
  const [width, setWidth] = useState(0);
  const [time, setTime] = useState(clip.stills[0]!);
  const [playing, setPlaying] = useState(true);
  const reduced = useReducedMotion();
  const running = playing && reduced === false;
  const lines = guide.illustration.positions;

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setTime((current) => (current + elapsed / clip.duration) % 1);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, clip.duration]);

  const caption =
    guide.illustration.motion === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending;

  if (reduced !== false)
    return (
      <View style={{ gap: space.sm }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View accessibilityLabel={t.positions} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {width > 0
            ? clip.stills.map((still, index) => (
                <View
                  key={index}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`${t.position(index)} : ${lines[index] ?? guide.illustration.alt}`}
                  style={{ gap: space.xs, width: (width - space.sm) / 2 }}
                >
                  <ExerciseScene clip={clip} t={still} width={(width - space.sm) / 2} />
                  <T variant="small" tone="muted">
                    {t.position(index)}
                  </T>
                </View>
              ))
            : null}
        </View>
        <T variant="small" tone="muted">
          {`${t.reduced} ${caption}`}
        </T>
      </View>
    );

  const current = positionAt(clip, time);
  return (
    <View
      testID="exercise-guide-motion"
      style={{ gap: space.sm }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View accessible accessibilityRole="image" accessibilityLabel={guide.illustration.alt}>
        {width > 0 ? <ExerciseScene clip={clip} t={time} width={width} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
        <Button
          label={running ? t.pause : t.play}
          variant="secondary"
          compact
          selected={running}
          onPress={() => setPlaying(!running)}
          testID="exercise-guide-play"
        />
        <View accessibilityLabel={t.positions} style={{ flexDirection: "row", gap: space.xs }}>
          {clip.stills.map((still, index) => (
            <Chip
              key={index}
              label={t.show(index + 1, t.position(index))}
              text={String(index + 1)}
              chosen={current === index}
              selected={!running && current === index}
              onPress={() => {
                setPlaying(false);
                setTime(still);
              }}
            />
          ))}
        </View>
      </View>
      <T accessibilityLiveRegion={running ? "none" : "polite"}>
        <T variant="smallStrong">{`${t.position(current)} : `}</T>
        {lines[current]}
      </T>
      <T variant="small" tone="muted">
        {caption}
      </T>
    </View>
  );
}
