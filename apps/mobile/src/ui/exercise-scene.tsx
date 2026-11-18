import { athletePaint, gearPaint, SURFACES } from "@tartan/design-tokens/athletes";
import { athleteRig } from "@tartan/mascot/athletes";
import type { ExerciseClip } from "@tartan/mascot/exercise";
import { svgProp } from "@tartan/mascot/props";
import { svgAthlete, svgShape, type SvgShape } from "@tartan/mascot/svg";
import { drawClip, framing, staged, type Box, type ScenePaint } from "@tartan/mascot/v2/draw-svg";
import type { MotionClip } from "@tartan/mascot/v2/gesture";
import type { GestureView } from "@tartan/mascot/v2/project";
import { memo } from "react";
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
  const figure = svgAthlete(
    athleteRig(clip.athlete, clip.face(t), clip.facing),
    pose,
    athletePaint(clip.athlete, "ink"),
    root,
  );
  const [x, y, w, h] = clip.view.split(" ").map(Number) as [number, number, number, number];
  const tilt = clip.tilt ? `rotate(${clip.tilt} ${x + w / 2} ${y + h / 2})` : undefined;
  const layer = (front: boolean) =>
    gear
      .filter((shape) => !!shape.front === front)
      .map((shape, index) => <Shape key={`${front}-${index}`} shape={svgProp(shape, gearPaint[shape.paint])} />);
  return (
    <Svg
      width={width}
      height={(width * h) / w}
      viewBox={clip.view}
      style={{ backgroundColor: SURFACES.ink, borderRadius: 12 }}
    >
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

// --- Le nouveau moteur : un geste en trois dimensions, vu de profil, de face ou de dessus -----------------

// Le cadre d'un geste dans une vue, au format 3:2. Mesuré une fois par geste et par vue : le calcul parcourt la boucle.
const stages = new Map<string, Box>();
const stageOf = (clip: MotionClip, view: GestureView): Box => {
  const key = `${clip.key}/${view}`;
  let box = stages.get(key);
  if (!box) {
    box = staged(framing(clip, view, 14, 32), view);
    stages.set(key, box);
  }
  return box;
};

// Une image du geste à l'instant `t`, dans la vue demandée : chaque partie du corps est un aplat, du fond vers le
// devant. Décorative pour les lecteurs d'écran : le conteneur porte la description.
export const GestureScene = memo(function GestureScene({
  clip,
  t,
  view,
  width,
}: {
  clip: MotionClip;
  t: number;
  view: GestureView;
  width: number;
}) {
  const box = stageOf(clip, view);
  const paint: ScenePaint = { ...gearPaint, ...athletePaint(clip.athlete, "ink") };
  return (
    <Svg
      width={width}
      height={(width * box.height) / box.width}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={{ backgroundColor: SURFACES.ink, borderRadius: 12 }}
    >
      {view === "top" ? null : (
        <Line x1={box.x} y1={2} x2={box.x + box.width} y2={2} stroke={gearPaint.floor} strokeWidth={4} />
      )}
      {drawClip(clip, t, view).map((node) =>
        node.kind === "path" ? (
          <Path key={node.id} d={node.d} fill={paint[node.paint]} />
        ) : node.kind === "prop" ? (
          <Shape key={node.id} shape={svgProp(node.geometry, paint[node.paint])} />
        ) : (
          <G key={node.id} transform={node.transform}>
            {node.shapes.map((shape, index) => (
              <Shape key={index} shape={svgShape(shape, paint[shape.paint])} />
            ))}
          </G>
        ),
      )}
    </Svg>
  );
});
