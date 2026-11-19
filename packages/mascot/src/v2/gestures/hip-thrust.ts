// Le hip thrust : Mehdi, le haut du dos sur le bord d'un banc posé en travers, la barre sur le pli des hanches,
// tenue des deux mains. Le dos pivote sur le bord du banc sans glisser ; les pieds restent à plat ; en haut, le
// buste et les cuisses sont dans le prolongement l'un de l'autre, les tibias à peu près verticaux, le menton
// rentré. Positions réglées à l'œil, d'après la fiche du catalogue : aucune source ouverte pour ce geste.
import { gesture } from "../gesture";
import { elbows, STAND, type ControlPatch } from "../pose";
import { solve, type Rig } from "../solve";
import { along, sub } from "../vec";
import { bench } from "./gym";

const RIG: Rig = { bar: { grip: 58, hold: "hands" } };
const BENCH_TOP = 76;
// Le bord du banc, où se pose le bas des omoplates.
const EDGE = { x: -60, y: BENCH_TOP + 1 };

// Le point du dos qui touche le banc, dans le repère du buste.
export const backContact = (body: ReturnType<typeof solve>) => along(body.chest, body.frames.thorax, -19, 18, 0);

const arms: ControlPatch = { ...elbows(-1, 0.3, 0.7), wrist: 10, armsLong: 0 };

// Le corps incliné de `pitch` : le bassin se place pour que le dos touche le bord du banc, et la barre se pose
// sur le pli des hanches.
const leaning = (pitch: number, feet: ControlPatch): ControlPatch => {
  const set: ControlPatch = { ...arms, ...feet, pelvisPitch: pitch, neck: 22, lumbar: 0, thoracic: 0 };
  const body = solve({ ...STAND, ...set, pelvisX: 0, pelvisY: 300 }, { bar: null });
  const offset = sub(backContact(body), body.pelvis);
  const pelvisX = EDGE.x - offset.x;
  const pelvisY = EDGE.y - offset.y;
  const placed = solve({ ...STAND, ...set, pelvisX, pelvisY }, { bar: null });
  const bar = along(placed.pelvis, placed.frames.pelvis, 22, -4, 0);
  return { ...set, pelvisX, pelvisY, barX: bar.x, barY: bar.y };
};

// Les pieds : sous les genoux quand le bassin est en haut, tibias verticaux.
const FEET: ControlPatch = (() => {
  const top = leaning(-88, {});
  const ankle = top.pelvisX! + 80;
  const x = ankle + 25;
  return {
    ...{ footRX: x, footRZ: 26, footRYaw: 8, footLX: x, footLZ: -26, footLYaw: 8 },
    ...{ kneeRForward: 0.3, kneeRUp: 1, kneeLForward: 0.3, kneeLUp: 1 },
  };
})();

const top = leaning(-88, FEET);
const half = leaning(-68, FEET);
const bottom = leaning(-48, FEET);

export const hipThrust = gesture({
  key: "hip-thrust",
  athlete: "discus",
  rig: RIG,
  base: { ...arms, ...FEET },
  keys: [
    { id: "bottom", guide: 0, set: bottom, hold: 500, move: { ms: 600, curve: "reception", phase: "down" } },
    { id: "rising", guide: 1, set: half, still: true, face: "effort", move: { ms: 380, curve: "elan", phase: "up" } },
    { id: "top", guide: 2, set: top, hold: 600, face: "effort", move: { ms: 380, curve: "reception", phase: "up" } },
    { id: "lowering", guide: 3, set: half, still: true, move: { ms: 600, curve: "elan", phase: "down" } },
  ],
  props: () => bench(EDGE.x - 44, EDGE.x + 2, BENCH_TOP, 70),
});
