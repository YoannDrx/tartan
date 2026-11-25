import { describe, expect, it } from "vitest";
import { EXERCISE_CLIPS } from "../exercises";
import { inspect, type Report } from "./constraints";
import { HEIGHT } from "./body";
import { BODY_WINDOW, drawClip, framing, staged } from "./draw-svg";
import { STADIUM_GESTURES } from "./gestures/stadium";
import { GESTURES } from "./gestures";
import { liftClip } from "./lift-v1";
import { GESTURE_KEYS, gestureClip, gestureEntry } from "./registry";
import { SIDES } from "./solve";

const entries = GESTURE_KEYS.map((key) => gestureEntry(key)!);
// 120 images par boucle : le crible de tout le registre.
const SAMPLES = 120;
const broken = new Map(
  entries.map((entry) => {
    const report = inspect(entry.clip, SAMPLES);
    return [entry.key, (Object.keys(report) as (keyof Report)[]).filter((name) => report[name].length > 0)] as const;
  }),
);

describe("registre des gestes", () => {
  it("donne un geste à chacune des clés historiques et aux huit gestes du stade", () => {
    expect(GESTURE_KEYS).toHaveLength(173 + 8);
    expect(new Set(GESTURE_KEYS)).toEqual(
      new Set([...Object.keys(EXERCISE_CLIPS), ...STADIUM_GESTURES.map((c) => c.key)]),
    );
    expect(entries.every((entry) => entry.clip.key === entry.key)).toBe(true);
    expect(gestureClip("snatch")).toBe(GESTURES.snatch);
    expect(gestureClip("inconnu")).toBeNull();
    expect(gestureClip(null)).toBeNull();
  });

  it("distingue les gestes écrits à la main des gestes relevés", () => {
    const written = entries.filter((entry) => entry.level === "ecrit").map((entry) => entry.key);
    expect(written.sort()).toEqual(Object.keys(GESTURES).sort());
    expect(entries.filter((entry) => entry.level === "releve")).toHaveLength(GESTURE_KEYS.length - written.length);
  });

  it("chaque geste se lit sous deux vues au moins, la sienne d'abord", () => {
    for (const entry of entries) {
      expect(entry.views.length, entry.key).toBeGreaterThanOrEqual(2);
      expect(entry.views[0], entry.key).toBe(entry.native);
      expect(new Set(entry.views).size).toBe(entry.views.length);
    }
    // Les gestes dessinés de face par l'ancien moteur le restent ; un geste au sol se lit de dessus, pas de face.
    expect(gestureEntry("jumping-jacks")!.native).toBe("front");
    expect(gestureEntry("prone-hip-rotation")!.native).toBe("top");
    expect(gestureEntry("push-up")!.views).toEqual(["side", "top"]);
    expect(gestureEntry("romanian-deadlift")!.views).toEqual(["side", "front"]);
  });

  it("un geste relevé garde l'athlète, la durée et les quatre positions du guide de l'ancien geste", () => {
    for (const entry of entries.filter((candidate) => candidate.level === "releve")) {
      const old = EXERCISE_CLIPS[entry.key]!;
      expect(entry.clip.athlete, entry.key).toBe(old.athlete);
      expect(Math.abs(entry.clip.duration - old.duration), entry.key).toBeLessThan(old.duration * 0.01);
      expect(entry.clip.loop, entry.key).toBe(old.loop);
      const lines = entry.clip.stills.flatMap((still) => (still.guide === undefined ? [] : [still.guide]));
      expect(lines, entry.key).toEqual([0, 1, 2, 3]);
    }
  });
});

describe("contraintes sur tout le registre", () => {
  // Depuis que les derniers gestes à reprendre sont écrits à la main, aucun geste n'a d'exception : un geste
  // relevé qui violerait une contrainte se réécrit à la main, il ne repasse pas sur l'ancien moteur.
  it.each(entries.map((entry) => [entry.key, entry] as const))("%s : respecte toutes les contraintes", (key) => {
    expect(broken.get(key)).toEqual([]);
  });

  it("tous les gestes enregistrés respectent les contraintes", () => {
    expect([...broken.values()].filter((constraints) => constraints.length === 0)).toHaveLength(entries.length);
  });

  it.each(entries.map((entry) => [entry.key, entry] as const))("%s : chaque vue se dessine", (_, entry) => {
    for (const view of entry.views) {
      for (let i = 0; i < 24; i += 1) {
        const nodes = drawClip(entry.clip, i / 24, view);
        expect(nodes.length).toBeGreaterThan(20);
        for (const node of nodes) {
          const text =
            node.kind === "path" ? node.d : node.kind === "group" ? node.transform : JSON.stringify(node.geometry);
          expect(text).not.toMatch(/NaN|Infinity|undefined|null/);
        }
      }
      const box = framing(entry.clip, view);
      for (const value of Object.values(box)) expect(Number.isFinite(value)).toBe(true);
      expect(box.width).toBeGreaterThan(60);
      expect(box.height).toBeGreaterThan(40);
      expect(box.width).toBeLessThan(3000);
    }
  });
});

