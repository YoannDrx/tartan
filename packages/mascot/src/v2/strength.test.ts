// La dynamique propre des gestes de musculation écrits à la main, au-delà du squat arrière et de la fente latérale
// (gestures.test.ts) : excentrique lente et concentrique plus rapide, tenues franches, barre à l'aplomb du milieu
// du pied, appuis sur le banc et la barre fixe qui tiennent. Les contraintes communes sont vérifiées pour tous
// les gestes écrits dans gestures.test.ts.
import { describe, expect, it } from "vitest";
import { barPath, measure } from "./constraints";
import type { MotionClip } from "./gesture";
import {
  barbellRow,
  benchPress,
  bulgarianSquat,
  chinUp,
  deadlift,
  forwardLunge,
  frontSquat,
  goodMorning,
  hipThrust,
  overheadPress,
  parallelBarDips,
  pullUp,
  pushUp,
  reverseLunge,
  romanianDeadlift,
  STRENGTH_GESTURES,
  sumoDeadlift,
} from "./gestures";
import { backContact } from "./gestures/hip-thrust";
import { rackPoint } from "./gestures/clean";
import { gestureEntry } from "./registry";
import { SIDES } from "./solve";
import { distance } from "./vec";

const moves = (clip: MotionClip, id: string) => clip.phases.filter((phase) => !phase.hold && phase.id === id);
const length = (clip: MotionClip, id: string) => {
  const found = moves(clip, id);
  expect(found.length, `phase « ${id} »`).toBeGreaterThan(0);
  return found.reduce((sum, phase) => sum + (phase.to - phase.from), 0) * clip.duration;
};
const held = (clip: MotionClip, id: string) => {
  const phase = clip.phases.find((candidate) => candidate.hold && candidate.id === id);
  expect(phase, `tenue « ${id} »`).toBeDefined();
  return clip.pose((phase!.from + phase!.to) / 2);
};
const loop = (clip: MotionClip, count = 120) => Array.from({ length: count }, (_, i) => clip.pose(i / count));
const reading = (clip: MotionClip, t: number, joint: string) =>
  measure(clip.pose(t)).find((r) => r.joint === joint)!.value;

describe("musculation : la quinzaine de gestes de base", () => {
  it("est écrite à la main, avec Mehdi, sous les clés du catalogue", () => {
    const keys = STRENGTH_GESTURES.map((clip) => clip.key).sort();
    for (const key of [
      "front-squat",
      "deadlift",
      "romanian-deadlift",
      "sumo-deadlift",
      "hip-thrust",
      "bench-press",
      "overhead-press",
      "barbell-row",
      "pull-up",
      "chin-up",
      "forward-lunge",
      "reverse-lunge",
      "bulgarian-squat",
      "good-morning",
      "push-up",
      "parallel-bar-dips",
    ]) {
      expect(keys, key).toContain(key);
      expect(gestureEntry(key)!.level, key).toBe("ecrit");
    }
  });

  it("une pompe se lit de profil et de dessus ; un geste debout, de profil et de face", () => {
    expect(gestureEntry("push-up")!.views).toEqual(["side", "top"]);
    expect(gestureEntry("deadlift")!.views).toEqual(["side", "front"]);
    // Couché sur un banc, la tête reste haute : de face.
    expect(gestureEntry("bench-press")!.views).toEqual(["side", "front"]);
    expect(gestureEntry("hip-thrust")!.views).toEqual(["side", "front"]);
  });
});

// La descente (excentrique) est plus lente que la montée (concentrique).
describe.each([
  ["squat avant", frontSquat, "down", "up"],
  ["soulevé de terre", deadlift, "lower", "lift"],
  ["soulevé de terre roumain", romanianDeadlift, "down", "up"],
  ["soulevé de terre sumo", sumoDeadlift, "lower", "lift"],
  ["good morning", goodMorning, "down", "up"],
  ["hip thrust", hipThrust, "down", "up"],
  ["développé couché", benchPress, "down", "up"],
  ["développé militaire", overheadPress, "down", "up"],
  ["rowing barre", barbellRow, "lower", "pull"],
  ["tractions", pullUp, "lower", "pull"],
  ["tractions en supination", chinUp, "lower", "pull"],
  ["dips", parallelBarDips, "down", "up"],
  ["pompes", pushUp, "down", "up"],
  ["squat bulgare", bulgarianSquat, "down", "up"],
  ["fentes avant", forwardLunge, "down", "push"],
  ["fentes arrière", reverseLunge, "down", "push"],
] as const)("%s : le tempo", (_, clip, eccentric, concentric) => {
  it("excentrique plus lente que la concentrique, et au moins deux tenues franches", () => {
    expect(length(clip, eccentric)).toBeGreaterThan(1.3 * length(clip, concentric));
    const holds = clip.phases.filter((phase) => phase.hold);
    expect(holds.length).toBeGreaterThanOrEqual(2);
    for (const hold of holds) expect((hold.to - hold.from) * clip.duration).toBeGreaterThanOrEqual(199);
  });
});

