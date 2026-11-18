// Les squats de Mehdi, hors squat arrière (back-squat.ts).
// - Squat avant : la barre sur l'avant des épaules, coudes hauts, poitrine haute ; hanches et genoux fléchissent
//   ensemble, talons au sol, genoux dans l'axe des pointes, buste plus droit qu'au squat arrière ; descente
//   contrôlée, remontée plus rapide (ACE, « Front Squat » ; Catalyst Athletics, « Front Squat »). La barre reste à
//   l'aplomb du milieu du pied.
// - Squat bulgare : le dessus du pied arrière sur un banc, la jambe avant fait le travail ; le bassin descend à la
//   verticale, le genou arrière vers le sol, sans rebond. Positions réglées à l'œil, d'après la fiche du catalogue.
import { gesture } from "../gesture";
import { BALL_X, stance, STAND, type ControlPatch } from "../pose";
import { skin } from "../skin";
import { solve } from "../solve";
import { CLEAN_GRIP, racked } from "./clean";
import { bench } from "./gym";

const ATHLETE = "discus" as const;

// --- Squat avant ------------------------------------------------------------------------------------------------

const feet = stance(45, 25, 12.5);
// La barre sur l'avant des épaules, au-dessus du milieu du pied : le bassin se place sous elle.
const overMidfoot = (patch: ControlPatch): ControlPatch => {
  const first = racked({ ...feet, ...patch, pelvisX: 0 });
  return racked({ ...feet, ...patch, pelvisX: -first.barX! });
};

const standing = overMidfoot({ pelvisY: 999, pelvisPitch: 4, neck: -8 });
const descent = overMidfoot({ pelvisY: 130, pelvisPitch: 12, lumbar: 1, neck: -12 });
const bottom = overMidfoot({ pelvisY: 64, pelvisPitch: 18, lumbar: 6, thoracic: -2, neck: -14 });
const ascent = overMidfoot({ pelvisY: 128, pelvisPitch: 15, lumbar: 2, neck: -12 });

export const frontSquat = gesture({
  key: "front-squat",
  athlete: ATHLETE,
  rig: { bar: { grip: CLEAN_GRIP, hold: "hands" } },
  base: { ...feet, armsLong: 0 },
  keys: [
    { id: "standing", guide: 0, set: standing, hold: 900, move: { ms: 480, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: descent, still: true, move: { ms: 750, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: bottom,
      hold: 250,
      face: "effort",
      move: { ms: 800, curve: "reception", phase: "down" },
    },
    { id: "ascent", guide: 3, set: ascent, face: "effort", still: true, move: { ms: 420, curve: "elan", phase: "up" } },
  ],
});

// --- Squat bulgare ----------------------------------------------------------------------------------------------

// Le pied arrière couché sur le banc, pointe vers l'arrière ; le pied avant devant, à plat.
const REAR = { x: -178, heel: 128 };
const split: ControlPatch = {
  footRX: BALL_X + 28,
  footRZ: 17,
  footRYaw: 6,
  footLX: REAR.x,
  footLZ: -15,
  footLYaw: 0,
  footLHeel: REAR.heel,
  // Les mains sur les hanches, coudes vers l'arrière.
  handRForward: 4,
  handRUp: -92,
  handROut: 30,
  handLForward: 4,
  handLUp: -92,
  handLOut: 30,
  elbowRForward: -1,
  elbowRUp: 0,
  elbowROut: 0.6,
  elbowLForward: -1,
  elbowLUp: 0,
  elbowLOut: 0.6,
};
// La hauteur du banc : sous le dessus du pied arrière.
const BENCH_TOP = (() => {
  const body = solve({ ...STAND, ...split, footLLift: 0 }, { bar: null });
  const shoe = skin(body).parts.find((part) => part.id === "shoeL")!;
  return -Math.min(...shoe.spheres.map(({ c, r }) => c.y - r));
})();
const LIFT = BENCH_TOP + 70;
const onBench = (patch: ControlPatch): ControlPatch => ({ ...split, footLLift: LIFT, ...patch });
const benchTop = LIFT - BENCH_TOP;

const bsTop = onBench({ pelvisX: -46, pelvisY: 999, pelvisPitch: 10, lumbar: -2, neck: -6 });
const bsHalf = onBench({ pelvisX: -52, pelvisY: 130, pelvisPitch: 14, lumbar: -2, neck: -8 });
const bsBottom = onBench({ pelvisX: -58, pelvisY: 96, pelvisPitch: 18, lumbar: -2, neck: -10 });

export const bulgarianSquat = gesture({
  key: "bulgarian-squat",
  athlete: ATHLETE,
  rig: { bar: null },
  base: split,
  keys: [
    { id: "top", guide: 0, set: bsTop, hold: 700, move: { ms: 450, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: bsHalf, still: true, move: { ms: 750, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: bsBottom,
      hold: 300,
      face: "effort",
      move: { ms: 750, curve: "reception", phase: "down" },
    },
    { id: "ascent", guide: 3, set: bsHalf, face: "effort", still: true, move: { ms: 420, curve: "elan", phase: "up" } },
  ],
  props: () => bench(REAR.x - 30, REAR.x + 50, benchTop, 26),
});
