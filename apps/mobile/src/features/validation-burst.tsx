import { m } from "@tartan/i18n";
import { T } from "../ui/primitives";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { Check } from "../ui/icons";
import { Jumper } from "../ui/jumper";
import { color, scene } from "../ui/theme";

const DURATION = 1100;
const film = color.film;

type Piece = {
  x: number;
  y: number;
  spin: number;
  size: number;
  shape: "circle" | "bar" | "triangle";
  tint: string;
};

// Une gerbe fixe : mêmes confettis à chaque fois, aucun calcul pendant le moment.
const TINTS = [color.brand, film.electric, color.ink, film.sun, color.white];
const SHAPES: Piece["shape"][] = ["circle", "bar", "triangle"];
const COUNT = 20;
const PIECES: Piece[] = Array.from({ length: COUNT }, (_, i) => {
  const angle = (i / COUNT) * Math.PI * 2 + (i % 2) * 0.22;
  const reach = 170 + ((i * 37) % 90);
  return {
    x: Math.round(Math.cos(angle) * reach),
    y: Math.round(Math.sin(angle) * reach * 1.45),
    spin: (i % 2 ? -1 : 1) * (200 + ((i * 53) % 260)),
    size: 12 + ((i * 7) % 12),
    shape: SHAPES[i % SHAPES.length] as Piece["shape"],
    tint: TINTS[i % TINTS.length] as string,
  };
});

const Confetto = ({ piece, clock }: { piece: Piece; clock: Animated.Value }) => {
  const { size, tint, shape } = piece;
  const look =
    shape === "circle"
      ? { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }
      : shape === "bar"
        ? { width: size, height: size / 2, borderRadius: 3, backgroundColor: tint }
        : {
            width: 0,
            height: 0,
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: tint,
          };
  return (
    <Animated.View
      style={[
        look,
        {
          position: "absolute",
          opacity: clock.interpolate({ inputRange: [0.08, 0.1, 0.8, 0.95], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              translateX: clock.interpolate({ inputRange: [0.08, 0.42, 1], outputRange: [0, piece.x * 0.82, piece.x] }),
            },
            {
              // Le jet part vite et ralentit, puis tout retombe un peu.
              translateY: clock.interpolate({
                inputRange: [0.08, 0.42, 1],
                outputRange: [0, piece.y * 0.82, piece.y + 90],
              }),
            },
            {
              rotate: clock.interpolate({
                inputRange: [0.08, 1],
                outputRange: ["0deg", `${piece.spin}deg`],
              }),
            },
          ],
        },
      ]}
    />
  );
};

// Le seul grand moment de l'app : la validation d'une séance. Rien n'attend sa fin, rien ne le touche.
export const ValidationBurst = ({ recordCount = 0 }: { recordCount?: number }) => {
  const clock = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stoppedForMotion = false;
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => {
      if (reduced) {
        stoppedForMotion = true;
        clock.stopAnimation();
        setPlaying(false);
      }
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => true)
      .then((reduced) => {
        if (cancelled || reduced || stoppedForMotion) return;
        setPlaying(true);
        Animated.timing(clock, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          if (!cancelled) setPlaying(false);
        });
      });
    return () => {
      cancelled = true;
      motion.remove();
      clock.stopAnimation();
    };
  }, [clock]);

  if (!playing) return null;

  return (
    <Animated.View
      testID="validation-burst"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: scene.actionOnCard,
          // 150 ms pour entrer, 250 ms pour sortir.
          opacity: clock.interpolate({ inputRange: [0, 0.136, 0.773, 1], outputRange: [0, 1, 1, 0] }),
        },
      ]}
    >
      {recordCount > 0 ? (
        <T
          variant="section"
          style={{ position: "absolute", top: "15%", color: color.ink, textAlign: "center", paddingHorizontal: 24 }}
        >
          {m.strengthRecords.celebration(recordCount)}
        </T>
      ) : null}
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {PIECES.map((piece, i) => (
          <Confetto key={i} piece={piece} clock={clock} />
        ))}
      </View>
      <Animated.View
        style={{
          // Un léger rebond : un dépassement, un retour, puis le repos.
          transform: [
            {
              scale: clock.interpolate({
                inputRange: [0.06, 0.2, 0.28, 0.36],
                outputRange: [0.4, 1.12, 0.96, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Check size={148} color={color.ink} strokeWidth={3.4} />
      </Animated.View>
      <Animated.View
        style={{
          transform: [
            {
              translateY: clock.interpolate({
                inputRange: [0.1, 0.28, 0.36],
                outputRange: [28, -6, 0],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Jumper pose="cheer" size={220} tee={color.brand} shoe={color.ink} hair={color.ink} />
      </Animated.View>
    </Animated.View>
  );
};
