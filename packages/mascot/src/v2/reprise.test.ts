// La dynamique propre des gestes écrits pour sortir de la table des gestes à reprendre : pompes inclinées, tirage
// inversé, balancements de jambe, cercles de hanche, gainage latéral, pas croisés, escaliers en pas croisés,
// squat large, mobilités au sol. Les contraintes communes sont vérifiées dans gestures.test.ts.
import { describe, expect, it } from "vitest";
import type { MotionClip } from "./gesture";
import { GESTURES } from "./gestures";
import { gestureEntry } from "./registry";
import { SIDES, type Side } from "./solve";
import { distance } from "./vec";

const clip = (key: string) => GESTURES[key]!;
const loop = (gesture: MotionClip, count = 120) => Array.from({ length: count }, (_, i) => gesture.pose(i / count));
const held = (gesture: MotionClip, id: string) => {
  const phase = gesture.phases.find((candidate) => candidate.hold && candidate.id === id);
  expect(phase, `tenue « ${id} »`).toBeDefined();
  return gesture.pose((phase!.from + phase!.to) / 2);
};
const at = (gesture: MotionClip, id: string) => gesture.pose(gesture.stills.find((still) => still.id === id)!.t);
const length = (gesture: MotionClip, id: string) =>
  gesture.phases.filter((phase) => !phase.hold && phase.id === id).reduce((sum, p) => sum + p.to - p.from, 0) *
  gesture.duration;
// Le point le plus éloigné d'un point de départ, sur toute la boucle.
const drift = (
  gesture: MotionClip,
  point: (body: ReturnType<MotionClip["pose"]>) => { x: number; y: number; z: number },
) => {
  const first = point(gesture.pose(0));
  return Math.max(...loop(gesture).map((body) => distance(point(body), first)));
};

describe("la table des gestes à reprendre se vide", () => {
  it.each([
    "incline-push-up",
    "inverted-row",
    "side-plank",
    "carioca",
    "cross-step-stairs",
    "leg-swings",
    "adductor-rockback",
    "hip-car",
    "toe-extension-rock",
    "hip-90-90",
    "cossack-mobility",
    "prone-hip-rotation",
  ])("%s est écrit à la main, avec l'athlète du premier moteur", (key) => {
    expect(gestureEntry(key)!.level).toBe("ecrit");
    expect(clip(key).athlete).toBe(gestureEntry(key)!.clip.athlete);
  });
});

describe("pompes inclinées", () => {
  const gesture = clip("incline-push-up");
  it("mains fixes sur le banc, pointes de pieds fixes ; en haut bras tendus, en bas la poitrine près du banc", () => {
    expect(drift(gesture, (body) => body.arms.R.hand)).toBeLessThan(0.5);
    expect(drift(gesture, (body) => body.legs.R.ball)).toBeLessThan(1e-6);
    expect(gesture.pose(0).arms.R.hand.y).toBeGreaterThan(80);
    expect(held(gesture, "top").arms.R.flexion).toBeLessThan(6);
    const bottom = held(gesture, "bottom");
    expect(bottom.arms.R.flexion).toBeGreaterThan(80);
    expect(bottom.arms.R.shoulder.y - bottom.arms.R.hand.y).toBeLessThan(45);
    expect(length(gesture, "down")).toBeGreaterThan(1.3 * length(gesture, "up"));
  });
});

describe("tirage inversé", () => {
  const gesture = clip("inverted-row");
  it("les mains tiennent la barre, les talons restent posés, le corps droit monte vers la barre", () => {
    expect(drift(gesture, (body) => body.arms.R.hand)).toBeLessThan(0.5);
    expect(drift(gesture, (body) => body.legs.R.ball)).toBeLessThan(1e-6);
    for (const body of loop(gesture)) for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(15);
    const [low, high] = [held(gesture, "hang"), held(gesture, "top")];
    expect(low.arms.R.flexion).toBeLessThan(6);
    expect(high.arms.R.flexion).toBeGreaterThan(110);
    expect(high.arms.R.hand.y - high.chest.y).toBeLessThan(45);
    expect(length(gesture, "lower")).toBeGreaterThan(1.3 * length(gesture, "pull"));
  });
});

