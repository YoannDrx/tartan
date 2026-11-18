// Le squat arrière, barre haute : Mehdi, l'athlète de la musculation.
// La barre descend et remonte à l'aplomb du milieu du pied ; le dos qui la porte donne la place du bassin.
// Repères techniques : cuisses au moins parallèles au sol en bas, talons au sol, genoux dans l'axe des pointes,
// buste à peu près parallèle au tibia avec une légère cambrure (Myer et al., 2014). Descente lente, remontée
// plus rapide.
import { gesture } from "../gesture";
import { elbows, stance, type ControlPatch } from "../pose";
import type { Rig } from "../solve";

const RIG: Rig = { bar: { grip: 72, hold: "back" } };

// Pieds à la largeur des épaules, pointes ouvertes ; les coudes sous la barre, tirés vers l'arrière.
const base: ControlPatch = {
  ...stance(45, 25, 12.5),
  barX: 0,
  ...elbows(-0.6, -1, 0.25),
  wrist: 25,
};

// Le buste s'incline avec la profondeur : le bassin d'abord, puis un peu chaque segment du dos.
const lean = (pelvisPitch: number, lumbar: number, thoracic: number, neck: number): ControlPatch => ({
  pelvisPitch,
  lumbar,
  thoracic,
  neck,
});

const standing: ControlPatch = { ...lean(7, 1, 1, -6), barY: 999 };
const bottom: ControlPatch = { ...lean(31, 5, 3, -24), barY: 156 };

export const backSquat = gesture({
  key: "back-squat",
  athlete: "discus",
  rig: RIG,
  base,
  keys: [
    {
      id: "standing",
      guide: 1,
      set: standing,
      hold: 900,
      move: { ms: 480, curve: "reception", phase: "up" },
    },
    {
      id: "descent",
      set: { ...lean(21, 3, 2, -14), barY: 216 },
      still: true,
      move: { ms: 700, curve: "elan", phase: "down" },
    },
    {
      id: "bottom",
      guide: 2,
      set: bottom,
      hold: 250,
      face: "effort",
      move: { ms: 800, curve: "reception", phase: "down" },
    },
    {
      // Les hanches montent un peu avant les épaules : le buste reste plus incliné qu'à la descente.
      id: "ascent",
      guide: 3,
      set: { ...lean(25, 4, 2, -16), barY: 214 },
      face: "effort",
      still: true,
      move: { ms: 420, curve: "elan", phase: "up" },
    },
  ],
});
