import { gesture, type KeyDraft } from "../gesture";
import type { ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Side } from "../solve";
import { airborne, kneesForward } from "./flight";
import { approachStride } from "./high-jump";

type Footfall = { x: number; z: number; yaw: number };
const rig = { bar: null };

// Replacer la foulée de profil dans le repère tangent à la courbe.
// Entre la pose et la poussée, le même avant-pied reste au même point de la piste.
export function turningStride(side: Side, point: Footfall, phase: "touch" | "push", lean: number): ControlPatch {
  const local = approachStride(side, 0, phase);
  const angle = (point.yaw * Math.PI) / 180;
  const place = (x: number, z: number) =>
    [point.x + x * Math.cos(angle) - z * Math.sin(angle), point.z + x * Math.sin(angle) + z * Math.cos(angle)] as const;
  const pelvis = place(local.pelvisX!, lean * 1.3);
  const result: ControlPatch = {
    ...local,
    pelvisX: pelvis[0],
    pelvisZ: pelvis[1],
    pelvisYaw: point.yaw,
    pelvisRoll: lean,
    footRYaw: point.yaw,
    footLYaw: -point.yaw,
  };
  for (const foot of ["R", "L"] as const) {
    const pos = place(local[`foot${foot}X`]!, local[`foot${foot}Z`]!);
    result[`foot${foot}X`] = pos[0];
    result[`foot${foot}Z`] = pos[1];
  }
  return { ...result, ...kneesForward(result) };
}

const cone = (x: number, z: number): Prop => ({
  native: "side",
  paint: "cone",
  at: z,
  half: 6,
  shape: {
    kind: "poly",
    points: [
      { x: x - 8, y: 0 },
      { x, y: -16 },
      { x: x + 8, y: 0 },
    ],
  },
});
const checkpoint = (p: Footfall): Prop => ({
  native: "top",
  paint: "lane",
  at: 0,
  half: 1,
  shape: { kind: "rect", x: p.x - 4, y: p.z - 27, width: 8, height: 54 },
});

function runCurve(key: string, headings: number[], markerIndex: number, layout: "marks" | "gate" | "circle") {
  let x = -158,
    z = -52;
  const points = headings.map((yaw) => {
    const p = { x, z, yaw };
    const angle = (yaw * Math.PI) / 180;
    x += 52 * Math.cos(angle);
    z += 52 * Math.sin(angle);
    return p;
  });
  const keys: KeyDraft[] = [];
  let previous: ControlPatch | undefined;
  points.forEach((p, i) => {
    const side = i % 2 ? "R" : "L";
    const free = side === "R" ? "L" : "R";
    const lean = layout === "circle" ? 7 : Math.min(6, Math.abs(p.yaw) / 5);
    const touch = turningStride(side, p, "touch", lean);
    const push = turningStride(side, p, "push", lean);
    if (previous)
      keys.push(
        ...airborne({}, rig, { from: previous, to: touch, ms: 155, samples: 5, id: `flight-${i}`, phase: "stride" }),
      );
    keys.push(
      {
        id: `plant-${i}`,
        guide: i === 0 ? 0 : i === markerIndex ? 1 : undefined,
        set: touch,
        air: [free],
        hold: i === 0 ? 400 : 35,
        move:
          i === 0
            ? { ms: 1, phase: "reset", curve: "linear", cut: true }
            : { ms: 31, phase: "stride", curve: "linear" },
      },
      {
        id: `drive-${i}`,
        guide: i === points.length - 1 ? 2 : undefined,
        set: push,
        air: [free],
        hold: i === points.length - 1 ? 400 : 25,
        move: { ms: 150, phase: "support", curve: "impulsion" },
      },
    );
    previous = push;
  });
  const gate = points[markerIndex]!;
  const props =
    layout === "circle"
      ? points.filter((_, i) => i % 2 === 0).map((p) => cone(p.x, p.z + 64))
      : layout === "gate"
        ? [cone(gate.x, gate.z - 50), cone(gate.x, gate.z + 50)]
        : [checkpoint(points[0]!), checkpoint(key === "j-approach-check" ? points.at(-1)! : gate)];
  return gesture({
    key,
    athlete: "highJump",
    rig,
    keys,
    props: () => props,
    views: layout === "circle" ? ["front", "top", "side"] : ["top", "side", "front"],
  });
}

export const curveDrills = [
  runCurve("j-approach-check", [0, 0, 0, 14, 29, 45, 62], 3, "marks"),
  runCurve("curve-entry-gate", [0, 0, 0, 13, 26, 40], 2, "gate"),
  runCurve("circle-lean-run", [-28, -16, -4, 8, 20, 32, 44], 3, "circle"),
  runCurve("approach-checkpoint", [0, 0, 0, 0, 10, 22], 3, "marks"),
];
