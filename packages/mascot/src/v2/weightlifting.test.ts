// La dynamique propre des gestes d'haltérophilie écrits à la main, au-delà de l'arraché, de l'épaulé et de
// l'épaulé-jeté (gestures.test.ts) : les variantes en puissance et en suspension, les tirages, les gestes bras
// tendus, les jetés. Les contraintes communes (amplitudes, sol, appuis, prise, tenues, boucle) sont vérifiées
// pour tous les gestes écrits dans gestures.test.ts.
import { describe, expect, it } from "vitest";
import { WEIGHTLIFTING } from "../exercises/weightlifting";
import { barAt, barPath, measure } from "./constraints";
import type { MotionClip } from "./gesture";
import {
  clean,
  cleanPull,
  GESTURES,
  hangClean,
  hangPowerClean,
  hangPowerSnatch,
  hangSnatch,
  jerkDipDrill,
  muscleSnatch,
  overheadSquat,
  powerClean,
  powerSnatch,
  pushJerk,
  pushPress,
  snatch,
  snatchBalance,
  snatchDeadlift,
  snatchPull,
  splitJerk,
  tallClean,
} from "./gestures";
import { rackPoint } from "./gestures/clean";
import { SIDES } from "./solve";

const moves = (clip: MotionClip, id: string) => clip.phases.filter((phase) => !phase.hold && phase.id === id);
const window = (clip: MotionClip, id: string) => {
  const found = moves(clip, id);
  expect(found.length, `phase « ${id} »`).toBeGreaterThan(0);
  return { from: found[0]!.from, to: found[found.length - 1]!.to };
};
const length = (clip: MotionClip, id: string) =>
  moves(clip, id).reduce((sum, p) => sum + (p.to - p.from), 0) * clip.duration;
const held = (clip: MotionClip, id: string) => {
  const phase = clip.phases.find((candidate) => candidate.hold && candidate.id === id);
  expect(phase, `tenue « ${id} »`).toBeDefined();
  return clip.pose((phase!.from + phase!.to) / 2);
};
const order = (clip: MotionClip) => [...new Set(clip.phases.filter((phase) => !phase.hold).map((phase) => phase.id))];
const samples = (clip: MotionClip, id: string, count = 30) => {
  const { from, to } = window(clip, id);
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / (count + 0.001));
};
const reading = (clip: MotionClip, t: number, joint: string) =>
  measure(clip.pose(t)).find((r) => r.joint === joint)!.value;
// La barre la plus haute pendant une phase.
const peak = (clip: MotionClip, id: string) => Math.max(...samples(clip, id).map((t) => clip.pose(t).bar!.center.y));

describe("haltérophilie : tout le catalogue est écrit à la main", () => {
  it("les vingt gestes de l'ancien fichier ont un geste écrit, avec Malo", () => {
    for (const old of WEIGHTLIFTING) {
      expect(GESTURES[old.key], old.key).toBeDefined();
      expect(GESTURES[old.key]!.athlete, old.key).toBe("poleVault");
    }
  });
});

