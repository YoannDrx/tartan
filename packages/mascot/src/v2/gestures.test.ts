import { describe, expect, it } from "vitest";
import { EXERCISE_CLIPS } from "../exercises";
import { BARBELL } from "./body";
import { barAt, barPath, inspect, measure, phaseAt } from "./constraints";
import { drawClip, framing } from "./draw-svg";
import type { MotionClip } from "./gesture";
import {
  backSquat,
  clean,
  cleanAndJerk,
  GESTURES,
  lateralLunge,
  OTHER_GESTURES,
  PLYOMETRIC_GESTURES,
  STRIDE_GESTURES,
  snatch,
  STRENGTH_GESTURES,
  WEIGHTLIFTING_GESTURES,
} from "./gestures";
import { STADIUM_GESTURES } from "./gestures/stadium";
import { rackPoint } from "./gestures/clean";
import { GESTURE_VIEWS, project } from "./project";
import { volumes } from "./skin";
import { SIDES } from "./solve";
import { distance } from "./vec";

const clips = Object.values(GESTURES).map((clip) => [clip.key, clip] as const);
// Les gestes d'haltérophilie et de musculation se tiennent sur leurs deux pieds à chaque tenue.
const TWO_FEET = new Set([...WEIGHTLIFTING_GESTURES, ...STRENGTH_GESTURES].map((clip) => clip.key));
const JUMPS = new Set([...PLYOMETRIC_GESTURES, ...STRIDE_GESTURES].map((clip) => clip.key));
const STRIDES = new Set([...STRIDE_GESTURES.map((clip) => clip.key), "cone-high-knees"]);
// Au moins 120 images par boucle ; 240 pour ne pas manquer une phase de moins de 150 ms.
const SAMPLES = 240;
const reports = new Map(clips.map(([key, clip]) => [key, inspect(clip, SAMPLES)]));

const phases = (clip: MotionClip, id: string) => clip.phases.filter((phase) => !phase.hold && phase.id === id);
// La plage d'une phase : du début de son premier tronçon à la fin du dernier.
const window = (clip: MotionClip, id: string) => {
  const found = phases(clip, id);
  expect(found.length, `phase « ${id} »`).toBeGreaterThan(0);
  return { from: found[0]!.from, to: found[found.length - 1]!.to };
};
const held = (clip: MotionClip, id: string) => {
  const phase = clip.phases.find((candidate) => candidate.hold && candidate.id === id)!;
  return clip.pose((phase.from + phase.to) / 2);
};
const reading = (clip: MotionClip, t: number, joint: string) =>
  measure(clip.pose(t)).find((r) => r.joint === joint)!.value;
const length = (clip: MotionClip, id: string) => {
  const { from, to } = window(clip, id);
  return (to - from) * clip.duration;
};

describe("gestes écrits à la main", () => {
  it("couvre l'haltérophilie et la musculation, sous les clés du catalogue", () => {
    expect(Object.keys(GESTURES)).toHaveLength(
      WEIGHTLIFTING_GESTURES.length +
        STRENGTH_GESTURES.length +
        OTHER_GESTURES.length +
        PLYOMETRIC_GESTURES.length +
        STRIDE_GESTURES.length +
        STADIUM_GESTURES.length,
    );
    for (const key of ["snatch", "clean", "clean-and-jerk", "back-squat", "lateral-lunge"])
      expect(GESTURES[key], key).toBeDefined();
    for (const key of Object.keys(GESTURES))
      expect(EXERCISE_CLIPS[key] ?? STADIUM_GESTURES.find((clip) => clip.key === key), key).toBeDefined();
  });

  it("garde les athlètes de chaque famille : Malo en haltérophilie, Mehdi en musculation", () => {
    for (const clip of [snatch, clean, cleanAndJerk, ...WEIGHTLIFTING_GESTURES]) expect(clip.athlete).toBe("poleVault");
    for (const clip of [backSquat, lateralLunge, ...STRENGTH_GESTURES]) expect(clip.athlete).toBe("discus");
  });

  it("ne porte aucun texte : des identifiants pour les positions et les phases, les lignes du guide par leur rang", () => {
    for (const [, clip] of clips) {
      for (const phase of clip.phases) expect(phase.id).toMatch(/^[a-z][a-z0-9-]*$/);
      for (const still of clip.stills) expect(still.id).toMatch(/^[a-z][a-z0-9-]*$/);
      const lines = clip.stills.flatMap((still) => (still.guide === undefined ? [] : [still.guide]));
      expect(lines).toEqual(STADIUM_GESTURES.includes(clip) ? [0, 1, 2] : [0, 1, 2, 3]);
      expect(clip.positions.map((position) => position.guide)).toEqual(lines);
      expect(clip.positions[0]!.from).toBe(0);
      expect(clip.positions.at(-1)!.to).toBe(1);
    }
  });
});

