// La dynamique propre des sauts écrits à la main : un vol en parabole sous la gravité, son sommet au milieu du
// vol, des contacts de rebond plus courts que le vol, une réception amortie. Les contraintes communes sont
// vérifiées dans gestures.test.ts.
import { describe, expect, it } from "vitest";
import type { MotionClip, Phase } from "./gesture";
import { GESTURES } from "./gestures";
import { GRAVITY } from "./gestures/flight";
import { SIDES } from "./solve";

const clip = (key: string) => GESTURES[key]!;
// Les vols : des suites de tronçons sans appui, d'un décollage à une réception.
const flights = (gesture: MotionClip) => {
  const runs: { from: number; to: number }[] = [];
  let open: Phase | null = null;
  for (const phase of gesture.phases) {
    const airborne = !phase.hold && !phase.cut && phase.planted.length === 0 && /flight|fall|rise/.test(phase.id);
    if (airborne && !open) open = phase;
    if (!airborne && open) {
      runs.push({ from: open.from, to: phase.from });
      open = null;
    }
  }
  if (open) runs.push({ from: open.from, to: gesture.phases.at(-1)!.to });
  return runs;
};
const pelvisY = (gesture: MotionClip, t: number) => gesture.pose(t).pelvis.y;

describe.each([
  "squat-jump",
  "countermovement-jump",
  "tuck-jump",
  "repeated-vertical-jumps",
  "pogo-jumps",
  "split-jumps",
])("%s : sauts verticaux", (key) => {
  const gesture = clip(key);
  it("chaque vol suit la gravité, et son sommet tombe au milieu du vol", () => {
    const runs = flights(gesture);
    expect(runs.length).toBeGreaterThan(0);
    for (const { from, to } of runs) {
      const seconds = ((to - from) * gesture.duration) / 1000;
      // L'accélération verticale du bassin, au milieu du vol : celle de la pesanteur, à dix pour cent près.
      const h = (to - from) / 10;
      const mid = (from + to) / 2;
      const acceleration =
        (pelvisY(gesture, mid + h) - 2 * pelvisY(gesture, mid) + pelvisY(gesture, mid - h)) /
        ((h * gesture.duration) / 1000) ** 2;
      expect(acceleration / -GRAVITY, `${key} à ${mid}`).toBeGreaterThan(0.85);
      expect(acceleration / -GRAVITY).toBeLessThan(1.15);
      // Le sommet : au milieu du vol, à un dixième près.
      const samples = Array.from({ length: 41 }, (_, i) => from + ((to - from) * i) / 40);
      const top = samples.reduce((a, b) => (pelvisY(gesture, b) > pelvisY(gesture, a) ? b : a));
      expect(Math.abs((top - from) / (to - from) - 0.5)).toBeLessThan(0.12);
      expect(seconds).toBeGreaterThan(0.2);
    }
  });

  it("la réception s'amortit : après le contact, le bassin descend encore et les genoux se plient", () => {
    const touchdown = gesture.phases.find((phase) => phase.id === "landing")!;
    const [first, last] = [gesture.pose(touchdown.from + 1e-6), gesture.pose(touchdown.to - 1e-6)];
    expect(last.pelvis.y).toBeLessThan(first.pelvis.y - 15);
    expect(last.legs.R.flexion).toBeGreaterThan(first.legs.R.flexion + 20);
    // Un pied au moins reste au sol pendant l'amorti.
    expect(touchdown.planted.length).toBeGreaterThan(0);
  });
});

describe.each([
  ["rebonds de cheville", "pogo-jumps", 0.75],
  ["sauts verticaux répétés", "repeated-vertical-jumps", 0.6],
  ["sauts en contrebas", "drop-jump", 0.6],
])("%s : le rebond", (_, key, ratio) => {
  const gesture = clip(key);
  it("le contact entre deux vols est bref, plus court que le vol", () => {
    const contacts = gesture.phases.filter((phase) => phase.id === "contact");
    expect(contacts.length).toBeGreaterThanOrEqual(2);
    const contact = contacts.slice(0, 2).reduce((sum, phase) => sum + phase.to - phase.from, 0) * gesture.duration;
    const flight = flights(gesture).at(-1)!;
    expect(contact).toBeLessThan(ratio * (flight.to - flight.from) * gesture.duration);
    expect(contact).toBeLessThan(260);
    for (const phase of contacts) expect(phase.planted).toEqual(["R", "L"]);
  });
});

describe("rebonds de cheville", () => {
  it("les genoux restent presque tendus, ce sont les chevilles qui travaillent", () => {
    const gesture = clip("pogo-jumps");
    for (const phase of gesture.phases.filter((candidate) => candidate.id === "contact"))
      for (let i = 0; i <= 10; i += 1) {
        const body = gesture.pose(phase.from + ((phase.to - phase.from) * i) / 10);
        for (const side of SIDES) expect(body.legs[side].flexion).toBeLessThan(35);
      }
  });
});

