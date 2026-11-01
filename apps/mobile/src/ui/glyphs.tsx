import type { ExerciseCategory } from "@tartan/contracts";
import type { ComponentType } from "react";
import Svg, { Path } from "react-native-svg";
import { Dumbbell, Flame, Footprints, Stretch } from "./icons";

type GlyphProps = { size?: number; color: string };

const stroke = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Pictogrammes métier dessinés sur la grille Lucide (24 px, trait 2 px).
export const BarGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 21V4M19 21V4M5 9h14" stroke={color} {...stroke} />
    <Path d="M3 21h4M17 21h4" stroke={color} {...stroke} />
  </Svg>
);

export const HurdleGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 9h18M7 9v11M17 9v11M4 20h6M14 20h6" stroke={color} {...stroke} />
  </Svg>
);

export const ConeGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3l6 16H6zM3 21h18M8.6 12h6.8" stroke={color} {...stroke} />
  </Svg>
);

export const StairsGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 20h5v-5h5v-5h5V5h3" stroke={color} {...stroke} />
  </Svg>
);

const CATEGORY_GLYPH: Record<ExerciseCategory, ComponentType<GlyphProps>> = {
  strength: Dumbbell as unknown as ComponentType<GlyphProps>,
  plyo: HurdleGlyph,
  running_drill: Footprints as unknown as ComponentType<GlyphProps>,
  stairs: StairsGlyph,
  cones: ConeGlyph,
  mobility: Stretch as unknown as ComponentType<GlyphProps>,
  jump: BarGlyph,
  warmup: Flame as unknown as ComponentType<GlyphProps>,
};

export const CategoryGlyph = ({ category, size, color }: GlyphProps & { category: string }) => {
  const Glyph = CATEGORY_GLYPH[category as ExerciseCategory] ?? Dumbbell;
  return <Glyph size={size} color={color} />;
};

// Lignes de couloirs, seule illustration de l'app (§ 9.7).
export const LaneArcs = ({
  width = 220,
  height = 220,
  color,
  opacity = 0.18,
}: {
  width?: number;
  height?: number;
  color: string;
  opacity?: number;
}) => (
  <Svg width={width} height={height} viewBox="0 0 220 220">
    <Path d="M 20 220 A 200 200 0 0 1 220 20" fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={4} />
    <Path d="M 60 220 A 160 160 0 0 1 220 60" fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={4} />
    <Path d="M 100 220 A 120 120 0 0 1 220 100" fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={4} />
  </Svg>
);