describe.each([
  ["balancements de jambe", "leg-swings"],
  ["cercles de hanche", "hip-car"],
])("%s : debout sur une jambe", (_, key) => {
  const gesture = clip(key);
  it("le pied d'appui et la main sur le support ne bougent pas, le bassin non plus", () => {
    expect(drift(gesture, (body) => body.legs.L.ball)).toBeLessThan(1e-6);
    expect(drift(gesture, (body) => body.arms.L.hand)).toBeLessThan(0.5);
    expect(drift(gesture, (body) => body.pelvis)).toBeLessThan(1e-6);
  });
});

describe("balancements de jambe", () => {
  const gesture = clip("leg-swings");
  it("la jambe libre va devant puis derrière, plus loin à la seconde série", () => {
    const forward = (id: string) => at(gesture, id).legs.R.ankle.x - at(gesture, id).pelvis.x;
    expect(forward("front")).toBeGreaterThan(50);
    expect(forward("back")).toBeLessThan(-20);
    expect(forward("front-wide")).toBeGreaterThan(forward("front") + 20);
    expect(forward("back-wide")).toBeLessThan(forward("back"));
  });
});

describe("cercles de hanche", () => {
  const gesture = clip("hip-car");
  it("le genou monte devant à hauteur de hanche, s'ouvre sur le côté, passe derrière, puis le sens s'inverse", () => {
    const front = held(gesture, "front");
    expect(front.legs.R.knee.y).toBeGreaterThan(front.legs.R.hip.y - 15);
    expect(front.legs.R.knee.x).toBeGreaterThan(front.legs.R.hip.x + 60);
    const side = at(gesture, "side");
    expect(side.legs.R.knee.z).toBeGreaterThan(side.legs.R.hip.z + 40);
    expect(at(gesture, "back").legs.R.knee.x).toBeLessThan(at(gesture, "back").legs.R.hip.x);
    const order = gesture.stills.map((still) => still.id);
    expect(order.indexOf("back-again")).toBeLessThan(order.indexOf("side-again"));
  });
});

describe("gainage latéral", () => {
  const gesture = clip("side-plank");
  it("l'avant-bras et les pieds restent posés, l'épaule au-dessus du coude ; le bassin monte jusqu'à l'alignement", () => {
    expect(drift(gesture, (body) => body.arms.L.hand)).toBeLessThan(0.5);
    expect(drift(gesture, (body) => body.legs.L.ball)).toBeLessThan(1e-6);
    expect(drift(gesture, (body) => body.arms.L.shoulder)).toBeLessThan(2);
    const [down, plank] = [held(gesture, "down"), held(gesture, "plank")];
    expect(plank.pelvis.y).toBeGreaterThan(down.pelvis.y + 15);
    // Aligné : le bassin sur la droite qui va du milieu des chevilles à la base du cou.
    const mid = {
      x: (plank.legs.L.ankle.x + plank.legs.R.ankle.x) / 2,
      y: (plank.legs.L.ankle.y + plank.legs.R.ankle.y) / 2,
    };
    const [a, p, s] = [mid, plank.pelvis, plank.neck];
    const u = (p.x - a.x) / (s.x - a.x);
    expect(Math.abs(a.y + u * (s.y - a.y) - p.y)).toBeLessThan(8);
    // Couché sur le côté : la poitrine regarde de côté, pas le sol.
    expect(Math.abs(plank.frames.thorax.f.z)).toBeGreaterThan(0.9);
    expect(gestureEntry("side-plank")!.views).toEqual(["side", "top"]);
  });
});

describe("pas croisés", () => {
  const gesture = clip("carioca");
  it("le pied gauche croise devant puis derrière le droit, le bassin tourne un peu, puis tout revient au départ", () => {
    const front = at(gesture, "cross-front");
    expect(front.legs.L.ball.z).toBeGreaterThan(front.legs.R.ball.z);
    expect(front.legs.L.ball.x).toBeGreaterThan(front.legs.R.ball.x + 8);
    const back = at(gesture, "cross-back");
    expect(back.legs.L.ball.z).toBeGreaterThan(back.legs.R.ball.z);
    expect(back.legs.L.ball.x).toBeLessThan(back.legs.R.ball.x - 8);
    expect(Math.abs(front.controls.pelvisYaw)).toBeGreaterThan(10);
    const turn = held(gesture, "turn");
    expect(turn.pelvis.z - gesture.pose(0).pelvis.z).toBeGreaterThan(100);
    expect(gestureEntry("carioca")!.native).toBe("front");
  });
});

