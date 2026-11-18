// Le gainage latéral : Inès (l'athlète du triple saut), couchée sur le côté gauche, l'avant-bras au sol sous
// l'épaule, les pieds superposés sur leur bord. Le bassin monte jusqu'à aligner tête, tronc et jambes, se tient,
// puis redescend lentement. L'épaule reste au-dessus du coude : c'est le bassin qui monte et descend, en pivotant
// autour de l'épaule et des pieds. Le corps est tourné d'un quart de tour : de profil, on le voit de face.
// Réglé à l'œil d'après la fiche du catalogue : aucune source ouverte pour ce geste.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { span } from "../ik";
import { STAND, type ControlPatch } from "../pose";
import { skin } from "../skin";
import { solve, type Solved } from "../solve";
import { add, scale, sub, vec } from "../vec";

const RIG = { bar: null };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// L'épaule gauche au-dessus du coude posé au sol, le bras vertical ; l'avant-bras vers l'avant du corps.
const ELBOW_Y = 8;
const SHOULDER = vec(60, ELBOW_Y + FIGURE.upperArm, 0);
const HAND = add(vec(SHOULDER.x, 0, 0), vec(0, ELBOW_Y - 2, 0));
const LEG = span(FIGURE.thigh, FIGURE.shin, 3);

// Le buste incliné de `tilt` degrés au-dessus de l'horizontale, couché sur le côté gauche, la poitrine vers +z.
const lying = (tilt: number): ControlPatch => ({
  pelvisYaw: 90,
  pelvisRoll: -(90 - tilt),
  pelvisPitch: 0,
  neck: 0,
  // La main droite sur la hanche.
  handRForward: 4,
  handRUp: -92,
  handROut: 32,
  elbowRForward: -1,
  elbowRUp: 0,
  elbowROut: 0.6,
  // Le coude gauche vers le sol.
  elbowLForward: 0,
  elbowLUp: -0.3,
  elbowLOut: 1,
  handLPin: 1,
});

// Le bassin qui met l'épaule gauche à sa place, le buste incliné de `tilt`.
const placed = (tilt: number, legs: ControlPatch): ControlPatch => {
  const set = lying(tilt);
  const body = solve({ ...STAND, ...set, pelvisX: 0, pelvisY: 400, pelvisZ: 0 }, RIG);
  const offset = sub(body.arms.L.shoulder, body.pelvis);
  const pelvis = sub(SHOULDER, offset);
  return { ...set, ...legs, pelvisX: pelvis.x, pelvisY: pelvis.y, pelvisZ: pelvis.z };
};

// Les pieds superposés, sur leur bord, au bout des jambes du corps aligné incliné de `tilt`.
const feetFor = (tilt: number, lift = 0): ControlPatch => {
  const set = placed(tilt, {});
  const body = solve({ ...STAND, ...set, footRLift: 999, footLLift: 999 }, RIG);
  const along = vec(-Math.cos(rad(tilt)), -Math.sin(rad(tilt)), 0);
  const ankle = (hip: typeof body.pelvis) => add(hip, scale(along, LEG));
  const [right, left] = [ankle(body.legs.R.hip), ankle(body.legs.L.hip)];
  // L'avant-pied devant la cheville (vers +z), un peu vers la tête.
  const ball = (at: typeof right) =>
    add(at, vec(-FIGURE.ankle * Math.cos(rad(tilt)), -FIGURE.ankle * Math.sin(rad(tilt)) + lift, FIGURE.foot.ball));
  const [br, bl] = [ball(right), ball(left)];
  return {
    footRX: br.x,
    footRLift: br.y,
    footRZ: br.z,
    footRYaw: 90,
    footRRoll: -(90 - tilt),
    footLX: bl.x,
    footLLift: bl.y,
    footLZ: bl.z,
    footLYaw: -90,
    footLRoll: 90 - tilt,
    kneeRForward: 1,
    kneeLForward: 1,
  };
};

const lowestShoe = (body: Solved) =>
  Math.min(
    ...skin(body)
      .parts.filter((part) => part.id === "shoeL")
      .flatMap((part) => part.spheres.map(({ c, r }) => c.y - r)),
  );
// L'inclinaison du corps aligné qui pose le pied du dessous sur le sol.
const TOP = (() => {
  let [low, high] = [0, 40];
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const body = solve({ ...STAND, ...placed(mid, feetFor(mid)) }, RIG);
    if (lowestShoe(body) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
})();
const FEET = feetFor(TOP, 0.4);
const top = placed(TOP, FEET);
// En bas, le buste pivote autour de l'épaule : le bassin descend près du sol.
const bottom = placed(TOP + 13, FEET);
const half = placed(TOP + 6, FEET);
const hand = { handLX: SHOULDER.x, handLY: HAND.y + 4, handLZ: SHOULDER.z + FIGURE.forearm + FIGURE.hand - 4 };

export const sidePlank = gesture({
  key: "side-plank",
  athlete: "tripleJump",
  rig: RIG,
  base: { ...FEET, ...hand },
  keys: [
    { id: "down", guide: 0, set: bottom, hold: 600, move: { ms: 700, curve: "reception", phase: "lower" } },
    { id: "lifting", set: half, still: true, face: "effort", move: { ms: 450, curve: "elan", phase: "lift" } },
    {
      id: "plank",
      guide: 1,
      set: top,
      hold: 1600,
      face: "effort",
      move: { ms: 400, curve: "reception", phase: "lift" },
    },
    { id: "aligned", guide: 2, set: top, hold: 300, face: "effort", move: { ms: 120, curve: "linear", phase: "hold" } },
    { id: "lowering", guide: 3, set: half, still: true, move: { ms: 700, curve: "elan", phase: "lower" } },
  ],
  views: ["side", "top"],
});