describe.each([
  ["arraché en puissance", powerSnatch, snatch, "overhead"],
  ["épaulé en puissance", powerClean, clean, "racked"],
  ["arraché en puissance suspension", hangPowerSnatch, snatch, "overhead"],
  ["épaulé en puissance suspension", hangPowerClean, clean, "racked"],
] as const)("%s : la réception en flexion partielle", (_, clip, full, upright) => {
  it("reçoit la barre cuisses au-dessus de l'horizontale, bien plus haut qu'en flexion complète", () => {
    const caught = held(clip, "receive");
    for (const side of SIDES) expect(caught.legs[side].hip.y).toBeGreaterThan(caught.legs[side].knee.y + 10);
    expect(caught.pelvis.y).toBeGreaterThan(held(full, "receive").pelvis.y + 40);
    for (const side of SIDES) expect(caught.legs[side].heel.y).toBeCloseTo(0, 6);
  });

  it("la barre monte plus haut qu'au geste complet, puis redescend à peine jusqu'à la réception", () => {
    expect(peak(clip, "turnover")).toBeGreaterThan(peak(full, "turnover") + 10);
    const drop = peak(clip, "turnover") - held(clip, "receive").bar!.center.y;
    expect(drop).toBeGreaterThan(2);
    expect(drop).toBeLessThan(20);
  });

  it("les pieds se replacent à peine plus écartés qu'au tirage, moins qu'au geste complet", () => {
    const start = clip.pose(0);
    const caught = held(clip, "receive");
    expect(caught.legs.R.ball.z).toBeGreaterThan(start.legs.R.ball.z + 5);
    expect(caught.legs.R.ball.z).toBeLessThan(held(full, "receive").legs.R.ball.z - 5);
  });

  it("la vitesse de la barre culmine à la fin de la seconde tirée, et la seconde tirée est la plus courte", () => {
    const path = barPath(clip, 3000).filter((sample) => sample.t < window(clip, "recovery").from);
    const fastest = path.reduce((a, b) => (b.vy > a.vy ? b : a));
    const { from, to } = window(clip, "second-pull");
    expect(fastest.t).toBeGreaterThan(from);
    expect(fastest.t).toBeLessThanOrEqual(to + 1 / 3000);
    for (const id of ["transition", "turnover"]) expect(length(clip, "second-pull")).toBeLessThan(length(clip, id));
    // Debout à la fin, jambes tendues.
    for (const side of SIDES) expect(held(clip, upright).legs[side].flexion).toBeLessThan(5);
  });

  it("les bras restent tendus jusqu'à l'extension", () => {
    for (const t of samples(clip, "second-pull")) expect(reading(clip, t, "coude R")).toBeLessThan(5);
  });
});

describe.each([
  ["arraché suspension", hangSnatch, "hang"],
  ["épaulé suspension", hangClean, "hang"],
  ["arraché en puissance suspension", hangPowerSnatch, "hang"],
  ["épaulé en puissance suspension", hangPowerClean, "hang"],
] as const)("%s : le départ en suspension", (_, clip, hang) => {
  it("part debout, descend la barre lentement au-dessus des genoux, puis enchaîne la seconde tirée", () => {
    expect(order(clip).slice(0, 4)).toEqual(["hinge", "transition", "second-pull", "turnover"]);
    expect(order(clip)).not.toContain("first-pull");
    const standing = held(clip, "standing");
    for (const side of SIDES) expect(standing.legs[side].flexion).toBeLessThan(5);
    // La descente se contrôle : bien plus longue que la seconde tirée.
    expect(length(clip, "hinge")).toBeGreaterThan(3 * length(clip, "second-pull"));
  });

  it("en suspension : la barre au-dessus des genoux, les genoux peu fléchis, les tibias presque verticaux, les épaules devant la barre", () => {
    const body = held(clip, hang);
    const bar = body.bar!.center;
    expect(bar.y).toBeGreaterThan(body.legs.R.knee.y + 5);
    expect(bar.y).toBeLessThan(body.legs.R.knee.y + 30);
    for (const side of SIDES) {
      expect(body.legs[side].flexion).toBeLessThan(45);
      expect(Math.abs(body.legs[side].knee.x - body.legs[side].ankle.x)).toBeLessThan(20);
    }
    expect(body.arms.R.shoulder.x).toBeGreaterThan(bar.x - 2);
    expect(body.controls.lumbar).toBeLessThanOrEqual(0);
    // La barre glisse le long des cuisses : elle reste devant elles, à quelques centimètres.
    expect(Math.abs(bar.x)).toBeLessThan(18);
  });
});

describe.each([
  ["tirage d'arraché", snatchPull],
  ["tirage d'épaulé", cleanPull],
] as const)("%s", (_, clip) => {
  it("enchaîne les tirées jusqu'à l'extension, la tient, puis repose la barre plus lentement qu'elle n'est montée", () => {
    expect(order(clip)).toEqual(["first-pull", "transition", "second-pull", "return"]);
    const up = length(clip, "first-pull") + length(clip, "transition") + length(clip, "second-pull");
    expect(length(clip, "return")).toBeGreaterThan(1.3 * up);
  });

  it("bras longs sur toute la boucle ; à l'extension, épaules haussées, sur l'avant-pied, jambes tendues", () => {
    for (let i = 0; i < 120; i += 1) expect(reading(clip, i / 120, "coude R")).toBeLessThan(5);
    const top = held(clip, "extension");
    expect(top.controls.shrug).toBe(1);
    for (const side of SIDES) {
      expect(top.legs[side].heel.y).toBeGreaterThan(10);
      expect(top.legs[side].flexion).toBeLessThan(5);
    }
    // La barre ne monte jamais au-dessus des hanches : pas de passage sous la barre.
    for (const sample of barPath(clip, 400)) expect(sample.y).toBeLessThanOrEqual(top.bar!.center.y + 1e-6);
  });
});

