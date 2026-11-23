import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { usePalette } from "./theme";

// Le tour de piste, en ovale : la part courue des premiers pas. Elle se dit aussi en toutes lettres à côté
// (DESIGN.md, `TrackLap`) ; le dessin est décoratif.
const WIDTH = 96;
const HEIGHT = 48;
const STROKE = 6;
// Un ovale de stade : deux droites et deux virages, parcouru depuis la ligne d'arrivée, en bas à gauche.
const R = (HEIGHT - STROKE) / 2;
const LEFT = STROKE / 2 + R;
const RIGHT = WIDTH - STROKE / 2 - R;
const TOP = STROKE / 2;
const BOTTOM = HEIGHT - STROKE / 2;
const LAP = `M ${LEFT} ${BOTTOM} L ${RIGHT} ${BOTTOM} A ${R} ${R} 0 0 0 ${RIGHT} ${TOP} L ${LEFT} ${TOP} A ${R} ${R} 0 0 0 ${LEFT} ${BOTTOM}`;
const LENGTH = 2 * (RIGHT - LEFT) + 2 * Math.PI * R;

export const TrackLap = ({ done, total }: { done: number; total: number }) => {
  const p = usePalette();
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Path d={LAP} fill="none" stroke={p.border} strokeWidth={STROKE} />
        {share > 0 ? (
          <Path
            d={LAP}
            fill="none"
            stroke={p.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${LENGTH * share} ${LENGTH}`}
          />
        ) : null}
      </Svg>
    </View>
  );
};