describe.each(clips)("%s : contraintes sur chaque image", (key, clip) => {
  const report = reports.get(key)!;

  it("les amplitudes articulaires sont respectées, sans hyperextension du genou", () => {
    expect(report.limits).toEqual([]);
  });

  it("rien ne passe sous le sol, pieds et disques compris", () => {
    expect(report.ground).toEqual([]);
  });

  it("un pied d'appui ne glisse pas", () => {
    expect(report.feet).toEqual([]);
    // Suspendu à une barre fixe ou en appui sur des barres parallèles, le corps ne touche pas le sol : ce sont les
    // mains qui tiennent (bodyweight.test.ts).
    if (clip.phases.every((phase) => phase.planted.length === 0)) return;
    // Le contrôle porte bien sur des appuis. Un geste d'haltérophilie ou de musculation se tient sur ses deux pieds à
    // chaque tenue et garde au moins un appui sur la plupart des transitions ; un saut, une course ou un geste au sol
    // a au moins une tenue et une transition en appui (ses vols et ses réceptions sur un tapis n'en ont pas).
    const holds = clip.phases.filter((candidate) => candidate.hold);
    const moves = clip.phases.filter((candidate) => !candidate.hold);
    if (TWO_FEET.has(clip.key)) {
      for (const phase of holds) expect(phase.planted).toEqual(["R", "L"]);
      expect(moves.filter((phase) => phase.planted.length > 0).length).toBeGreaterThan(moves.length / 2);
      return;
    }
    if (!clip.treadmill) expect(holds.some((phase) => phase.planted.length > 0)).toBe(true);
    expect(moves.some((phase) => phase.planted.length > 0)).toBe(true);
  });

  it("les deux mains restent sur la barre, à largeur de prise constante, et la barre ne traverse pas la tête", () => {
    expect(report.bar).toEqual([]);
  });

  it("une tenue est immobile", () => {
    expect(report.holds).toEqual([]);
    // Une course sur un sol qui défile ne s'arrête pas : elle n'a pas de tenue.
    if (!clip.treadmill) expect(clip.phases.filter((phase) => phase.hold).length).toBeGreaterThanOrEqual(2);
  });

  it("la boucle se referme", () => {
    // Un geste qui ne boucle pas (un saut à la barre) repart du début d'un coup, une seule fois, à la fin.
    if (!clip.loop) {
      expect(clip.phases.filter((phase) => phase.cut)).toEqual([clip.phases.at(-1)]);
      return;
    }
    expect(report.loop).toEqual([]);
    expect(clip.phases[0]!.from).toBe(0);
    expect(clip.phases[clip.phases.length - 1]!.to).toBeCloseTo(1, 9);
  });

  it("le mouvement est continu : aucune image ne saute", () => {
    // Aucun point du corps ne parcourt plus qu'une fraction de la taille en un trentième de seconde.
    const frames = Math.round(clip.duration / 28);
    let previous = clip.pose(0);
    for (let i = 1; i <= frames; i += 1) {
      const body = clip.pose(i / frames);
      // La coupure d'un geste qui ne boucle pas est un saut voulu : la lecture repart du début.
      if (phaseAt(clip, i / frames).cut || phaseAt(clip, (i - 1) / frames).cut) {
        previous = body;
        continue;
      }
      for (const side of SIDES) {
        // Un saut va vite : le lancer des bras approche six mètres par seconde à la main, et le corps entier se
        // déplace en l'air ; une image y parcourt plus de chemin.
        expect(distance(body.arms[side].hand, previous.arms[side].hand)).toBeLessThan(JUMPS.has(clip.key) ? 42 : 30);
        // Le genou libre d'un sprint passe huit mètres par seconde.
        const knee = STRIDES.has(clip.key) ? 56 : JUMPS.has(clip.key) ? 48 : 36;
        expect(distance(body.legs[side].knee, previous.legs[side].knee)).toBeLessThan(knee);
      }
      previous = body;
    }
  });

  it.each(GESTURE_VIEWS)("vue %s : chaque image se dessine, au-dessus du sol", (view) => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const t = i / SAMPLES;
      const nodes = drawClip(clip, t, view);
      expect(nodes.length).toBeGreaterThan(20);
      for (const node of nodes)
        expect(node.kind === "path" ? node.d : node.kind === "group" ? node.transform : "").not.toMatch(
          /NaN|Infinity|undefined/,
        );
      if (view === "top") continue;
      for (const { c, r } of volumes(clip.pose(t)))
        expect(project(c, view).y + r, `t = ${t}`).toBeLessThanOrEqual(0.01);
    }
    const box = framing(clip, view);
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
  });

  it("la frise montre les positions, dans l'ordre de la boucle", () => {
    expect(clip.stills.length).toBeGreaterThanOrEqual(clip.positions.length);
    const times = clip.stills.map((still) => still.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

// La dynamique d'un tirage d'haltérophilie, commune à l'arraché et à l'épaulé.
const PULL = ["first-pull", "transition", "second-pull", "turnover", "catch", "recovery"];
describe.each([
  ["arraché", snatch, "overhead"],
  ["épaulé", clean, "racked"],
  ["épaulé-jeté", cleanAndJerk, "racked"],
] as const)("%s : le tirage", (_, clip, upright) => {
  const path = barPath(clip, 3000);
  const during = (id: string) => {
    const { from, to } = window(clip, id);
    return path.filter((sample) => sample.t >= from && sample.t < to);
  };

  it("enchaîne les phases dans l'ordre : le passage aux genoux vient avant l'extension", () => {
    const order = [...new Set(clip.phases.filter((phase) => !phase.hold).map((phase) => phase.id))];
    expect(order.slice(0, PULL.length)).toEqual(PULL);
    const ids = clip.stills.map((still) => still.id);
    expect(ids.indexOf("knees")).toBeLessThan(ids.indexOf("extension"));
    expect(ids.indexOf("extension")).toBeLessThan(ids.indexOf("receive"));
  });

  it("la vitesse verticale de la barre culmine à la fin de la seconde tirée, pas pendant la première", () => {
    const { from, to } = window(clip, "second-pull");
    const lift = path.filter((sample) => sample.t < window(clip, "recovery").from);
    const fastest = lift.reduce((a, b) => (b.vy > a.vy ? b : a));
    // Le pic tombe dans la seconde tirée, au plus tard sur sa dernière image : la vitesse est continue, l'image
    // voisine le vaut presque.
    expect(fastest.t).toBeGreaterThan(from);
    expect(fastest.t).toBeLessThanOrEqual(to + 1 / path.length);
    const peak = (id: string) => Math.max(...during(id).map((sample) => sample.vy));
    const top = Math.max(peak("second-pull"), barAt(clip, to - 1e-6).vy);
    expect(top).toBeGreaterThanOrEqual(fastest.vy - 0.5);
    expect(peak("first-pull")).toBeLessThan(0.6 * top);
    for (const id of PULL.filter((phase) => phase !== "second-pull"))
      expect(peak(id), id).toBeLessThanOrEqual(top + 0.5);
    // Après l'extension, la barre ne fait que ralentir jusqu'à son point haut.
    const after = during("turnover");
    for (let i = 1; i < after.length; i += 1)
      expect(after[i]!.vy, `t = ${after[i]!.t}`).toBeLessThanOrEqual(after[i - 1]!.vy + 2);
  });

  it("la barre accélère sans creux marqué du sol à la fin de la seconde tirée", () => {
    const pull = [...during("first-pull"), ...during("transition"), ...during("second-pull")];
    // Un palier en fin de transition est admis : jamais plus de cinq unités par seconde sous la vitesse déjà atteinte.
    let reached = 0;
    for (const sample of pull) {
      expect(sample.vy, `t = ${sample.t}`).toBeGreaterThanOrEqual(reached - 5);
      reached = Math.max(reached, sample.vy);
    }
    expect(reached).toBeGreaterThan(250);
  });

  it("la première tirée est la plus longue, la seconde la plus courte, le passage sous la barre très rapide", () => {
    expect(length(clip, "second-pull")).toBeLessThan(length(clip, "transition"));
    expect(length(clip, "turnover")).toBeLessThan(length(clip, "first-pull") / 2);
    expect(length(clip, "first-pull")).toBeGreaterThan(3 * length(clip, "second-pull"));
    expect(length(clip, "recovery")).toBeGreaterThan(length(clip, "first-pull"));
  });

  it("la barre reste dans une enveloppe autour du milieu du pied, et trace une courbe en S", () => {
    // Le milieu du pied est à x = 0. Dix centimètres valent environ dix-huit unités.
    for (const id of PULL)
      for (const sample of during(id)) expect(Math.abs(sample.x), `${id}, t = ${sample.t}`).toBeLessThanOrEqual(18);
    // Le retour au sol, hors technique, contourne le visage : il reste devant les pieds.
    for (const sample of path) expect(Math.abs(sample.x)).toBeLessThanOrEqual(40);
    const end = (id: string) => during(id).at(-1)!.x;
    expect(end("first-pull")).toBeLessThan(during("first-pull")[0]!.x - 4);
    expect(end("second-pull")).toBeGreaterThan(end("first-pull") + 3);
  });

  it("la barre part du sol, disques posés, et l'athlète finit debout", () => {
    expect(held(clip, "start").bar!.center.y).toBeCloseTo(BARBELL.plate, 6);
    const top = Math.max(...during("turnover").map((sample) => sample.y));
    const caught = held(clip, "receive").bar!.center.y;
    expect(top).toBeGreaterThan(caught + 5);
    const standing = held(clip, upright);
    for (const side of SIDES) expect(standing.legs[side].flexion).toBeLessThan(5);
  });

  it("au départ, les épaules sont à l'aplomb de la barre ou un peu en avant, les hanches au-dessus des genoux, le dos cambré", () => {
    const start = held(clip, "start");
    const ahead = start.arms.R.shoulder.x - start.bar!.center.x;
    expect(ahead).toBeGreaterThanOrEqual(-2);
    expect(ahead).toBeLessThan(25);
    expect(start.legs.R.hip.y).toBeGreaterThan(start.legs.R.knee.y);
    expect(start.controls.lumbar).toBeLessThanOrEqual(0);
  });

  it("les bras restent tendus pendant les deux tirées", () => {
    for (const id of ["first-pull", "transition", "second-pull"]) {
      const { from, to } = window(clip, id);
      for (let i = 0; i <= 20; i += 1) {
        const t = from + ((to - from) * i) / 20.001;
        expect(reading(clip, t, "coude R"), `${id}, t = ${t}`).toBeLessThan(5);
      }
    }
  });

  it("à l'extension, le corps est sur l'avant-pied, genoux tendus ; à la réception, pieds à plat et écartés", () => {
    const { to } = window(clip, "second-pull");
    const extended = clip.pose(to - 1e-6);
    expect(extended.legs.R.heel.y).toBeGreaterThan(10);
    expect(extended.legs.R.ball.y).toBeCloseTo(0, 9);
    expect(extended.legs.R.flexion).toBeLessThan(10);
    const caught = held(clip, "receive");
    for (const side of SIDES) expect(caught.legs[side].heel.y).toBeCloseTo(0, 6);
    expect(caught.legs.R.hip.y).toBeLessThan(caught.legs.R.knee.y);
    expect(caught.legs.R.ball.z).toBeGreaterThan(held(clip, "start").legs.R.ball.z + 10);
  });
});

describe("arraché", () => {
  it("la prise est large, et la barre finit bras tendus au-dessus de la tête", () => {
    expect(snatch.rig.bar!.grip).toBeGreaterThan(1.8 * clean.rig.bar!.grip);
    const caught = held(snatch, "receive");
    for (const side of SIDES) expect(caught.arms[side].flexion).toBeLessThan(3);
    const standing = held(snatch, "overhead");
    expect(standing.bar!.center.y).toBeGreaterThan(standing.head.y + 40);
    const path = barPath(snatch, 1200);
    const { from, to } = window(snatch, "catch");
    const received = path.filter((sample) => sample.t >= from && sample.t < to).at(-1)!;
    expect(received.x).toBeLessThan(barAt(snatch, window(snatch, "second-pull").to - 1e-6).x - 8);
  });
});

// La barre sur les épaules : elle ne « saute » pas, les épaules la rencontrent et l'accompagnent.
describe.each([
  ["épaulé", clean],
  ["épaulé-jeté", cleanAndJerk],
] as const)("%s : la réception sur les épaules", (_, clip) => {
  // L'écart entre la barre et le creux des épaules où elle se pose.
  const offRack = (t: number) => {
    const body = clip.pose(t);
    const rack = rackPoint(body.controls);
    return Math.hypot(body.bar!.center.x - rack.x, body.bar!.center.y - rack.y);
  };

  it("les épaules rencontrent la barre avant le bas du squat, puis elle reste dessus jusqu'à la station debout", () => {
    const catching = phases(clip, "catch");
    expect(catching).toHaveLength(2);
    // La rencontre : la fin du premier tronçon de la réception. Le bassin est encore haut.
    const meeting = catching[0]!.to;
    expect(offRack(meeting - 1e-6)).toBeLessThan(1);
    expect(clip.pose(meeting).pelvis.y).toBeGreaterThan(held(clip, "receive").pelvis.y + 30);
    const { to } = window(clip, "recovery");
    for (let i = 0; i <= 60; i += 1) {
      const t = meeting + ((to - meeting) * i) / 60;
      expect(offRack(t), `t = ${t}`).toBeLessThan(6);
    }
    expect(offRack((clip.phases.find((phase) => phase.hold && phase.id === "racked")!.from + to) / 2)).toBeLessThan(
      1e-6,
    );
  });

  it("entre le point haut et les épaules, la barre ne redescend que de quelques centimètres", () => {
    const path = barPath(clip, 3000);
    const { from, to } = window(clip, "turnover");
    const top = Math.max(...path.filter((sample) => sample.t >= from && sample.t < to).map((sample) => sample.y));
    const met = clip.pose(phases(clip, "catch")[0]!.to).bar!.center.y;
    expect(top - met).toBeGreaterThan(3);
    expect(top - met).toBeLessThan(30);
  });

  it("en réception, coudes hauts vers l'avant, mains un peu à l'extérieur des épaules", () => {
    const caught = held(clip, "receive");
    for (const side of SIDES) {
      const arm = caught.arms[side];
      expect(arm.elbow.x).toBeGreaterThan(arm.shoulder.x + 20);
      expect(arm.elbow.y).toBeGreaterThan(arm.shoulder.y - 25);
      expect(Math.abs(arm.hand.z)).toBeGreaterThan(Math.abs(arm.shoulder.z));
      expect(Math.abs(arm.hand.z)).toBeLessThan(Math.abs(arm.shoulder.z) + 25);
    }
  });

  it("au redressement, hanches et épaules montent ensemble", () => {
    const { from, to } = window(clip, "recovery");
    const lean = (t: number) => clip.pose(t).frames.thorax.u.x;
    const start = lean(from);
    for (let i = 0; i <= 20; i += 1) expect(lean(from + ((to - from) * i) / 20)).toBeLessThanOrEqual(start + 0.05);
  });
});

describe("épaulé-jeté : le jeté", () => {
  const clip = cleanAndJerk;
  const path = barPath(clip, 3000);
  const during = (id: string) => {
    const { from, to } = window(clip, id);
    return path.filter((sample) => sample.t >= from && sample.t < to);
  };

  it("enchaîne l'épaulé, le placement des pieds, la flexion, l'impulsion, la fente, puis le retour des pieds", () => {
    const order = [...new Set(clip.phases.filter((phase) => !phase.hold).map((phase) => phase.id))];
    expect(order).toEqual([...PULL, "adjust", "dip", "drive", "split", "feet-together", "return"]);
  });

  it("la flexion est verticale, talons au sol, et plus lente que l'impulsion", () => {
    expect(length(clip, "dip")).toBeGreaterThan(1.5 * length(clip, "drive"));
    const { from, to } = window(clip, "dip");
    for (let i = 0; i <= 20; i += 1) {
      const body = clip.pose(from + ((to - from) * i) / 20.001);
      expect(Math.abs(body.frames.thorax.u.x)).toBeLessThan(0.06);
      for (const side of SIDES) expect(body.legs[side].heel.y).toBeCloseTo(0, 6);
    }
    const low = clip.pose(to - 1e-6);
    expect(held(clip, "set").pelvis.y - low.pelvis.y).toBeGreaterThan(12);
    expect(held(clip, "set").pelvis.y - low.pelvis.y).toBeLessThan(40);
    expect(low.legs.R.knee.x).toBeGreaterThan(held(clip, "set").legs.R.knee.x + 15);
  });

  it("la vitesse de la barre culmine à la fin de l'impulsion, les deux pieds encore au sol", () => {
    const jerk = path.filter(
      (sample) => sample.t >= window(clip, "dip").from && sample.t < window(clip, "feet-together").from,
    );
    const fastest = jerk.reduce((a, b) => (b.vy > a.vy ? b : a));
    const { from, to } = window(clip, "drive");
    expect(fastest.t).toBeGreaterThan(from);
    expect(fastest.t).toBeLessThanOrEqual(to + 1 / path.length);
    expect(Math.max(...during("dip").map((sample) => sample.vy))).toBeLessThan(0.2 * fastest.vy);
    for (const phase of [...phases(clip, "dip"), ...phases(clip, "drive")]) expect(phase.planted).toEqual(["R", "L"]);
    const driven = clip.pose(to - 1e-6);
    for (const side of SIDES) {
      expect(driven.legs[side].flexion).toBeLessThan(8);
      expect(driven.legs[side].heel.y).toBeGreaterThan(8);
    }
  });

  it("en fente : pied avant à plat, tibia à peu près vertical, pied arrière sur l'avant-pied, genou arrière fléchi", () => {
    const split = held(clip, "split");
    const [front, rear] = [split.legs.R, split.legs.L];
    expect(front.heel.y).toBeCloseTo(0, 6);
    expect(Math.abs(front.knee.x - front.ankle.x)).toBeLessThan(12);
    expect(rear.ball.y).toBeCloseTo(0, 9);
    expect(rear.heel.y).toBeGreaterThan(15);
    expect(rear.flexion).toBeGreaterThan(10);
    expect(rear.flexion).toBeLessThan(50);
    // Une vraie fente, à la largeur d'une position de squat.
    expect(front.ball.x - rear.ball.x).toBeGreaterThan(140);
    expect(front.ball.z - rear.ball.z).toBeGreaterThan(45);
  });

  it("en fente : bras verrouillés, buste vertical, hanches sous la barre, barre un peu en arrière de la tête", () => {
    const split = held(clip, "split");
    for (const side of SIDES) expect(split.arms[side].flexion).toBeLessThan(3);
    expect(Math.abs(split.frames.thorax.u.x)).toBeLessThan(0.06);
    expect(Math.abs(split.bar!.center.x - split.pelvis.x)).toBeLessThan(12);
    expect(split.bar!.center.x).toBeLessThan(split.head.x);
    expect(split.bar!.center.y).toBeGreaterThan(split.head.y + 40);
    // La barre est moins haute qu'à la fin, debout.
    expect(split.bar!.center.y).toBeLessThan(held(clip, "overhead").bar!.center.y - 15);
  });

  it("au retour, le pied avant recule d'abord, puis le pied arrière avance", () => {
    const steps = phases(clip, "feet-together");
    expect(steps).toHaveLength(4);
    const lifted = steps.map((phase) => SIDES.filter((side) => !phase.planted.includes(side)));
    expect(lifted).toEqual([["R"], ["R"], ["L"], ["L"]]);
    const end = held(clip, "overhead");
    expect(Math.abs(end.legs.R.ball.x - end.legs.L.ball.x)).toBeLessThan(1e-6);
    for (const side of SIDES) expect(end.legs[side].heel.y).toBeCloseTo(0, 6);
  });

  it("les pieds décollent pour passer en fente, pas avant", () => {
    const flight = phases(clip, "split");
    expect(flight.map((phase) => phase.planted)).toEqual([[], []]);
    const index = clip.phases.indexOf(flight[0]!);
    expect(clip.phases[index - 1]!.id).toBe("drive");
  });
});

describe("squat arrière", () => {
  const path = barPath(backSquat, 600);

  it("la barre reste à l'aplomb du milieu du pied", () => {
    for (const sample of path) expect(Math.abs(sample.x), `t = ${sample.t}`).toBeLessThanOrEqual(6);
  });

  it("la descente est lente, la remontée plus rapide", () => {
    expect(length(backSquat, "down")).toBeGreaterThan(1.4 * length(backSquat, "up"));
    const down = Math.max(...path.filter((sample) => sample.phase === "down").map((sample) => -sample.vy));
    const up = Math.max(...path.filter((sample) => sample.phase === "up").map((sample) => sample.vy));
    expect(up).toBeGreaterThan(1.3 * down);
  });

  it("en bas, les cuisses passent la parallèle, les talons au sol, les genoux dans l'axe des pointes", () => {
    const bottom = held(backSquat, "bottom");
    for (const side of SIDES) {
      const leg = bottom.legs[side];
      expect(leg.hip.y).toBeLessThan(leg.knee.y);
      expect(leg.heel.y).toBeCloseTo(0, 6);
      // Le genou part dans la direction de la pointe du pied, vers l'extérieur.
      const out = side === "R" ? 1 : -1;
      expect(out * (leg.knee.z - leg.hip.z)).toBeGreaterThan(8);
      expect(out * (leg.toe.z - leg.heel.z)).toBeGreaterThan(8);
    }
  });

  it("les talons ne décollent jamais", () => {
    for (let i = 0; i < SAMPLES; i += 1)
      for (const side of SIDES) expect(backSquat.pose(i / SAMPLES).legs[side].heel.y).toBeCloseTo(0, 6);
  });
});

describe("fente latérale", () => {
  it("en bas : genou fléchi au-dessus du pied, autre jambe tendue, deux pieds à plat, hanches en arrière", () => {
    const low = held(lateralLunge, "lunge");
    const standing = held(lateralLunge, "standing");
    expect(low.legs.R.flexion).toBeGreaterThan(60);
    expect(Math.abs(low.legs.R.knee.z - low.legs.R.ankle.z)).toBeLessThan(10);
    expect(low.legs.L.flexion).toBeLessThan(8);
    for (const side of SIDES) {
      expect(low.legs[side].heel.y).toBeCloseTo(0, 6);
      expect(low.legs[side].ball.y).toBe(0);
    }
    expect(low.pelvis.x).toBeLessThan(standing.pelvis.x - 15);
    expect(low.pelvis.y).toBeLessThan(standing.pelvis.y - 30);
    // Un grand pas : plus large que les épaules, mesuré entre les deux pieds.
    expect(low.legs.R.ball.z - low.legs.L.ball.z).toBeGreaterThan(150);
  });

  it("le pied gauche ne quitte jamais sa place ; le droit ne bouge que décollé du sol", () => {
    const home = lateralLunge.pose(0).legs.L.ball;
    let last = lateralLunge.pose(0).legs.R.ball;
    for (let i = 1; i <= SAMPLES; i += 1) {
      const body = lateralLunge.pose(i / SAMPLES);
      expect(Math.hypot(body.legs.L.ball.x - home.x, body.legs.L.ball.z - home.z)).toBeLessThan(1e-9);
      const moved = Math.hypot(body.legs.R.ball.x - last.x, body.legs.R.ball.z - last.z);
      // Les deux images sont dans le même tronçon, et le pied droit y est en appui.
      const phase = phaseAt(lateralLunge, (i - 1) / SAMPLES);
      if (phase === phaseAt(lateralLunge, i / SAMPLES) && phase.planted.includes("R"))
        expect(moved, phase.id).toBeLessThan(1e-9);
      last = body.legs.R.ball;
    }
  });

  it("le pied droit pousse le sol avant de revenir", () => {
    const push = phases(lateralLunge, "push");
    expect(push).toHaveLength(1);
    expect(push[0]!.planted).toEqual(["R", "L"]);
  });
});

describe("appuis du triple saut", () => {
  it.each([
    ["step-jump-sand", ["R", "RL"]],
    ["short-triple", ["L", "L", "R", "RL"]],
    ["double-hop-step", ["L", "L", "R"]],
    ["triple-rhythm-zones", ["L", "R", "RL"]],
    ["step-switch-stick", ["R"]],
    ["hop-runout", ["L", "L", "R", "L", "R"]],
  ] as const)("%s pose chaque pied dans l’ordre des marques", (key, contacts) => {
    const clip = GESTURES[key]!;
    const landings = clip.phases.filter((phase) => phase.hold && phase.id.startsWith("contact-"));
    expect(landings.map((phase) => phase.planted.join(""))).toEqual(contacts);
  });

  it("garde un appui pendant tout le triple marché et termine sur la quatrième marque", () => {
    const clip = GESTURES["triple-walk"]!;
    expect(clip.phases.filter((phase) => !phase.cut).every((phase) => phase.planted.length > 0)).toBe(true);
    const finish = held(clip, "feet-together");
    expect(finish.legs.L.ball.x).toBeCloseTo(finish.legs.R.ball.x);
    expect(clip.props(0, finish)).toHaveLength(4);
  });
});