describe.each([
  ["squat avant", frontSquat, 6],
  ["soulevé de terre", deadlift, 10],
  ["soulevé de terre roumain", romanianDeadlift, 12],
  ["soulevé de terre sumo", sumoDeadlift, 10],
  ["good morning", goodMorning, 12],
  ["développé militaire", overheadPress, 22],
] as const)("%s : la barre", (_, clip, envelope) => {
  it("reste près de l'aplomb du milieu du pied", () => {
    for (const sample of barPath(clip, 400))
      expect(Math.abs(sample.x), `t = ${sample.t}`).toBeLessThanOrEqual(envelope);
  });

  it("les talons ne décollent jamais", () => {
    for (const body of loop(clip)) for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
  });
});

describe("squat avant", () => {
  it("coudes hauts devant, barre sur les épaules ; en bas, hanches sous les genoux, buste plus droit qu'au squat arrière", () => {
    for (const body of loop(frontSquat)) {
      const rack = rackPoint(body.controls);
      expect(Math.hypot(body.bar!.center.x - rack.x, body.bar!.center.y - rack.y)).toBeLessThan(1);
      expect(body.arms.R.elbow.x).toBeGreaterThan(body.arms.R.shoulder.x + 15);
    }
    const bottom = held(frontSquat, "bottom");
    for (const side of SIDES) expect(bottom.legs[side].hip.y).toBeLessThan(bottom.legs[side].knee.y);
    const back = held(gestureEntry("back-squat")!.clip, "bottom");
    expect(bottom.frames.thorax.u.x).toBeLessThan(back.frames.thorax.u.x);
  });
});

describe.each([
  ["soulevé de terre", deadlift],
  ["soulevé de terre sumo", sumoDeadlift],
] as const)("%s", (_, clip) => {
  it("part du sol, disques posés, bras tendus, et finit debout, jambes et hanches tendues", () => {
    expect(held(clip, "start").bar!.center.y).toBeCloseTo(41, 6);
    for (let i = 0; i < 120; i += 1) expect(reading(clip, i / 120, "coude R")).toBeLessThan(5);
    const top = held(clip, "lockout");
    for (const side of SIDES) expect(top.legs[side].flexion).toBeLessThan(5);
    expect(Math.abs(top.frames.thorax.u.x)).toBeLessThan(0.1);
    // Au départ, les épaules sont à l'aplomb de la barre ou un peu devant.
    const start = held(clip, "start");
    expect(start.arms.R.shoulder.x).toBeGreaterThanOrEqual(start.bar!.center.x - 2);
  });
});

describe("soulevé de terre sumo", () => {
  it("pieds larges, mains entre les genoux, genoux dans l'axe des pointes", () => {
    const start = held(sumoDeadlift, "start");
    for (const side of SIDES) {
      const out = side === "R" ? 1 : -1;
      const leg = start.legs[side];
      expect(out * leg.ball.z).toBeGreaterThan(55);
      expect(out * (leg.knee.z - start.arms[side].hand.z)).toBeGreaterThan(10);
      expect(out * (leg.knee.z - leg.hip.z)).toBeGreaterThan(20);
    }
  });
});

describe("soulevé de terre roumain", () => {
  it("les hanches reculent, les genoux restent peu fléchis, la barre descend sous les genoux sans toucher le sol", () => {
    const top = held(romanianDeadlift, "standing");
    const bottom = held(romanianDeadlift, "bottom");
    expect(bottom.pelvis.x).toBeLessThan(top.pelvis.x - 40);
    for (const body of loop(romanianDeadlift))
      for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(35);
    expect(bottom.bar!.center.y).toBeLessThan(bottom.legs.R.knee.y);
    expect(bottom.bar!.center.y).toBeGreaterThan(60);
    for (let i = 0; i < 120; i += 1) expect(reading(romanianDeadlift, i / 120, "coude R")).toBeLessThan(5);
  });
});

describe("good morning", () => {
  it("la barre reste sur le dos, genoux souples, buste incliné en bas", () => {
    for (const body of loop(goodMorning))
      for (const side of SIDES) {
        expect(body.legs[side].flexion).toBeGreaterThan(5);
        expect(body.legs[side].flexion).toBeLessThan(40);
      }
    expect(held(goodMorning, "bottom").frames.thorax.u.x).toBeGreaterThan(0.8);
  });
});