describe("escaliers en pas croisés", () => {
  const gesture = clip("cross-step-stairs");
  it("le pied gauche croise devant pour monter, le droit monte une marche plus haut, puis la descente ramène au sol", () => {
    const up = at(gesture, "cross-up");
    expect(up.legs.L.ball.y).toBeGreaterThan(20);
    expect(up.legs.R.ball.y).toBeCloseTo(0, 6);
    expect(up.legs.L.ball.z).toBeGreaterThan(up.legs.R.ball.z);
    const top = held(gesture, "bring-up");
    expect(top.legs.R.ball.y).toBeGreaterThan(top.legs.L.ball.y + 20);
    const ready = held(gesture, "ready");
    for (const side of SIDES) expect(ready.legs[side].ball.y).toBeCloseTo(0, 6);
  });
});

describe("transfert latéral en squat large", () => {
  const gesture = clip("cossack-mobility");
  it.each([
    ["low-right", "R", "L"],
    ["low-left", "L", "R"],
  ] as const)("%s : jambe fléchie talon au sol, l'autre allongée, pieds immobiles", (id, bent, long) => {
    const low = held(gesture, id);
    expect(low.legs[bent as Side].flexion).toBeGreaterThan(95);
    expect(low.legs[long as Side].flexion).toBeLessThan(low.legs[bent as Side].flexion - 30);
    expect(low.legs[bent as Side].heel.y).toBeCloseTo(0, 6);
    expect(drift(gesture, (body) => body.legs.R.ball)).toBeLessThan(1e-6);
    expect(drift(gesture, (body) => body.legs.L.ball)).toBeLessThan(1e-6);
  });
});

describe.each([
  ["recul du bassin pour les adducteurs", "adductor-rockback", "quadruped"],
  ["mobilité des orteils", "toe-extension-rock", "kneeling"],
])("%s", (_, key, start) => {
  const gesture = clip(key);
  it("les mains et le genou posés ne bougent pas ; le bassin recule vers le talon puis revient", () => {
    expect(drift(gesture, (body) => body.arms.R.hand)).toBeLessThan(0.5);
    expect(drift(gesture, (body) => body.legs.L.knee)).toBeLessThan(3);
    for (const body of loop(gesture)) expect(body.legs.L.knee.y).toBeLessThan(16);
    expect(held(gesture, "back").pelvis.x).toBeLessThan(held(gesture, start).pelvis.x - 25);
    // Les orteils repliés : l'avant-pied au sol, le talon haut.
    expect(held(gesture, "back").legs.L.heel.y).toBeGreaterThan(30);
  });
});

describe("rotation de hanche allongé sur le ventre", () => {
  const gesture = clip("prone-hip-rotation");
  it("le bassin et le genou restent au sol, le pied part vers l'extérieur puis vers l'intérieur", () => {
    expect(drift(gesture, (body) => body.pelvis)).toBeLessThan(1e-6);
    expect(drift(gesture, (body) => body.legs.R.knee)).toBeLessThan(2.5);
    const [out, inside] = [held(gesture, "out"), held(gesture, "in")];
    expect(out.legs.R.ankle.z).toBeGreaterThan(out.legs.R.knee.z + 30);
    expect(inside.legs.R.ankle.z).toBeLessThan(inside.legs.R.knee.z - 30);
    expect(gestureEntry("prone-hip-rotation")!.native).toBe("top");
  });
});

describe("mobilité des hanches", () => {
  const gesture = clip("hip-90-90");
  it("les pieds et les mains restent posés, les genoux basculent d'un côté puis de l'autre en passant par le centre", () => {
    expect(drift(gesture, (body) => body.legs.R.ball)).toBeLessThan(1e-6);
    expect(drift(gesture, (body) => body.arms.R.hand)).toBeLessThan(0.5);
    const [right, left, center] = [held(gesture, "right"), held(gesture, "left"), held(gesture, "center")];
    expect(right.legs.R.knee.z).toBeGreaterThan(center.legs.R.knee.z + 25);
    expect(right.legs.L.knee.z).toBeGreaterThan(center.legs.L.knee.z + 25);
    expect(left.legs.L.knee.z).toBeLessThan(center.legs.L.knee.z - 25);
    expect(center.legs.R.knee.y).toBeGreaterThan(right.legs.R.knee.y + 10);
  });
});
