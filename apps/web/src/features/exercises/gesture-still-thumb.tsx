"use client";

import { SURFACES } from "@tartan/design-tokens/athletes";
import { exerciseClip } from "@tartan/mascot/exercises";
import { motionEngine } from "@tartan/mascot/v2/engine";
import { gestureEntry } from "@tartan/mascot/v2/registry";
import { memo, type ReactNode } from "react";
import { ExerciseScene, gestureStage, GestureStill } from "@/components/exercise-scene";

// La position la plus parlante d'un geste : la deuxième étape, le cœur du mouvement (la flexion d'un squat, la
// suspension d'un bond, la réception d'un épaulé). Un geste plus court montre sa dernière position.
const KEY_POSITION = 2;
// La vignette est carrée : on garde le bas du cadre, là où se tient l'athlète, sur les quatre cinquièmes de sa hauteur.
const CROP = 0.8;

const square = (x: number, y: number, width: number, height: number) => {
  const side = Math.min(width, height * CROP);
  return `${x + (width - side) / 2} ${y + height - side} ${side} ${side}`;
};

const Frame = ({ viewBox, children }: { viewBox: string; children: ReactNode }) => (
  <svg viewBox={viewBox} className="block size-full" style={{ backgroundColor: SURFACES.ink }}>
    {children}
  </svg>
);

// Chargée à part : la bibliothèque s'affiche avant que les gestes ne soient construits.
const GestureStillThumb = memo(function GestureStillThumb({ motionKey }: { motionKey: string }) {
  if (motionEngine(motionKey) === "v2") {
    const entry = gestureEntry(motionKey);
    if (!entry) return null;
    const { clip } = entry;
    const box = gestureStage(clip, entry.native);
    const still = clip.positions[Math.min(KEY_POSITION, clip.positions.length - 1)]!.still;
    return (
      <Frame viewBox={square(box.x, box.y, box.width, box.height)}>
        <GestureStill gesture={clip} t={still} view={entry.native} />
      </Frame>
    );
  }
  const clip = exerciseClip(motionKey);
  if (!clip) return null;
  return (
    <ExerciseScene
      gesture={clip}
      t={clip.stills[Math.min(KEY_POSITION, clip.stills.length - 1)]!}
      preserveAspectRatio="xMidYMax slice"
      className="size-full"
    />
  );
});

export default GestureStillThumb;