describe("rowing barre", () => {
  it("le buste ne bouge pas pendant le tirage, la barre monte au ventre, puis redescend bras tendus", () => {
    const { from } = moves(barbellRow, "pull")[0]!;
    const to = moves(barbellRow, "lower").at(-1)!.to;
    const first = barbellRow.pose(from);
    for (let i = 0; i <= 40; i += 1) {
      const body = barbellRow.pose(from + ((to - from) * i) / 40);
      expect(distance(body.pelvis, first.pelvis)).toBeLessThan(1e-6);
      expect(distance(body.neck, first.neck)).toBeLessThan(1e-6);
    }
    expect(first.frames.thorax.u.x).toBeGreaterThan(0.75);
    const top = held(barbellRow, "top");
    expect(distance(top.bar!.center, top.chest)).toBeLessThan(40);
    expect(top.arms.R.flexion).toBeGreaterThan(90);
    expect(held(barbellRow, "set").arms.R.flexion).toBeLessThan(3);
  });
});

describe("hip thrust", () => {
  it("le haut du dos pivote sur le bord du banc sans glisser, les pieds à plat", () => {
    const edge = backContact(hipThrust.pose(0));
    for (const body of loop(hipThrust)) {
      expect(distance(backContact(body), edge)).toBeLessThan(3);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
    }
  });

  it("en haut : buste et cuisses alignés, tibias presque verticaux, barre sur les hanches", () => {
    const top = held(hipThrust, "top");
    const leg = top.legs.R;
    expect(Math.abs(leg.hip.y - top.neck.y)).toBeLessThan(25);
    expect(Math.abs(leg.knee.x - leg.ankle.x)).toBeLessThan(12);
    expect(distance(top.bar!.center, top.pelvis)).toBeLessThan(30);
    expect(held(hipThrust, "bottom").pelvis.y).toBeLessThan(top.pelvis.y - 40);
  });
});

describe("développé couché", () => {
  it("allongé, immobile ; la barre part au-dessus des épaules, touche le bas de la poitrine, remonte bras tendus", () => {
    const top = held(benchPress, "top");
    for (const body of loop(benchPress)) {
      expect(distance(body.pelvis, top.pelvis)).toBeLessThan(1e-6);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
    }
    expect(Math.abs(top.bar!.center.x - top.arms.R.shoulder.x)).toBeLessThan(2);
    for (const side of SIDES) expect(top.arms[side].flexion).toBeLessThan(3);
    const bottom = held(benchPress, "bottom");
    expect(bottom.bar!.center.x).toBeGreaterThan(bottom.arms.R.shoulder.x + 20);
    expect(bottom.bar!.center.y - bottom.chest.y).toBeLessThan(30);
    // Prise un peu plus large que les épaules, avant-bras presque verticaux en bas.
    expect(Math.abs(bottom.arms.R.hand.z)).toBeGreaterThan(Math.abs(bottom.arms.R.shoulder.z));
    expect(Math.abs(bottom.arms.R.wrist.z - bottom.arms.R.elbow.z)).toBeLessThan(25);
  });
});

describe("développé militaire", () => {
  it("les jambes ne bougent pas ; la barre passe devant le visage et finit bras verrouillés au-dessus de la tête", () => {
    for (const body of loop(overheadPress)) for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(5);
    for (const sample of barPath(overheadPress, 600)) {
      const body = overheadPress.pose(sample.t);
      if (Math.abs(sample.y - body.head.y) < 20) expect(sample.x, `t = ${sample.t}`).toBeGreaterThan(body.head.x + 27);
    }
    const top = held(overheadPress, "lockout");
    for (const side of SIDES) expect(top.arms[side].flexion).toBeLessThan(3);
    expect(Math.abs(top.bar!.center.x - top.neck.x)).toBeLessThan(10);
  });
});

describe.each([
  ["tractions", pullUp],
  ["tractions en supination", chinUp],
] as const)("%s", (_, clip) => {
  it("les mains ne quittent pas la barre fixe, les pieds jamais le sol... ni ne le touchent", () => {
    const hand = clip.pose(0).arms.R.hand;
    for (const body of loop(clip)) {
      expect(distance(body.arms.R.hand, hand)).toBeLessThan(0.5);
      for (const side of SIDES) expect(body.legs[side].toe.y).toBeGreaterThan(20);
    }
  });

  it("départ bras allongés, épaules engagées avant de tirer, le menton au-dessus de la barre en haut", () => {
    const dead = held(clip, "hang");
    const engaged = held(clip, "engage");
    expect(dead.arms.R.flexion).toBeLessThan(5);
    expect(engaged.controls.shrug).toBeLessThan(dead.controls.shrug);
    const top = held(clip, "top");
    const bar = top.arms.R.hand.y;
    // Le menton : sous le centre de la tête.
    expect(top.head.y - 18).toBeGreaterThan(bar);
    expect(top.head.x).toBeLessThan(top.arms.R.hand.x - 26);
  });
});