describe("soulevé de terre prise d'arraché", () => {
  const clip = snatchDeadlift;
  it("monte lentement, redescend plus lentement encore, par le même chemin", () => {
    expect(order(clip)).toEqual(["lift", "lower"]);
    expect(length(clip, "lift")).toBeGreaterThan(2 * (length(snatchPull, "first-pull") - 400));
    expect(length(clip, "lower")).toBeGreaterThan(length(clip, "lift"));
    const lift = barPath(clip, 600).filter((sample) => sample.phase === "lift");
    expect(Math.max(...lift.map((sample) => sample.vy))).toBeLessThan(250);
  });

  it("talons au sol et bras tendus du début à la fin ; aux genoux, les épaules sont au-dessus de la barre", () => {
    for (let i = 0; i < 120; i += 1) {
      const body = clip.pose(i / 120);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
      expect(reading(clip, i / 120, "coude R")).toBeLessThan(5);
    }
    const knees = clip.pose(clip.stills.find((still) => still.id === "knees")!.t);
    expect(knees.arms.R.shoulder.x).toBeGreaterThanOrEqual(knees.bar!.center.x);
    const standing = held(clip, "standing");
    for (const side of SIDES) expect(standing.legs[side].flexion).toBeLessThan(5);
  });
});

describe("arraché musclé", () => {
  const clip = muscleSnatch;
  it("enchaîne l'extension, le tirage des coudes, le retournement et la poussée, sans repasser en flexion", () => {
    expect(order(clip)).toEqual(["hinge", "extension", "pull", "turnover", "press", "return"]);
    const { from } = window(clip, "pull");
    const { to } = window(clip, "press");
    for (let i = 0; i <= 40; i += 1) {
      const body = clip.pose(from + ((to - from) * i) / 40);
      for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(10);
    }
  });

  it("la barre passe devant le visage, jamais à travers, et finit bras verrouillés au-dessus de la tête", () => {
    for (const sample of barPath(clip, 800)) {
      const body = clip.pose(sample.t);
      if (Math.abs(sample.y - body.head.y) < 15 && sample.phase !== "return")
        expect(sample.x, `t = ${sample.t}`).toBeGreaterThan(body.head.x + 25);
    }
    const top = held(clip, "overhead");
    for (const side of SIDES) expect(top.arms[side].flexion).toBeLessThan(3);
    expect(top.bar!.center.y).toBeGreaterThan(top.head.y + 40);
  });

  it("les pieds ne quittent jamais le sol", () => {
    for (const phase of clip.phases) expect(phase.planted).toEqual(["R", "L"]);
  });
});

describe("épaulé sans élan", () => {
  const clip = tallClean;
  it("part debout, pieds à plat, et se tire sous la barre sans nouvelle poussée des jambes", () => {
    const standing = held(clip, "standing");
    for (const side of SIDES) expect(standing.legs[side].flexion).toBeLessThan(5);
    // Du départ à la réception, le bassin ne fait que descendre et les talons ne montent pas avant l'envol.
    const { from } = window(clip, "pull");
    const { to } = window(clip, "catch");
    let last = Infinity;
    for (let i = 0; i <= 60; i += 1) {
      const body = clip.pose(from + ((to - from) * i) / 60.001);
      expect(body.pelvis.y).toBeLessThanOrEqual(last + 0.05);
      last = body.pelvis.y;
    }
    for (const t of samples(clip, "pull"))
      for (const side of SIDES) expect(clip.pose(t).legs[side].heel.y).toBeCloseTo(0, 6);
  });

  it("les pieds se replacent en l'air, et la barre est reçue sur les épaules en flexion complète", () => {
    expect(moves(clip, "turnover").map((phase) => phase.planted)).toEqual([[]]);
    const caught = held(clip, "receive");
    expect(caught.legs.R.hip.y).toBeLessThan(caught.legs.R.knee.y);
    const rack = rackPoint(caught.controls);
    expect(Math.hypot(caught.bar!.center.x - rack.x, caught.bar!.center.y - rack.y)).toBeLessThan(1e-6);
  });
});

