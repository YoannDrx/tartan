import type { VideoDrawing } from "@tartan/contracts";
import { drawingAngle } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { View } from "react-native";
import Svg, { Circle, Defs, Line, Marker, Path, Polyline, Text as SvgText } from "react-native-svg";
import { usePalette } from "../ui/theme";

// Les proportions par défaut d'une image, quand un tracé ancien ne les porte pas.
const FALLBACK_ASPECT = 16 / 9;
// Un tracé s'affiche autour de l'instant de sa remarque.
export const DRAWING_WINDOW_MS = 400;

export const describeDrawing = (drawing: VideoDrawing) => {
  const degrees = drawing.kind === "angle" ? drawingAngle(drawing.points, drawing.aspect ?? FALLBACK_ASPECT) : null;
  return degrees === null ? m.video.drawing.kinds[drawing.kind] : m.video.drawing.angleOf(degrees);
};

// Les tracés du coach sur l'image, en lecture seule : le même cadrage que la vidéo (contenu ajusté sans déformation).
export function VideoDrawings({ drawings }: { drawings: VideoDrawing[] }) {
  const p = usePalette();
  if (!drawings.length) return null;
  const aspect = drawings[0]!.aspect ?? FALLBACK_ASPECT;
  const [width, height] = [aspect * 1000, 1000];
  const size = Math.max(width, height);
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={drawings.map(describeDrawing).join(", ")}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <Marker id="tete" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <Path d="M 0 0 L 10 5 L 0 10 z" fill={p.accent} />
          </Marker>
        </Defs>
        {drawings.map((drawing, index) => {
          const q = drawing.points.map(({ x, y }) => ({ x: x * width, y: y * height }));
          const stroke = { stroke: p.accent, strokeWidth: size / 160, strokeLinecap: "round" as const, fill: "none" };
          if (drawing.kind === "circle")
            return <Circle key={index} cx={q[0]!.x} cy={q[0]!.y} r={Math.hypot(q[1]!.x - q[0]!.x, q[1]!.y - q[0]!.y)} {...stroke} />;
          if (drawing.kind === "angle") {
            const degrees = drawingAngle(drawing.points, aspect);
            return [
              <Polyline key={`${index}-l`} points={q.map((pt) => `${pt.x},${pt.y}`).join(" ")} {...stroke} />,
              degrees === null ? null : (
                <SvgText key={`${index}-t`} x={q[1]!.x} y={q[1]!.y - size / 40} fontSize={size / 22} fontWeight="700" textAnchor="middle" fill={p.accent}>
                  {`${degrees}°`}
                </SvgText>
              ),
            ];
          }
          return (
            <Line
              key={index}
              x1={q[0]!.x}
              y1={q[0]!.y}
              x2={q[1]!.x}
              y2={q[1]!.y}
              {...stroke}
              markerEnd={drawing.kind === "arrow" ? "url(#tete)" : undefined}
            />
          );
        })}
      </Svg>
    </View>
  );
}
