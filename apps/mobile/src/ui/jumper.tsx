import type { PoseName } from "@tartan/mascot/poses";
import type { SvgShape } from "@tartan/mascot/svg";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { JUMPER_VIEW, jumperFigure } from "./jumper-rig";
import { color, scene, usePalette } from "./theme";

const Shape = ({ shape }: { shape: SvgShape }) => {
  switch (shape.tag) {
    case "line": {
      const { tag: _tag, ...line } = shape;
      return <Line {...line} />;
    }
    case "rect": {
      const { tag: _tag, ...rect } = shape;
      return <Rect {...rect} />;
    }
    case "circle": {
      const { tag: _tag, ...circle } = shape;
      return <Circle {...circle} />;
    }
    case "path": {
      const { tag: _tag, ...path } = shape;
      return <Path {...path} />;
    }
  }
};

type JumperProps = {
  pose?: PoseName;
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
  const figure = jumperFigure(pose, {
    skin: color.film.skin,
    tee,
    shorts,
    shoe,
    hair: hair ?? p.jumperHair,
    eye: color.ink,
  });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={JUMPER_VIEW}>
        <G transform={figure.root}>
          {figure.bones.map((bone) => (
            <G key={bone.id} transform={bone.transform}>
              {bone.shapes.map((shape, index) => (
                <Shape key={index} shape={shape} />
              ))}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
};
