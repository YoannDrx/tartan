import { athletePaint, gearPaint, SURFACES } from "@tartan/design-tokens/athletes";
import { athleteRig } from "@tartan/mascot/athletes";
import type { ExerciseClip } from "@tartan/mascot/exercise";
import { svgProp } from "@tartan/mascot/props";
import { svgAthlete, type SvgShape } from "@tartan/mascot/svg";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

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

// Une image du geste d'un exercice, à l'instant `t` de sa boucle : le matériel, l'athlète, puis ce qui passe devant lui.
// Décorative pour les lecteurs d'écran : le conteneur porte la description.
export const ExerciseScene = ({ clip, t, width }: { clip: ExerciseClip; t: number; width: number }) => {
  const { pose, root } = clip.frame(t);
  const gear = clip.gear(t);
  const figure = svgAthlete(athleteRig(clip.athlete, clip.face(t)), pose, athletePaint(clip.athlete, "ink"), root);
  const [x, y, w, h] = clip.view.split(" ").map(Number) as [number, number, number, number];
  const tilt = clip.tilt ? `rotate(${clip.tilt} ${x + w / 2} ${y + h / 2})` : undefined;
  const layer = (front: boolean) =>
    gear
      .filter((shape) => !!shape.front === front)
      .map((shape, index) => <Shape key={`${front}-${index}`} shape={svgProp(shape, gearPaint[shape.paint])} />);
  return (
    <Svg width={width} height={(width * h) / w} viewBox={clip.view} style={{ backgroundColor: SURFACES.ink, borderRadius: 12 }}>
      <G transform={tilt}>
        {layer(false)}
        <G transform={figure.root}>
          {figure.bones.map((bone) => (
            <G key={bone.id} transform={bone.transform}>
              {bone.shapes.map((shape, index) => (
                <Shape key={index} shape={shape} />
              ))}
            </G>
          ))}
        </G>
        {layer(true)}
      </G>
    </Svg>
  );
};