describe("squat bras tendus", () => {
  const clip = overheadSquat;
  it("la barre reste au-dessus du milieu du pied, bras verrouillés", () => {
    for (const sample of barPath(clip, 600)) expect(Math.abs(sample.x), `t = ${sample.t}`).toBeLessThanOrEqual(6);
    for (let i = 0; i < 120; i += 1) expect(clip.pose(i / 120).arms.R.flexion).toBeLessThan(8);
  });

  it("descente lente, remontée plus rapide ; en bas, hanches sous les genoux et talons au sol", () => {
    expect(length(clip, "down")).toBeGreaterThan(1.4 * length(clip, "up"));
    const bottom = held(clip, "bottom");
    for (const side of SIDES) {
      expect(bottom.legs[side].hip.y).toBeLessThan(bottom.legs[side].knee.y);
      expect(bottom.legs[side].heel.y).toBeCloseTo(0, 6);
    }
  });
});

describe("équilibre d'arraché", () => {
  const clip = snatchBalance;
  it("la barre part des trapèzes, derrière la nuque", () => {
    const start = held(clip, "racked");
    expect(start.bar!.center.x).toBeLessThan(start.neck.x - 8);
    expect(start.bar!.center.y).toBeLessThan(start.neck.y);
  });

  it("courte flexion, petite impulsion, puis c'est le corps qui descend sous la barre, pas la barre qui monte", () => {
    expect(order(clip).slice(0, 4)).toEqual(["dip", "drive", "drop", "recovery"]);
    const { from, to } = window(clip, "drop");
    const [before, after] = [clip.pose(from), clip.pose(to - 1e-6)];
    const bodyDrop = before.pelvis.y - after.pelvis.y;
    expect(bodyDrop).toBeGreaterThan(100);
    // La barre bouge bien moins que le corps.
    expect(Math.abs(before.bar!.center.y - after.bar!.center.y)).toBeLessThan(bodyDrop / 2);
    expect(length(clip, "dip")).toBeGreaterThan(length(clip, "drive"));
  });

  it("reçoit en flexion complète bras verrouillés, la barre au-dessus du milieu du pied", () => {
    const caught = held(clip, "receive");
    expect(caught.legs.R.hip.y).toBeLessThan(caught.legs.R.knee.y);
    for (const side of SIDES) expect(caught.arms[side].flexion).toBeLessThan(3);
    expect(Math.abs(caught.bar!.center.x)).toBeLessThan(8);
  });
});

// La barre sur les épaules : l'écart au creux où elle se pose.
const offRack = (clip: MotionClip, t: number) => {
  const body = clip.pose(t);
  const rack = rackPoint(body.controls);
  return Math.hypot(body.bar!.center.x - rack.x, body.bar!.center.y - rack.y);
};

describe.each([
  ["jeté en fente", splitJerk],
  ["jeté poussé", pushJerk],
  ["développé avec impulsion", pushPress],
] as const)("%s : flexion et impulsion", (_, clip) => {
  it("la flexion est verticale, talons au sol, plus lente que l'impulsion ; la barre reste sur les épaules", () => {
    expect(order(clip).slice(0, 2)).toEqual(["dip", "drive"]);
    expect(length(clip, "dip")).toBeGreaterThan(1.5 * length(clip, "drive"));
    for (const t of samples(clip, "dip")) {
      const body = clip.pose(t);
      expect(Math.abs(body.frames.thorax.u.x)).toBeLessThan(0.06);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
      expect(offRack(clip, t)).toBeLessThan(1);
    }
  });

  it("la vitesse de la barre culmine à la fin de l'impulsion, les deux pieds au sol", () => {
    const path = barPath(clip, 3000);
    const { to } = window(clip, "drive");
    const jerk = path.filter((sample) => sample.t >= window(clip, "dip").from && sample.t < to + 0.05);
    const fastest = jerk.reduce((a, b) => (b.vy > a.vy ? b : a));
    expect(fastest.t).toBeGreaterThan(window(clip, "drive").from);
    expect(fastest.t).toBeLessThanOrEqual(to + 1 / 3000);
    for (const phase of [...moves(clip, "dip"), ...moves(clip, "drive")]) expect(phase.planted).toEqual(["R", "L"]);
  });
});

