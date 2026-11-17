import { describe, expect, it } from "vitest";
import { EXERCISE_CLIPS } from "../exercises";
import { BARBELL } from "./body";
import { barAt, barPath, inspect, measure, phaseAt } from "./constraints";
import { drawClip, framing } from "./draw-svg";
import type { MotionClip } from "./gesture";
import { backSquat, GESTURES, lateralLunge, snatch } from "./gestures";
import { GESTURE_VIEWS, project } from "./project";
import { volumes } from "./skin";
import { SIDES } from "./solve";

const clips = Object.values(GESTURES).map((clip) => [clip.key, clip] as const);
// Au moins 120 images par boucle ; 240 pour ne pas manquer une phase de moins de 150 ms.
const SAMPLES = 240;
const reports = new Map(clips.map(([key, clip]) => [key, inspect(clip, SAMPLES)]));

const phases = (clip: MotionClip, name: string) => clip.phases.filter((phase) => phase.name === name);
const window = (clip: MotionClip, name: string) => {
  const found = phases(clip, name);
  expect(found.length, `phase « ${name} »`).toBeGreaterThan(0);
  return { from: found[0]!.from, to: found[found.length - 1]!.to };
};
const held = (clip: MotionClip, name: string) => {
  const phase = clip.phases.find((candidate) => candidate.hold && candidate.name.startsWith(name))!;
  return clip.pose((phase.from + phase.to) / 2);
};
const reading = (clip: MotionClip, t: number, joint: string) =>
  measure(clip.pose(t)).find((r) => r.joint === joint)!.value;

describe("prototype des gestes", () => {
  it("couvre les trois gestes du prototype, sous les clés du catalogue", () => {
    expect(Object.keys(GESTURES).sort()).toEqual(["back-squat", "lateral-lunge", "snatch"]);
    for (const key of Object.keys(GESTURES)) expect(EXERCISE_CLIPS[key], key).toBeDefined();
  });

  it("garde les athlètes de chaque famille : Malo en haltérophilie, Mehdi en musculation", () => {
    expect(snatch.athlete).toBe("poleVault");
    expect(backSquat.athlete).toBe("discus");
    expect(lateralLunge.athlete).toBe("discus");
  });
});