describe("cadrage des scènes", () => {
  // La scène d'un écran : le cadre du geste élargi au format 3:2, avec les réglages de l'écran (exercise-scene.tsx).
  it.each(entries.flatMap((entry) => entry.views.map((view) => [entry.key, view, entry] as const)))(
    "%s, vue %s : un athlète debout occupe au moins 60 % de la hauteur de la scène 3:2",
    (_, view, entry) => {
      const box = staged(framing(entry.clip, view, 14, 32), view);
      expect(HEIGHT / box.height).toBeGreaterThanOrEqual(0.6);
    },
  );

  it("un élan ou un objet lancé loin ne rapetisse pas l'athlète : le cadre suit le corps, l'objet sort de l'image", () => {
    for (const key of ["high-jump-full", "medicine-ball-forward", "medicine-ball-rotation"]) {
      const box = framing(gestureEntry(key)!.clip, "side", 14, 32);
      expect(box.width, key).toBeLessThanOrEqual(BODY_WINDOW + 2 * 0.3 * HEIGHT + 30);
    }
  });
});

describe("relèvement d'un geste de l'ancien moteur", () => {
  const lift = (key: string) => liftClip(EXERCISE_CLIPS[key]!);

  it("une barre tenue devient une vraie barre, à deux mains : sur le dos, en prise d'épaulé, en prise large", () => {
    expect(lift("front-squat").rig.bar).toEqual({ grip: 58, hold: "hands" });
    expect(lift("deadlift").rig.bar).toEqual({ grip: 58, hold: "hands" });
    expect(lift("good-morning").rig.bar).toEqual({ grip: 72, hold: "back" });
    expect(lift("power-snatch").rig.bar).toEqual({ grip: 102, hold: "hands" });
    expect(lift("push-up").rig.bar).toBeNull();
    expect(lift("pull-up").rig.bar).toBeNull();
  });

  it("au soulevé de terre, les disques restent sur le sol au départ et les deux mains sur la barre", () => {
    const clip = lift("deadlift");
    const start = clip.pose(0);
    expect(start.bar!.center.y).toBeGreaterThanOrEqual(41 - 1e-6);
    for (let i = 0; i < 60; i += 1) {
      const body = clip.pose(i / 60);
      for (const side of SIDES) {
        const { hand } = body.arms[side];
        const grip = body.bar!.grips[side];
        expect(Math.hypot(hand.x - grip.x, hand.y - grip.y, hand.z - grip.z)).toBeLessThan(0.01);
      }
    }
  });

  it("au squat, le pied que l'ancien geste tenait fixe reste planté toute la boucle ; en bas, les deux le sont", () => {
    const clip = lift("front-squat");
    for (const phase of clip.phases) expect(phase.planted, phase.id).toContain("R");
    // Debout, l'ancien geste décale un pied : il ne compte comme appui que là où il touche vraiment le sol.
    expect(clip.phases.filter((phase) => phase.planted.length === 2).length).toBeGreaterThanOrEqual(3);
    const body = clip.pose(0.4);
    expect(body.legs.R.ball.z).toBeGreaterThan(20);
    expect(body.legs.L.ball.z).toBeCloseTo(-body.legs.R.ball.z, 6);
    expect(body.legs.R.ball.x).toBeCloseTo(body.legs.L.ball.x, 6);
    expect(body.legs.R.toe.z).toBeGreaterThan(body.legs.R.heel.z + 5);
  });

  it("à la traction, les mains tiennent la barre fixe et le corps monte", () => {
    const clip = lift("pull-up");
    const hands = Array.from({ length: 40 }, (_, i) => clip.pose(i / 40).arms.R.hand);
    for (const hand of hands) expect(Math.hypot(hand.x - hands[0]!.x, hand.y - hands[0]!.y)).toBeLessThan(0.5);
    const heights = Array.from({ length: 40 }, (_, i) => clip.pose(i / 40).pelvis.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(40);
  });

  it("le matériel suit : un banc posé, des haltères dans les deux mains, des repères qui défilent", () => {
    const bench = lift("bench-press");
    expect(bench.props(0, bench.pose(0)).some((prop) => prop.paint === "bench" && !prop.scroll)).toBe(true);
    const curl = lift("biceps-curl");
    const body = curl.pose(0.3);
    const bells = curl.props(0.3, body).filter((prop) => prop.shape.kind === "disc");
    expect(bells).toHaveLength(2);
    expect(bells.map((prop) => Math.sign(prop.at)).sort()).toEqual([-1, 1]);
    const run = lift("easy-continuous-run");
    expect(run.props(0.2, run.pose(0.2)).some((prop) => prop.scroll)).toBe(true);
  });

  it("un genou relevé ne se plie jamais à l'envers, même quand l'ancien geste le tendait trop", () => {
    for (const key of ["squat-jump", "bulgarian-squat", "step-up", "single-leg-rdl"]) {
      const report = inspect(lift(key), SAMPLES);
      expect(
        report.limits.filter((line) => line.startsWith("genou")),
        key,
      ).toEqual([]);
    }
  });

  it("un geste qui ne boucle pas repart du début d'un coup", () => {
    const clip = lift("high-jump-full");
    expect(clip.loop).toBe(false);
    expect(clip.phases.filter((phase) => phase.cut)).toHaveLength(1);
    expect(clip.phases.at(-1)!.cut).toBe(true);
  });
});