describe("jeté en fente", () => {
  it("en fente : pied avant à plat, pied arrière sur l'avant-pied, bras verrouillés, hanches sous la barre", () => {
    const split = held(splitJerk, "split");
    expect(split.legs.R.heel.y).toBeCloseTo(0, 6);
    expect(split.legs.L.heel.y).toBeGreaterThan(15);
    expect(split.legs.R.ball.x - split.legs.L.ball.x).toBeGreaterThan(140);
    for (const side of SIDES) expect(split.arms[side].flexion).toBeLessThan(3);
    expect(Math.abs(split.bar!.center.x - split.pelvis.x)).toBeLessThan(12);
  });

  it("le pied avant revient d'abord, puis le pied arrière", () => {
    const lifted = moves(splitJerk, "feet-together").map((phase) =>
      SIDES.filter((side) => !phase.planted.includes(side)),
    );
    expect(lifted).toEqual([["R"], ["R"], ["L"], ["L"]]);
  });
});

describe("jeté poussé", () => {
  it("reçoit bras verrouillés, genoux légèrement fléchis, pieds côte à côte un peu plus écartés", () => {
    const caught = held(pushJerk, "receive");
    const set = held(pushJerk, "set");
    for (const side of SIDES) {
      expect(caught.arms[side].flexion).toBeLessThan(3);
      expect(caught.legs[side].flexion).toBeGreaterThan(25);
      expect(caught.legs[side].flexion).toBeLessThan(90);
      expect(caught.legs[side].heel.y).toBeCloseTo(0, 6);
    }
    expect(Math.abs(caught.legs.R.ball.x - caught.legs.L.ball.x)).toBeLessThan(1e-6);
    expect(caught.legs.R.ball.z).toBeGreaterThan(set.legs.R.ball.z + 3);
    expect(caught.legs.R.hip.y).toBeGreaterThan(caught.legs.R.knee.y + 30);
    // Puis il redresse les jambes, la barre au-dessus de la nuque.
    const up = held(pushJerk, "overhead");
    for (const side of SIDES) expect(up.legs[side].flexion).toBeLessThan(5);
    expect(Math.abs(up.bar!.center.x - up.neck.x)).toBeLessThan(10);
  });
});

describe("développé avec impulsion", () => {
  it("aucune seconde flexion : jambes tendues de la fin de l'impulsion au retour, pieds toujours au sol", () => {
    const { to } = window(pushPress, "drive");
    const { to: end } = window(pushPress, "press");
    for (let i = 0; i <= 40; i += 1) {
      const body = pushPress.pose(to + ((end - to) * i) / 40.001);
      for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(10);
    }
    for (const phase of pushPress.phases) expect(phase.planted).toEqual(["R", "L"]);
    for (const side of SIDES) expect(held(pushPress, "overhead").arms[side].flexion).toBeLessThan(3);
  });
});

describe("flexion préparatoire de jeté", () => {
  const clip = jerkDipDrill;
  it("descend, s'arrête, remonte, sans jamais lancer la barre ni lever les talons", () => {
    expect(order(clip)).toEqual(["brace", "dip", "rise", "return"]);
    const set = held(clip, "set");
    for (let i = 0; i < 120; i += 1) {
      const t = i / 120;
      const body = clip.pose(t);
      expect(offRack(clip, t)).toBeLessThan(1);
      expect(body.bar!.center.y).toBeLessThanOrEqual(set.bar!.center.y + 2);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
      expect(Math.abs(body.frames.thorax.u.x)).toBeLessThan(0.06);
    }
    const low = held(clip, "dip");
    expect(set.pelvis.y - low.pelvis.y).toBeGreaterThan(12);
    expect(set.pelvis.y - low.pelvis.y).toBeLessThan(40);
    // La remontée ne lance rien : la barre y va moins vite qu'à l'impulsion d'un jeté.
    const rise = barPath(clip, 1200).filter((sample) => sample.phase === "rise");
    expect(Math.max(...rise.map((sample) => sample.vy))).toBeLessThan(
      Math.max(
        ...barPath(splitJerk, 1200)
          .filter((s) => s.phase === "drive")
          .map((s) => s.vy),
      ),
    );
    expect(barAt(clip, 0).y).toBeCloseTo(set.bar!.center.y, 6);
  });
});
