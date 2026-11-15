import { m } from "@tartan/i18n";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Card, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";

const SIZE = 88;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const LAP = 2 * Math.PI * RADIUS;

// La série de régularité : le tour se court au fil des séances rendues de la semaine, le chiffre au centre compte
// les semaines de suite (packages/domain/src/regularity.ts), comme sur le web.
export function Regularity({ weeks, planned, validated }: { weeks: number; planned: number; validated: number }) {
  const p = usePalette();
  const share = planned === 0 ? 0 : Math.min(1, validated / planned);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={m.today.regularity.lap(validated, planned)}
          accessibilityValue={{ min: 0, max: Math.max(planned, 1), now: validated }}
          style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
        >
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={p.border} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={p.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${LAP * share} ${LAP}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <T variant="figure" accessibilityElementsHidden importantForAccessibility="no">
            {String(weeks)}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="title2" heading>
            {m.today.regularity.title}
          </T>
          <T variant="smallStrong">
            {weeks > 0 ? `${weeks} ${m.today.regularity.weeks(weeks)}` : m.today.regularity.weeks(0)}
          </T>
          <T variant="caption" tone="muted">
            {m.today.regularity.rule}
          </T>
        </View>
      </View>
    </Card>
  );
}