describe.each(clips)("%s : contraintes sur chaque image", (key, clip) => {
  const report = reports.get(key)!;

  it("les amplitudes articulaires sont respectées, sans hyperextension du genou ni du coude", () => {
    expect(report.limits).toEqual([]);
  });

  it("rien ne passe sous le sol, pieds et disques compris", () => {
    expect(report.ground).toEqual([]);
  });

  it("un pied d'appui ne glisse pas", () => {
    expect(report.feet).toEqual([]);
    // Le contrôle porte bien sur des appuis : les deux pieds pendant une tenue, au moins un sur la plupart des transitions.
    for (const phase of clip.phases.filter((candidate) => candidate.hold)) expect(phase.planted).toEqual(["R", "L"]);
    const moves = clip.phases.filter((candidate) => !candidate.hold);
    expect(moves.filter((phase) => phase.planted.length > 0).length).toBeGreaterThan(moves.length / 2);
  });

  it("les deux mains restent sur la barre, à largeur de prise constante, et la barre ne traverse pas la tête", () => {
    expect(report.bar).toEqual([]);
  });

  it("une tenue est immobile", () => {
    expect(report.holds).toEqual([]);
    expect(clip.phases.filter((phase) => phase.hold).length).toBeGreaterThanOrEqual(2);
  });

  it("la boucle se referme", () => {
    expect(report.loop).toEqual([]);
    expect(clip.phases[0]!.from).toBe(0);
    expect(clip.phases[clip.phases.length - 1]!.to).toBeCloseTo(1, 9);
  });

  it("le mouvement est continu : aucune image ne saute", () => {
    // À 240 images par boucle, aucun point du corps ne parcourt plus qu'une fraction de la taille entre deux images.
    let previous = clip.pose(0);
    for (let i = 1; i <= SAMPLES; i += 1) {
      const body = clip.pose(i / SAMPLES);
      for (const side of SIDES) {
        expect(
          Math.hypot(
            body.arms[side].hand.x - previous.arms[side].hand.x,
            body.arms[side].hand.y - previous.arms[side].hand.y,
          ),
        ).toBeLessThan(30);
        expect(
          Math.hypot(
            body.legs[side].knee.x - previous.legs[side].knee.x,
            body.legs[side].knee.y - previous.legs[side].knee.y,
          ),
        ).toBeLessThan(30);
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
        expect(node.kind === "path" ? node.d : node.transform).not.toMatch(/NaN|Infinity|undefined/);
      if (view === "top") continue;
      for (const { c, r } of volumes(clip.pose(t)))
        expect(project(c, view).y + r, `t = ${t}`).toBeLessThanOrEqual(0.01);
    }
    const box = framing(clip, view);
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
  });

  it("la frise montre les positions clés, dans l'ordre de la boucle", () => {
    expect(clip.stills.length).toBeGreaterThanOrEqual(4);
    const times = clip.stills.map((still) => still.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const still of clip.stills) expect(still.name.length).toBeGreaterThan(3);
  });
});

describe("arraché", () => {
  const path = barPath(snatch, 2000);
  const during = (name: string) => {
    const { from, to } = window(snatch, name);
    return path.filter((sample) => sample.t >= from && sample.t < to);
  };
  const LIFT = ["Première tirée", "Transition", "Seconde tirée", "Passage sous la barre", "Réception", "Redressement"];

  it("enchaîne les phases dans l'ordre : le passage aux genoux vient avant l'extension", () => {
    const order = snatch.phases.filter((phase) => !phase.hold).map((phase) => phase.name);
    expect([...new Set(order)]).toEqual([...LIFT, "Retour au départ"]);
    const names = snatch.stills.map((still) => still.name);
    expect(names.indexOf("Barre aux genoux")).toBeLessThan(names.indexOf("Extension complète"));
    expect(names.indexOf("Extension complète")).toBeLessThan(names.indexOf("Réception en squat, bras tendus"));
  });

  it("la vitesse verticale de la barre culmine à la fin de la seconde tirée, pas pendant la première", () => {
    const { from, to } = window(snatch, "Seconde tirée");
    const fastest = path.reduce((a, b) => (b.vy > a.vy ? b : a));
    // Le pic tombe sur la dernière image de la seconde tirée : la vitesse est continue, l'image voisine le vaut presque.
    expect(fastest.t).toBeGreaterThan(from);
    expect(fastest.t).toBeLessThanOrEqual(to + 1 / path.length);
    const top = barAt(snatch, to - 1e-6).vy;
    expect(top).toBeGreaterThanOrEqual(fastest.vy - 0.5);
    const peak = (name: string) => Math.max(...during(name).map((sample) => sample.vy));
    expect(peak("Première tirée")).toBeLessThan(0.6 * top);
    for (const name of LIFT.filter((phase) => phase !== "Seconde tirée"))
      expect(peak(name), name).toBeLessThanOrEqual(top + 0.5);
    // Après l'extension, la barre ne fait que ralentir jusqu'à son point haut.
    const after = during("Passage sous la barre");
    for (let i = 1; i < after.length; i += 1)
      expect(after[i]!.vy, `t = ${after[i]!.t}`).toBeLessThanOrEqual(after[i - 1]!.vy + 2);
  });

  it("la barre accélère sans creux marqué du sol à la fin de la seconde tirée", () => {
    const pull = [...during("Première tirée"), ...during("Transition"), ...during("Seconde tirée")];
    // Un palier en fin de transition est admis : jamais plus de cinq unités par seconde sous la vitesse déjà atteinte.
    let reached = 0;
    for (const sample of pull) {
      expect(sample.vy, `t = ${sample.t}`).toBeGreaterThanOrEqual(reached - 5);
      reached = Math.max(reached, sample.vy);
    }
    expect(reached).toBeGreaterThan(300);
  });

  it("le passage sous la barre est la phase la plus courte après la seconde tirée, la première tirée la plus longue", () => {
    const length = (name: string) => {
      const { from, to } = window(snatch, name);
      return (to - from) * snatch.duration;
    };
    expect(length("Seconde tirée")).toBeLessThan(length("Transition"));
    expect(length("Passage sous la barre")).toBeLessThan(length("Première tirée") / 2);
    expect(length("Première tirée")).toBeGreaterThan(3 * length("Seconde tirée"));
    expect(length("Redressement")).toBeGreaterThan(length("Première tirée"));
  });

  it("la barre reste dans une enveloppe autour du milieu du pied, et trace une courbe en S", () => {
    // Le milieu du pied est à x = 0. Dix centimètres valent environ dix-huit unités.
    for (const name of LIFT)
      for (const sample of during(name)) expect(Math.abs(sample.x), `${name}, t = ${sample.t}`).toBeLessThanOrEqual(18);
    // Le retour au sol, hors technique, contourne le visage : il reste devant les pieds.
    for (const sample of path) expect(Math.abs(sample.x)).toBeLessThanOrEqual(40);
    const end = (name: string) => during(name).at(-1)!.x;
    const start = during("Première tirée")[0]!.x;
    expect(end("Première tirée")).toBeLessThan(start - 4);
    expect(end("Seconde tirée")).toBeGreaterThan(end("Première tirée") + 3);
    expect(end("Réception")).toBeLessThan(end("Seconde tirée") - 8);
  });

  it("la barre part du sol, disques posés, monte au-dessus de la tête, puis redescend un peu vers la réception", () => {
    const start = held(snatch, "Départ");
    expect(start.bar!.center.y).toBeCloseTo(BARBELL.plate, 6);
    const top = Math.max(...during("Passage sous la barre").map((sample) => sample.y));
    const caught = held(snatch, "Réception").bar!.center.y;
    expect(top - caught).toBeGreaterThan(5);
    expect(top - caught).toBeLessThan(30);
    const standing = held(snatch, "Debout");
    expect(standing.bar!.center.y).toBeGreaterThan(standing.head.y + 40);
  });

  it("au départ, les épaules sont à l'aplomb de la barre ou un peu en avant, les hanches au-dessus des genoux", () => {
    const start = held(snatch, "Départ");
    const ahead = start.arms.R.shoulder.x - start.bar!.center.x;
    expect(ahead).toBeGreaterThanOrEqual(-2);
    expect(ahead).toBeLessThan(25);
    expect(start.legs.R.hip.y).toBeGreaterThan(start.legs.R.knee.y);
    expect(start.controls.lumbar).toBeLessThanOrEqual(0);
  });

  it("les bras restent tendus pendant les deux tirées", () => {
    for (const name of ["Première tirée", "Transition", "Seconde tirée"]) {
      const { from, to } = window(snatch, name);
      for (let i = 0; i <= 20; i += 1) {
        const t = from + ((to - from) * i) / 20.001;
        expect(reading(snatch, t, "coude R"), `${name}, t = ${t}`).toBeLessThan(5);
      }
    }
  });

  it("à l'extension, le corps est sur l'avant-pied, genoux tendus ; à la réception, pieds à plat et bras tendus", () => {
    const { to } = window(snatch, "Seconde tirée");
    const extended = snatch.pose(to - 1e-6);
    expect(extended.legs.R.heel.y).toBeGreaterThan(10);
    expect(extended.legs.R.ball.y).toBe(0);
    expect(extended.legs.R.flexion).toBeLessThan(10);
    const caught = held(snatch, "Réception");
    for (const side of SIDES) {
      expect(caught.legs[side].heel.y).toBeCloseTo(0, 6);
      expect(caught.arms[side].flexion).toBeLessThan(3);
    }
    expect(caught.legs.R.hip.y).toBeLessThan(caught.legs.R.knee.y);
    // Les pieds se sont écartés entre le tirage et la réception.
    expect(caught.legs.R.ball.z).toBeGreaterThan(held(snatch, "Départ").legs.R.ball.z + 10);
  });
});

describe("squat arrière", () => {
  const path = barPath(backSquat, 600);

  it("la barre reste à l'aplomb du milieu du pied", () => {
    for (const sample of path) expect(Math.abs(sample.x), `t = ${sample.t}`).toBeLessThanOrEqual(6);
  });

  it("la descente est lente, la remontée plus rapide", () => {
    const length = (name: string) => {
      const { from, to } = window(backSquat, name);
      return (to - from) * backSquat.duration;
    };
    expect(length("Descente")).toBeGreaterThan(1.4 * length("Remontée"));
    const down = Math.max(...path.filter((sample) => sample.phase === "Descente").map((sample) => -sample.vy));
    const up = Math.max(...path.filter((sample) => sample.phase === "Remontée").map((sample) => sample.vy));
    expect(up).toBeGreaterThan(1.3 * down);
  });

  it("en bas, les cuisses passent la parallèle, les talons au sol, les genoux dans l'axe des pointes", () => {
    const bottom = held(backSquat, "Position basse");
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
    const low = held(lateralLunge, "Fente");
    const standing = held(lateralLunge, "Debout");
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
        expect(moved, phase.name).toBeLessThan(1e-9);
      last = body.legs.R.ball;
    }
  });

  it("le pied droit pousse le sol avant de revenir", () => {
    const push = phases(lateralLunge, "Poussée");
    expect(push).toHaveLength(1);
    expect(push[0]!.planted).toEqual(["R", "L"]);
  });
});