describe("saut depuis squat arrêté", () => {
  it("la position fléchie est tenue, sans rebond, avant de pousser", () => {
    const gesture = clip("squat-jump");
    const holds = gesture.phases.filter((phase) => phase.hold && (phase.id === "set" || phase.id === "steady"));
    expect(holds).toHaveLength(2);
    const push = gesture.phases.find((phase) => phase.id === "push")!;
    let previous = pelvisY(gesture, push.from);
    for (let i = 1; i <= 20; i += 1) {
      const y = pelvisY(gesture, push.from + ((push.to - push.from) * i) / 20);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = y;
    }
  });
});

describe("sauts genoux poitrine", () => {
  it("au sommet, les genoux montent vers la poitrine", () => {
    const gesture = clip("tuck-jump");
    const tuck = gesture.pose(gesture.stills.find((still) => still.id === "tuck")!.t);
    for (const side of SIDES) {
      expect(tuck.legs[side].knee.y).toBeGreaterThan(tuck.pelvis.y - 20);
      expect(tuck.legs[side].flexion).toBeGreaterThan(90);
    }
  });
});

describe("fentes sautées", () => {
  it("les jambes s'inversent en l'air", () => {
    const gesture = clip("split-jumps");
    const before = gesture.pose(gesture.phases.find((phase) => phase.hold && phase.id === "lunge")!.from + 1e-4);
    const after = gesture.pose(gesture.phases.find((phase) => phase.hold && phase.id === "absorb")!.from + 1e-4);
    expect(before.legs.R.ball.x).toBeGreaterThan(before.legs.L.ball.x + 100);
    expect(after.legs.L.ball.x).toBeGreaterThan(after.legs.R.ball.x + 100);
  });
});

describe("saut en longueur sans élan", () => {
  it("un vol vers l'avant de plus d'un mètre et demi, puis la lecture repart d'un coup", () => {
    const gesture = clip("standing-broad-jump");
    expect(gesture.loop).toBe(false);
    const [start, end] = [
      gesture.pose(0.01),
      gesture.pose(gesture.phases.find((phase) => phase.id === "landed")!.from + 1e-4),
    ];
    expect(end.legs.R.ball.x - start.legs.R.ball.x).toBeGreaterThan(280);
  });
});

describe("saut sur boîte", () => {
  it("les deux pieds se posent à plat sur la boîte, puis redescendent un après l'autre", () => {
    const gesture = clip("box-jump");
    const onBox = gesture.pose(gesture.stills.find((still) => still.id === "on-box")!.t);
    for (const side of SIDES) expect(onBox.legs[side].ball.y).toBeGreaterThan(50);
    const down = gesture.phases.filter((phase) => phase.id === "down" && !phase.hold);
    expect(down.some((phase) => phase.planted.length === 1)).toBe(true);
  });
});

describe("sauts en contrebas", () => {
  it("l'athlète se laisse tomber de la boîte sans sauter vers le haut, puis rebondit dans l'axe", () => {
    const gesture = clip("drop-jump");
    const fall = flights(gesture)[0]!;
    const start = pelvisY(gesture, fall.from + 1e-4);
    for (let i = 1; i <= 20; i += 1)
      expect(pelvisY(gesture, fall.from + ((fall.to - fall.from) * i) / 20)).toBeLessThan(start + 3);
    expect(gesture.loop).toBe(false);
  });
});

describe.each(["high-jump-short", "high-jump-full"])("%s", (key) => {
  const gesture = clip(key);
  it("franchit la barre sur le dos, le bassin au-dessus d'elle, puis retombe sur le tapis", () => {
    const clearance = gesture.pose(gesture.stills.find((still) => still.id === "clearance")!.t);
    expect(clearance.pelvis.y).toBeGreaterThan(236);
    // Sur le dos : la poitrine vers le ciel, la tête passée de l'autre côté de la barre.
    expect(clearance.frames.thorax.f.y).toBeGreaterThan(0.5);
    expect(clearance.head.x).toBeGreaterThan(40);
    const landed = gesture.pose(gesture.stills.find((still) => still.id === "landing")!.t);
    expect(landed.pelvis.y).toBeLessThan(110);
    expect(gesture.loop).toBe(false);
  });

  it("le vol suit la gravité, de l'appel au tapis", () => {
    const rise = gesture.phases.filter((phase) => phase.id === "rise");
    const fall = gesture.phases.filter((phase) => phase.id === "fall");
    const [from, to] = [rise[0]!.from, fall.at(-1)!.to];
    const mid = rise.at(-1)!.to;
    const h = (to - from) / 20;
    const acceleration =
      (pelvisY(gesture, mid + h) - 2 * pelvisY(gesture, mid) + pelvisY(gesture, mid - h)) /
      ((h * gesture.duration) / 1000) ** 2;
    expect(acceleration / -GRAVITY).toBeGreaterThan(0.7);
    expect(acceleration / -GRAVITY).toBeLessThan(1.3);
  });
});
