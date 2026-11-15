import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { positionAt, type ExerciseClip } from "@tartan/mascot/exercise";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { ExerciseScene } from "../ui/exercise-scene";
import { Button, T } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";

const t = m.exerciseGuide.motion;

// Le geste du guide : il tourne en boucle, une pastille par ligne du guide montre où il en est, la ligne en cours
// s'affiche dessous. En mouvement réduit : la frise des positions, dans l'ordre.
export function GuideMotion({ guide, clip }: { guide: ExerciseGuide; clip: ExerciseClip }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const [time, setTime] = useState(clip.stills[0]!);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const running = playing && reduced === false;
  const lines = guide.illustration.positions;

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

  const caption = guide.illustration.motion === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending;

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
    <View testID="exercise-guide-motion" style={{ gap: space.sm }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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
          {clip.stills.map((still, index) => {
            const active = current === index;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={t.show(index + 1, t.position(index))}
                accessibilityState={{ selected: !running && active }}
                onPress={() => {
                  setPlaying(false);
                  setTime(still);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.button,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? p.accent : p.border,
                  backgroundColor: active ? p.accent : "transparent",
                }}
              >
                <T variant="smallStrong" style={{ color: active ? p.accentText : p.text }}>
                  {String(index + 1)}
                </T>
              </Pressable>
            );
          })}
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
