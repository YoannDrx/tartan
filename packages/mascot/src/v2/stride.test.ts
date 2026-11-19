// Le générateur de foulée : la cadence, la longueur de pas et la part de vol donnent la durée de la boucle, la
// vitesse du sol, le temps d'appui ; le pied d'appui recule à la vitesse du sol ; le vol suit la gravité ; les
// bras s'opposent aux jambes ; les éducatifs montent le genou ou ramènent le talon.
import { describe, expect, it } from "vitest";
import type { MotionClip } from "./gesture";
import { GESTURES, STRIDE_GESTURES } from "./gestures";
import { GRAVITY } from "./gestures/flight";
import { strideClip } from "./gestures/stride";

const clip = (key: string) => GESTURES[key]!;
const still = (gesture: MotionClip, id: string) => gesture.pose(gesture.stills.find((s) => s.id === id)!.t);

describe.each(STRIDE_GESTURES.map((gesture) => [gesture.key, gesture] as const))("%s : la foulée", (_, gesture) => {
  it("deux pas par boucle, un appui qui recule à la vitesse du sol, au sol", () => {
    expect(gesture.treadmill).toBeGreaterThan(0);
    const stance = gesture.phases.filter((phase) => phase.id === "stance");
    expect(stance).toHaveLength(4);
    for (const phase of stance) {
      expect(phase.planted).toHaveLength(1);
      const side = phase.planted[0]!;
      const [a, b] = [gesture.pose(phase.from + 1e-6), gesture.pose(phase.to - 1e-6)];
      const seconds = ((phase.to - phase.from) * gesture.duration) / 1000;
      expect((a.legs[side].ball.x - b.legs[side].ball.x) / seconds).toBeCloseTo(gesture.treadmill!, 0);
      expect(a.legs[side].ball.y).toBeCloseTo(0, 6);
    }
  });

  it("le vol suit la gravité, et la part de vol est celle annoncée", () => {
    const flight = gesture.phases.filter((phase) => phase.id === "flight" && phase.planted.length === 0);
    const firstRun = flight.filter((phase) => phase.from < 0.5);
    const [from, to] = [firstRun[0]!.from, firstRun.at(-1)!.to];
    const mid = (from + to) / 2;
    const h = (to - from) / 8;
    const y = (t: number) => gesture.pose(t).pelvis.y;
    const acceleration = (y(mid + h) - 2 * y(mid) + y(mid - h)) / ((h * gesture.duration) / 1000) ** 2;
    expect(acceleration / -GRAVITY).toBeGreaterThan(0.7);
    expect(acceleration / -GRAVITY).toBeLessThan(1.3);
  });

  it("les bras s'opposent aux jambes", () => {
    const touch = still(gesture, "right-touch");
    // Le pied droit se pose devant : le bras gauche est devant, le droit derrière.
    expect(touch.arms.L.hand.x).toBeGreaterThan(touch.arms.R.hand.x);
  });
});

describe("générateur de foulée", () => {
  it("la cadence et la longueur de pas donnent la durée de la boucle et la vitesse du sol", () => {
    const run = strideClip({
      key: "essai",
      athlete: "hurdles",
      cadence: 180,
      step: 200,
      flight: 0.4,
      knee: 50,
      heel: 100,
      lean: 6,
      arms: 0.7,
      sink: 8,
    });
    expect(run.duration).toBeCloseTo((2 * 60 * 1000) / 180, 6);
    expect(run.treadmill).toBeCloseTo(200 / (60 / 180), 6);
    const stance = run.phases.filter((phase) => phase.id === "stance").reduce((sum, p) => sum + p.to - p.from, 0);
    expect(stance).toBeCloseTo(0.6, 2);
    expect(run.loop).toBe(true);
  });

  it("un sprint fait des pas plus longs et monte le genou plus haut qu'une course facile", () => {
    const [easy, sprint] = [clip("easy-continuous-run"), clip("flying-sprint")];
    expect(sprint.treadmill!).toBeGreaterThan(1.8 * easy.treadmill!);
    const knee = (gesture: MotionClip) => {
      const body = still(gesture, "right-off");
      return body.legs.L.knee.y - body.legs.L.hip.y;
    };
    expect(knee(sprint)).toBeGreaterThan(knee(easy) + 15);
  });

  it("montées de genoux : la cuisse libre monte à l'horizontale, en avançant à peine", () => {
    const body = still(clip("high-knees"), "right-off");
    expect(body.legs.L.knee.y).toBeGreaterThan(body.legs.L.hip.y - 15);
    expect(clip("high-knees").treadmill!).toBeLessThan(0.4 * clip("easy-continuous-run").treadmill!);
  });

  it("talons-fesses : le talon remonte sous le bassin, le genou reste orienté vers le bas", () => {
    const body = still(clip("butt-kicks"), "right-mid");
    expect(body.legs.L.flexion).toBeGreaterThan(120);
    expect(body.legs.L.knee.y).toBeLessThan(body.legs.L.hip.y - 60);
    expect(body.legs.L.ankle.y).toBeGreaterThan(body.legs.L.knee.y);
  });

  it("foulées bondissantes : le vol dure plus que l'appui", () => {
    const bounds = clip("alternating-bounds");
    const part = (id: string) =>
      bounds.phases.filter((phase) => phase.id === id).reduce((sum, phase) => sum + phase.to - phase.from, 0);
    expect(part("flight")).toBeGreaterThan(part("stance"));
  });
});
