import { BODY, JUMPER_POSES, type JumperPoseName } from "@tartan/design-tokens";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { jumperTransforms } from "./jumper-rig";
import { color, scene, usePalette } from "./theme";

const SKIN = color.film.skin;
// Assez large pour toutes les poses, y compris le corps renversé au-dessus de la barre.
const VIEW = "-190 -190 380 380";

const Limb = ({ length, width, shade = SKIN }: { length: number; width: number; shade?: string }) => (
  <Line x1={0} y1={0} x2={0} y2={length} stroke={shade} strokeWidth={width} strokeLinecap="round" />
);

const Leg = ({ knee, shorts, shoe }: { knee: string; shorts: string; shoe: string }) => (
  <>
    <Limb length={BODY.thigh} width={32} />
    <Limb length={BODY.thigh * 0.56} width={38} shade={shorts} />
    <G transform={knee}>
      <Limb length={BODY.shin} width={30} />
      <Rect x={-18} y={BODY.shin - 8} width={66} height={30} rx={15} fill={shoe} />
    </G>
  </>
);

const Arm = ({ elbow }: { elbow: string }) => (
  <>
    <Limb length={BODY.arm} width={26} />
    <G transform={elbow}>
      <Limb length={BODY.forearm} width={24} />
    </G>
  </>
);

type JumperProps = {
  pose?: JumperPoseName;
  size?: number;
  // Le maillot, les baskets et les cheveux changent seulement quand le fond les ferait disparaître.
  tee?: string;
  shorts?: string;
  shoe?: string;
  hair?: string;
};

// La mascotte : décorative, jamais lue par les lecteurs d'écran.
export const Jumper = ({
  pose = "stand",
  size = 120,
  tee = scene.hero,
  shorts = color.film.electric,
  shoe = color.film.lime,
  hair,
}: JumperProps) => {
  const p = usePalette();
  const t = jumperTransforms(JUMPER_POSES[pose]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={VIEW}>
        <G transform={t.root}>
          <G transform={t.legB}>
            <Leg knee={t.kneeB} shorts={shorts} shoe={shoe} />
          </G>
          <G transform={t.lean}>
            <G transform={t.shoulder}>
              <G transform={t.armB}>
                <Arm elbow={t.elbowB} />
              </G>
            </G>
          </G>
          <G transform={t.legA}>
            <Leg knee={t.kneeA} shorts={shorts} shoe={shoe} />
          </G>
          <G transform={t.lean}>
            <Rect x={-36} y={-BODY.torso - 8} width={72} height={BODY.torso + 24} rx={28} fill={tee} />
            <Rect x={-37} y={-14} width={74} height={34} rx={16} fill={shorts} />
            <G transform={t.head}>
              <Circle r={44} fill={SKIN} />
              <Path d="M -43 -10 A 44 44 0 0 1 43 -10 Z" fill={hair ?? p.jumperHair} />
              <Circle cx={15} cy={6} r={6} fill={color.ink} />
              <Circle cx={31} cy={6} r={6} fill={color.ink} />
            </G>
            <G transform={t.shoulder}>
              <G transform={t.armA}>
                <Arm elbow={t.elbowA} />
              </G>
            </G>
          </G>
        </G>
      </Svg>
    </View>
  );
};
