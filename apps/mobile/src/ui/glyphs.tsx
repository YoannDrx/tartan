import type { ExerciseCategory, ExerciseFamily } from "@tartan/contracts";
import type { ComponentType } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { Dumbbell, Flame, Footprints, Stretch } from "./icons";

type GlyphProps = { size?: number; color: string };

const stroke = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Pictogrammes métier dessinés sur la grille Lucide (24 px, trait 2 px).
export const BarGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 21V9M18 21V9M6 12h12" stroke={color} {...stroke} />
    <Path d="M3 15C6 1 15 -1 21 8" stroke={color} {...stroke} />
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

// La barre au-dessus de la tête : l'haltérophilie.
export const OverheadGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 5h18M6 3v4M18 3v4M9 5l2 6M15 5l-2 6M12 11v5M9 21l3-5 3 5" stroke={color} {...stroke} />
  </Svg>
);

// La planche, en appui sur les avant-bras : le gainage.
export const PlankGlyph = ({ size = 22, color }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={4.5} cy={9.5} r={2} stroke={color} {...stroke} />
    <Path d="M7 11.5 20 15.5M8 12v5h3M20 15.5V20M3 20h18" stroke={color} {...stroke} />
  </Svg>
);

// Les familles de la bibliothèque : les mêmes dessins que sur le web, toujours à côté de leur nom.
const FAMILY_GLYPH: Record<ExerciseFamily, ComponentType<GlyphProps>> = {
  strength: CATEGORY_GLYPH.strength,
  weightlifting: OverheadGlyph,
  mobility: CATEGORY_GLYPH.mobility,
  plyometrics: HurdleGlyph,
  running: CATEGORY_GLYPH.running_drill,
  core: PlankGlyph,
  coordination: ConeGlyph,
  stairs: StairsGlyph,
  warmup: CATEGORY_GLYPH.warmup,
};

export const FamilyGlyph = ({ family, size, color }: GlyphProps & { family: ExerciseFamily }) => {
  const Glyph = FAMILY_GLYPH[family];
  return <Glyph size={size} color={color} />;
};
