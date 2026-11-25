import { phaseAt } from "../constraints";
import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Side } from "../solve";
import { airborne } from "./flight";

const rig = { bar: null };
type Landing = { x: number; z: number; heading?: number; left?: number; right?: number; free?: Side; back?: number };
function posture(p: Landing, heel: number): ControlPatch {
  const yaw = p.heading ?? 0,
    a = (yaw * Math.PI) / 180;
  const pose: ControlPatch = {
    pelvisX: p.x - 4 * Math.cos(a),
    pelvisZ: p.z - 4 * Math.sin(a),
    pelvisY: heel ? 999 : 157,
    pelvisYaw: yaw,
    pelvisPitch: 3,
    ...hands(25, -85, 48),
  };
  for (const side of ["R", "L"] as const) {
    const along = (side === "R" ? p.right : p.left) ?? 0,
      across = side === "R" ? 18 : -18;
    pose[`foot${side}X`] = p.x + along * Math.cos(a) - across * Math.sin(a);
    pose[`foot${side}Z`] = p.z + along * Math.sin(a) + across * Math.cos(a);
    pose[`foot${side}Yaw`] = side === "R" ? yaw : -yaw;
    pose[`foot${side}Lift`] = p.free === side ? (p.back ?? 30) : 0;
    pose[`foot${side}Heel`] = p.free === side ? 30 : heel;
  }
  return pose;
}
const marker = (across: boolean): Prop => ({
  native: "top",
  paint: "lane",
  half: 1,
  at: 0,
  shape: {
    kind: "rect",
    x: across ? -3 : -85,
    y: across ? -72 : -3,
    width: across ? 6 : 170,
    height: across ? 144 : 6,
  },
});
function rebounds(key: string, landings: Landing[], flightMs: number, props: Prop[], rope = false) {
  const keys: KeyDraft[] = [];
  for (const [i, landing] of landings.entries()) {
    const from = posture(landing, 0),
      push = posture(landing, 24);
    const free = landing.free ? [landing.free] : [];
    if (i)
      keys.push(
        ...airborne({}, rig, {
          from: posture(landings[i - 1]!, 24),
          to: from,
          phase: `flight-${i}`,
          ms: flightMs,
          samples: 6,
        }),
      );
    keys.push({
      id: `land-${i}`,
      guide: i === 0 ? 0 : i === landings.length - 1 ? 2 : i === 1 ? 1 : undefined,
      set: from,
      air: free,
      hold: i === 0 || i === landings.length - 1 ? 360 : 45,
      move: i
        ? { ms: flightMs / 6, phase: `flight-${i}`, curve: "linear" }
        : { ms: 1, phase: "reset", curve: "linear", cut: true },
    });
    if (i < landings.length - 1)
      keys.push({
        id: `push-${i}`,
        guide: landings.length === 2 ? 1 : undefined,
        set: push,
        air: free,
        hold: 25,
        move: { ms: 200, phase: "push", curve: "impulsion" },
      });
  }
  const clip = gesture({
    key,
    athlete: rope ? "hurdles" : "highJump",
    rig,
    keys,
    props: () => props,
    views: ["front", "side", "top"],
  });
  if (!rope) return clip;
  return {
    ...clip,
    props: (t: number, body: ReturnType<typeof clip.pose>): Prop[] => {
      const phase = phaseAt(clip, t);
      const spans = clip.phases.filter((p) => p.id === phase.id && !p.hold);
      // La corde passe sous les chaussures au milieu de chaque vol et remonte avant la pose.
      const turn =
        phase.id.startsWith("flight-") && !phase.hold ? (t - spans[0]!.from) / (spans.at(-1)!.to - spans[0]!.from) : 0;
      const angle = turn * 2 * Math.PI,
        a = body.arms.R.hand,
        b = body.arms.L.hand;
      const midY = (a.y + b.y) / 2,
        radius = midY + 55;
      const low = Math.min(body.legs.R.ball.y, body.legs.L.ball.y) - 5;
      const arcHeight = midY + (Math.cos(angle) >= 0 ? radius : midY - Math.max(1, low)) * Math.cos(angle);
      const z = (a.z + b.z) / 2;
      const yControl = 2 * arcHeight - midY;
      return [
        {
          native: "front",
          at: (a.x + b.x) / 2 + Math.sin(angle) * radius,
          half: 2,
          paint: "band",
          front: turn < 0.5,
          shape: {
            kind: "curve",
            from: { x: -a.z, y: -a.y },
            to: { x: -b.z, y: -b.y },
            control: { x: -z, y: -yControl },
            width: 3,
          },
        },
      ];
    },
  };
}
const sites = (...z: number[]): Landing[] => z.map((z) => ({ x: 0, z }));
export const stadiumRebounds = [
  rebounds(
    "single-pogo-line",
    [-38, 12, -38, 12].map((z) => ({ x: 0, z, free: "L" })),
    245,
    [marker(false)],
  ),
  rebounds(
    "pogo-forward-back",
    [-34, 28, -34, 28].map((x) => ({ x, z: 0 })),
    255,
    [marker(true)],
  ),
  rebounds(
    "quarter-turn-stick",
    [
      { x: -40, z: 0 },
      { x: 12, z: 0, heading: 90 },
    ],
    365,
    [marker(true), marker(false)],
  ),
  rebounds(
    "split-contact-switch",
    [-1, 1, -1, 1].map((sign) => ({ x: 0, z: 0, right: sign * 34, left: -sign * 34 })),
    285,
    [marker(true)],
  ),
  rebounds(
    "rope-boxer-step",
    [-1, 1, -1, 1].map((sign) => ({ x: 0, z: 4 * sign, free: sign < 0 ? "R" : "L", back: 9 })),
    250,
    [],
    true,
  ),
  rebounds("rope-skier", sites(-22, 22, -22, 22), 260, [], true),
  rebounds(
    "rope-running-step",
    [-1, 1, -1, 1].map((sign) => ({
      x: 0,
      z: 0,
      right: 12 * sign,
      left: -12 * sign,
      free: sign < 0 ? "R" : "L",
      back: 42,
    })),
    275,
    [],
    true,
  ),
];
