// Les gestes debout sur une jambe, une main sur un support fixe : Lina (l'athlète de la longueur).
// La jambe libre se place par sa cuisse et son tibia ; le pied suit, perpendiculaire au tibia.
// - Balancements de jambe avant-arrière : la jambe libre oscille comme un pendule, genou presque tendu, bassin de
//   face, tronc immobile ; l'amplitude grandit d'une série à l'autre.
// - Cercles contrôlés de hanche : genou monté devant à hauteur de hanche, ouvert sur le côté, dirigé vers
//   l'arrière, puis retour, lentement ; puis dans l'autre sens.
// Positions et rythmes réglés à l'œil d'après les fiches du catalogue : aucune source ouverte pour ces gestes.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { elbows, STAND, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { solve } from "../solve";
import { vec, type Vec3 } from "../vec";
import { pinned } from "./gym";

const ATHLETE = "longJump" as const;
const RIG = { bar: null };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// Debout, le poids sur la jambe gauche, la main gauche sur un montant à côté de la hanche.
const POST = vec(10, 196, -62);
const standing: ControlPatch = {
  pelvisY: 999,
  footLZ: -14,
  footRZ: 18,
  footRYaw: 6,
  footLYaw: 6,
  ...pinned(vec(POST.x, POST.y, -POST.z)),
  handRPin: 0,
  handRForward: 10,
  handRUp: -120,
  handROut: 50,
  ...elbows(-0.6, -0.4, 0.8),
};
const PELVIS = solve({ ...STAND, ...standing }, RIG).pelvis;
const HIP = vec(PELVIS.x, PELVIS.y, FIGURE.hip);

// La jambe droite libre : la cuisse levée de `flexion` degrés vers l'avant et ouverte de `abduction` degrés, le
// genou plié de `knee` degrés dans le plan de la jambe. Le pied, décollé, reste perpendiculaire au tibia.
const freeLeg = (flexion: number, abduction: number, knee: number): ControlPatch => {
  const [f, a] = [rad(flexion), rad(abduction)];
  const thigh = vec(Math.sin(f) * Math.cos(a), -Math.cos(f) * Math.cos(a), Math.sin(a));
  const kneeAt: Vec3 = vec(HIP.x + FIGURE.thigh * thigh.x, HIP.y + FIGURE.thigh * thigh.y, HIP.z + FIGURE.thigh * thigh.z);
  // Le tibia tourne vers l'arrière d'autant que le genou se plie, dans le plan vertical de la cuisse.
  const s = f - rad(knee);
  const shin = vec(Math.sin(s) * Math.cos(a), -Math.cos(s) * Math.cos(a), Math.sin(a) * Math.cos(s - f));
  const ankle = vec(kneeAt.x + FIGURE.shin * shin.x, kneeAt.y + FIGURE.shin * shin.y, kneeAt.z + FIGURE.shin * shin.z);
  // Le pied perpendiculaire au tibia : la pointe en avant du tibia, l'avant-pied devant la cheville.
  const heel = -(s * 180) / Math.PI;
  const h = rad(heel);
  const forward = vec(Math.cos(h), -Math.sin(h), 0);
  const up = vec(Math.sin(h), Math.cos(h), 0);
  const ball = vec(
    ankle.x + FIGURE.foot.ball * forward.x - FIGURE.ankle * up.x,
    ankle.y + FIGURE.foot.ball * forward.y - FIGURE.ankle * up.y,
    ankle.z,
  );
  // Le genou se plie du côté de l'avant de la cuisse : le pôle, du milieu de la corde vers le genou.
  const pole = vec(
    kneeAt.x - (HIP.x + ankle.x) / 2,
    kneeAt.y - (HIP.y + ankle.y) / 2,
    kneeAt.z - (HIP.z + ankle.z) / 2,
  );
  return {
    footRX: ball.x,
    footRZ: ball.z,
    footRLift: ball.y,
    footRYaw: 0,
    footRHeel: heel,
    kneeRForward: pole.x + 0.01,
    kneeRUp: pole.y,
    kneeRSide: pole.z,
  };
};

const post = (): Prop[] => [
  {
    paint: "iron",
    shape: { kind: "rect", x: POST.x - 6, y: -POST.y - 10, width: 12, height: POST.y + 10, radius: 3 },
    native: "side",
    at: POST.z,
    half: 6,
  },
];

// --- Balancements de jambe ------------------------------------------------------------------------------------

const swing = (flexion: number) => ({ ...standing, ...freeLeg(flexion, 0, 14 + Math.abs(flexion) / 4) });

export const legSwings = gesture({
  key: "leg-swings",
  athlete: ATHLETE,
  rig: RIG,
  base: standing,
  keys: [
    { id: "standing", guide: 0, set: standing, hold: 600, move: { ms: 420, curve: "reception", phase: "return" } },
    { id: "front", guide: 1, set: swing(38), still: true, air: ["R"], move: { ms: 460, curve: "impulsion", phase: "swing" } },
    { id: "back", set: swing(-12), still: true, air: ["R"], move: { ms: 520, curve: "linear", phase: "swing" } },
    { id: "middle", set: swing(14), air: ["R"], move: { ms: 280, curve: "linear", phase: "swing" } },
    { id: "pause", guide: 2, set: standing, hold: 300, move: { ms: 300, curve: "reception", phase: "swing" } },
    { id: "front-wide", guide: 3, set: swing(62), still: true, air: ["R"], move: { ms: 520, curve: "impulsion", phase: "swing" } },
    { id: "back-wide", set: swing(-18), still: true, air: ["R"], move: { ms: 600, curve: "linear", phase: "swing" } },
    { id: "middle-wide", set: swing(20), air: ["R"], move: { ms: 320, curve: "linear", phase: "swing" } },
  ],
  props: post,
});

// --- Cercles de hanche ----------------------------------------------------------------------------------------

const circle = {
  front: { ...standing, ...freeLeg(88, 6, 92) },
  side: { ...standing, ...freeLeg(62, 48, 92) },
  back: { ...standing, ...freeLeg(-14, 30, 95) },
};

export const hipCar = gesture({
  key: "hip-car",
  athlete: ATHLETE,
  rig: RIG,
  base: standing,
  keys: [
    { id: "standing", guide: 0, set: standing, hold: 700, move: { ms: 700, curve: "reception", phase: "return" } },
    { id: "front", guide: 1, set: circle.front, hold: 300, air: ["R"], move: { ms: 800, curve: "impulsion", phase: "raise" } },
    { id: "side", guide: 2, set: circle.side, still: true, air: ["R"], move: { ms: 750, curve: "linear", phase: "open" } },
    { id: "back", set: circle.back, still: true, air: ["R"], move: { ms: 800, curve: "linear", phase: "open" } },
    { id: "reverse", guide: 3, set: standing, hold: 500, move: { ms: 700, curve: "reception", phase: "return" } },
    { id: "back-again", set: circle.back, still: true, air: ["R"], move: { ms: 700, curve: "impulsion", phase: "reverse" } },
    { id: "side-again", set: circle.side, still: true, air: ["R"], move: { ms: 800, curve: "linear", phase: "reverse" } },
    { id: "front-again", set: circle.front, air: ["R"], move: { ms: 750, curve: "linear", phase: "reverse" } },
  ],
  props: post,
});