describe("tractions : pronation et supination", () => {
  it("la pronation est plus large, coudes vers l'extérieur ; la supination plus serrée, coudes vers l'avant", () => {
    const [wide, narrow] = [held(pullUp, "top"), held(chinUp, "top")];
    expect(Math.abs(wide.arms.R.hand.z)).toBeGreaterThan(Math.abs(narrow.arms.R.hand.z) + 15);
    expect(wide.arms.R.elbow.z).toBeGreaterThan(narrow.arms.R.elbow.z + 10);
  });
});

describe("dips", () => {
  it("les mains tiennent les barres, les pieds en l'air ; en bas, coude à peu près droit et buste penché vers l'avant", () => {
    const hand = parallelBarDips.pose(0).arms.R.hand;
    for (const body of loop(parallelBarDips)) {
      expect(distance(body.arms.R.hand, hand)).toBeLessThan(0.5);
      for (const side of SIDES) expect(body.legs[side].toe.y).toBeGreaterThan(40);
    }
    expect(held(parallelBarDips, "support").arms.R.flexion).toBeLessThan(6);
    const bottom = held(parallelBarDips, "bottom");
    expect(bottom.arms.R.flexion).toBeGreaterThan(80);
    expect(bottom.arms.R.flexion).toBeLessThan(105);
    expect(bottom.frames.thorax.u.x).toBeGreaterThan(0.25);
  });
});

describe("pompes", () => {
  it("mains et pointes de pieds fixes ; le corps reste aligné des chevilles aux épaules", () => {
    const hand = pushUp.pose(0).arms.R.hand;
    for (const body of loop(pushUp)) {
      expect(distance(body.arms.R.hand, hand)).toBeLessThan(0.5);
      // Les chevilles, le bassin et les épaules sur une même ligne, à quelques unités près.
      const [a, p, s] = [body.legs.R.ankle, body.pelvis, body.arms.R.shoulder];
      const cross = (p.x - a.x) * (s.y - a.y) - (p.y - a.y) * (s.x - a.x);
      expect(Math.abs(cross) / Math.hypot(s.x - a.x, s.y - a.y)).toBeLessThan(6);
    }
  });

  it("en haut bras tendus, mains sous les épaules ; en bas, la poitrine près du sol", () => {
    const top = held(pushUp, "top");
    expect(top.arms.R.flexion).toBeLessThan(6);
    expect(Math.abs(top.arms.R.hand.x - top.arms.R.shoulder.x)).toBeLessThan(6);
    const bottom = held(pushUp, "bottom");
    expect(bottom.arms.R.shoulder.y).toBeLessThan(60);
    expect(bottom.arms.R.flexion).toBeGreaterThan(90);
  });
});

describe.each([
  ["fentes avant", forwardLunge, "R", "L"],
  ["fentes arrière", reverseLunge, "R", "L"],
] as const)("%s", (_, clip, front, rear) => {
  it("en bas : tibia avant à peu près vertical, genou arrière près du sol sans le toucher, talon arrière levé, buste droit", () => {
    const bottom = held(clip, "bottom");
    const [f, r] = [bottom.legs[front], bottom.legs[rear]];
    expect(Math.abs(f.knee.x - f.ankle.x)).toBeLessThan(18);
    expect(f.heel.y).toBeCloseTo(0, 6);
    expect(r.knee.y).toBeLessThan(40);
    expect(r.knee.y).toBeGreaterThan(12);
    expect(r.heel.y).toBeGreaterThan(15);
    expect(Math.abs(bottom.frames.thorax.u.x)).toBeLessThan(0.2);
    expect(f.ball.x - r.ball.x).toBeGreaterThan(110);
  });

  it("le pied qui reste ne bouge pas de toute la boucle", () => {
    const still = clip.key === "forward-lunge" ? "L" : "R";
    const home = clip.pose(0).legs[still].ball;
    for (const body of loop(clip)) expect(distance(body.legs[still].ball, home)).toBeLessThan(1e-6);
  });
});

describe("squat bulgare", () => {
  it("le pied arrière reste sur le banc, la jambe avant descend jusqu'à la cuisse à peu près horizontale", () => {
    const rest = bulgarianSquat.pose(0).legs.L.ball;
    for (const body of loop(bulgarianSquat)) {
      expect(distance(body.legs.L.ball, rest)).toBeLessThan(1e-6);
      expect(body.legs.L.ball.y).toBeGreaterThan(60);
      expect(body.legs.R.heel.y).toBeCloseTo(0, 6);
    }
    const bottom = held(bulgarianSquat, "bottom");
    expect(Math.abs(bottom.legs.R.hip.y - bottom.legs.R.knee.y)).toBeLessThan(15);
    expect(bottom.legs.L.knee.y).toBeLessThan(45);
  });
});
