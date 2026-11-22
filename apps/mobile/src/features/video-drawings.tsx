import type { VideoDrawing } from "@tartan/contracts";
import { drawingAngle, type DrawingKind, type DrawingPoint } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, Defs, Line, Marker, Path, Polyline, Text as SvgText } from "react-native-svg";
import { addPoint, DRAWING_KINDS, FALLBACK_ASPECT, pointOnImage, pointsLeft, videoFrame } from "../lib/video-drawing-draft";
import { Undo, X } from "../ui/icons";
import { Chip, IconButton, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";

const t = m.video.drawing;
const k = m.nativeVideo;

// Un tracé s'affiche autour de l'instant de sa remarque.
export const DRAWING_WINDOW_MS = 400;
export { FALLBACK_ASPECT };

export const describeDrawing = (drawing: VideoDrawing) => {
  const degrees = drawing.kind === "angle" ? drawingAngle(drawing.points, drawing.aspect ?? FALLBACK_ASPECT) : null;
  return degrees === null ? t.kinds[drawing.kind] : t.angleOf(degrees);
};

type Draft = { kind: DrawingKind; points: DrawingPoint[] };

/**
 * Les tracés sur l'image : le même cadrage que la vidéo (contenu ajusté sans déformation). Les remarques tracées se
 * lisent seulement ; le tracé en cours (`draft`) montre aussi ses points posés.
 */
export function VideoDrawings({
  drawings,
  aspect,
  draft,
}: {
  drawings: VideoDrawing[];
  aspect?: number;
  draft?: Draft | null;
}) {
  const p = usePalette();
  if (!drawings.length && !draft?.points.length) return null;
  const ratio = aspect ?? drawings[0]?.aspect ?? FALLBACK_ASPECT;
  const [width, height] = [ratio * 1000, 1000];
  const size = Math.max(width, height);
  const shapes: { kind: DrawingKind; points: DrawingPoint[] }[] = [...drawings, ...(draft ? [draft] : [])];
  return (
    <View
      pointerEvents="none"
      accessible={drawings.length > 0}
      accessibilityRole={drawings.length ? "image" : undefined}
      accessibilityLabel={drawings.length ? drawings.map(describeDrawing).join(", ") : undefined}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <Marker id="tete" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <Path d="M 0 0 L 10 5 L 0 10 z" fill={p.accent} />
          </Marker>
        </Defs>
        {shapes.map((drawing, index) => {
          const q = drawing.points.map(({ x, y }) => ({ x: x * width, y: y * height }));
          const stroke = { stroke: p.accent, strokeWidth: size / 160, strokeLinecap: "round" as const, fill: "none" };
          const pending = draft && index === shapes.length - 1;
          const dots = pending
            ? q.map((pt, n) => <Circle key={`${index}-d${n}`} cx={pt.x} cy={pt.y} r={size / 90} fill={p.accent} />)
            : [];
          if (q.length < 2) return dots;
          if (drawing.kind === "circle")
            return [
              <Circle
                key={index}
                cx={q[0]!.x}
                cy={q[0]!.y}
                r={Math.hypot(q[1]!.x - q[0]!.x, q[1]!.y - q[0]!.y)}
                {...stroke}
              />,
              ...dots,
            ];
          if (drawing.kind === "angle") {
            const degrees = q.length === 3 ? drawingAngle(drawing.points, ratio) : null;
            return [
              <Polyline key={`${index}-l`} points={q.map((pt) => `${pt.x},${pt.y}`).join(" ")} {...stroke} />,
              degrees === null ? null : (
                <SvgText
                  key={`${index}-t`}
                  x={q[1]!.x}
                  y={q[1]!.y - size / 40}
                  fontSize={size / 22}
                  fontWeight="700"
                  textAnchor="middle"
                  fill={p.accent}
                >
                  {`${degrees}°`}
                </SvgText>
              ),
              ...dots,
            ];
          }
          return [
            <Line
              key={index}
              x1={q[0]!.x}
              y1={q[0]!.y}
              x2={q[1]!.x}
              y2={q[1]!.y}
              {...stroke}
              markerEnd={drawing.kind === "arrow" ? "url(#tete)" : undefined}
            />,
            ...dots,
          ];
        })}
      </Svg>
    </View>
  );
}

/**
 * La zone de tracé, posée sur l'image quand un outil est choisi : chaque toucher pose un point, relatif à l'image et
 * non à la scène. Les bandes noires renvoient sur le bord de l'image.
 */
export function DrawingSurface({
  tool,
  draft,
  aspect,
  onDraft,
}: {
  tool: DrawingKind;
  draft: DrawingPoint[];
  aspect: number;
  onDraft: (points: DrawingPoint[]) => void;
}) {
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const left = pointsLeft(tool, draft);
  return (
    <View
      testID="drawing-surface"
      accessible
      accessibilityLabel={k.area(t.kinds[tool], left === 0 ? 2 : left)}
      onLayout={(event) => setStage(event.nativeEvent.layout)}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(event) => {
        const point = pointOnImage(
          { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY },
          videoFrame(stage, aspect),
        );
        if (point) onDraft(addPoint(tool, draft, point));
      }}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    />
  );
}

/** Les outils : ligne, flèche, angle mesuré, cercle ; reprendre le dernier point, annuler le tracé. */
export function DrawingTools({
  tool,
  draft,
  disabled,
  onTool,
  onDraft,
}: {
  tool: DrawingKind | null;
  draft: DrawingPoint[];
  disabled?: boolean;
  onTool: (tool: DrawingKind | null) => void;
  onDraft: (points: DrawingPoint[]) => void;
}) {
  const left = tool ? pointsLeft(tool, draft) : 0;
  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">{t.title}</T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={k.tools}
        contentContainerStyle={{ gap: space.sm, alignItems: "center" }}
      >
        {DRAWING_KINDS.map((kind) => (
          <Chip
            key={kind}
            tall
            testID={`drawing-tool-${kind}`}
            label={t.kinds[kind]}
            accessibilityLabel={k.tool(t.kinds[kind])}
            active={tool === kind}
            onPress={() => {
              if (disabled) return;
              onTool(tool === kind ? null : kind);
              onDraft([]);
            }}
          />
        ))}
        {tool ? (
          <>
            <IconButton
              testID="drawing-undo"
              icon={Undo}
              label={k.undo}
              disabled={draft.length === 0}
              onPress={() => onDraft(draft.slice(0, -1))}
            />
            <IconButton
              testID="drawing-cancel"
              icon={X}
              label={k.cancel}
              onPress={() => {
                onTool(null);
                onDraft([]);
              }}
            />
          </>
        ) : null}
      </ScrollView>
      {tool ? (
        <T testID="drawing-status" variant="small" tone="muted" accessibilityLiveRegion="polite">
          {left > 0 ? t.place(left) : t.ready}
        </T>
      ) : null}
    </View>
  );
}
