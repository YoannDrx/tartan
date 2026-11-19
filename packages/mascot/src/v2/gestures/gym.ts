// Ce que les gestes de musculation partagent : le matériel posé (un banc, une barre fixe, des barres parallèles),
// les haltères tenus, et le calcul qui place le bassin quand le corps est suspendu ou appuyé sur les mains.
import { FIGURE } from "../body";
import { span } from "../ik";
import { STAND, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { SIDES, solve, type Solved } from "../solve";
import { sub, type Vec3 } from "../vec";

// Un banc vu de profil : le plateau, à la hauteur `top`, et deux pieds. `half` : sa demi-largeur en travers.
export const bench = (from: number, to: number, top: number, half = 26): Prop[] => [
  {
    paint: "bench",
    shape: { kind: "rect", x: from, y: -top, width: to - from, height: 14, radius: 4 },
    native: "side",
    at: 0,
    half,
  },
  ...[from + 8, to - 18].map((x): Prop => ({
    paint: "iron",
    shape: { kind: "rect", x, y: -top + 12, width: 10, height: top - 12 },
    native: "side",
    at: 0,
    half: half - 6,
  })),
];

// Une barre fixe vue par son bout, à la hauteur `y`, tenue par une potence dont le montant est derrière l'athlète.
export const pullBar = (x: number, y: number, half: number, back = 90): Prop[] => [
  {
    paint: "iron",
    shape: { kind: "rect", x: x - back - 5, y: -y - 6, width: 10, height: y + 6, radius: 2 },
    native: "side",
    at: 0,
    half: 5,
  },
  {
    paint: "iron",
    shape: { kind: "line", from: { x: x - back, y: -y }, to: { x, y: -y }, width: 7 },
    native: "side",
    at: 0,
    half: 4,
  },
  { paint: "iron", shape: { kind: "disc", x, y: -y, radius: 5 }, native: "side", at: 0, half, front: true },
];

// Deux barres parallèles, une de chaque côté du corps, sur leurs montants.
export const parallelBars = (x: number, y: number, z: number, long = 70): Prop[] =>
  [-1, 1].flatMap((k): Prop[] => [
    {
      paint: "iron",
      shape: { kind: "line", from: { x: x - long, y: -y }, to: { x: x + long, y: -y }, width: 8 },
      native: "side",
      at: k * z,
      half: 4,
      ...(k > 0 ? { front: true } : {}),
    },
    {
      paint: "iron",
      shape: { kind: "rect", x: x + long - 15, y: -y, width: 9, height: y },
      native: "side",
      at: k * z,
      half: 4,
      ...(k > 0 ? { front: true } : {}),
    },
  ]);

// Un haltère dans chaque main, vu par son bout.
export const dumbbells = (body: Solved): Prop[] =>
  SIDES.map((side) => {
    const hand = body.arms[side].hand;
    return {
      paint: "iron",
      shape: { kind: "disc", x: hand.x, y: -hand.y, radius: 11 },
      native: "side",
      at: hand.z,
      half: 9,
      front: side === "R",
    };
  });

// La portée d'un bras dont le coude est plié de `flexion` degrés, le poignet cassé de `wrist` degrés.
export const armSpan = (flexion: number, wrist = 0) =>
  span(FIGURE.upperArm, span(FIGURE.forearm, FIGURE.hand, Math.abs(wrist)), flexion);

// Les mains tenues à un point fixe de la scène, de part et d'autre du corps (la main droite à `hand`).
export const pinned = (hand: Vec3): ControlPatch => ({
  handRPin: 1,
  handRX: hand.x,
  handRY: hand.y,
  handRZ: hand.z,
  handLPin: 1,
  handLX: hand.x,
  handLY: hand.y,
  handLZ: -hand.z,
});

// La hauteur du bassin qui met l'épaule droite à la portée d'un bras plié de `flexion` degrés de la main posée :
// au-dessus d'elle (appuyé sur les mains) ou en dessous (suspendu).
export const pelvisFor = (patch: ControlPatch, hand: Vec3, flexion: number, above: boolean): number => {
  const body = solve({ ...STAND, ...patch, pelvisY: 0, footRLift: 0, footLLift: 0 }, { bar: null });
  const shoulder = sub(body.arms.R.shoulder, body.pelvis);
  const reach = armSpan(flexion, patch.wrist ?? 0);
  const dx = hand.x - (body.pelvis.x + shoulder.x);
  const dz = hand.z - shoulder.z;
  const dy = Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz));
  return hand.y + (above ? dy : -dy) - shoulder.y;
};
