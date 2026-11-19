import { describe, expect, it } from "vitest";
// Les courbes portent les noms des jetons de mouvement. Le paquet des jetons dépend de celui-ci : le test lit donc
// la table par son chemin, sans dépendance en retour.
import { motion } from "../../../design-tokens/src/motion";
import { timeline, type Curve, type TimedKey } from "./timeline";

type Key = TimedKey<"v">;
const key = (v: number, hold: number, ms: number, curve: Curve): Key => ({ value: { v }, hold, move: { ms, curve } });

// Une montée en trois temps, puis un retour : tenue à 0, traversées à 10 et 60, tenue à 100.
// La première transition est lente (300 ms pour 10), la deuxième rapide (100 ms pour 50), la troisième freine.
const climb = (first: Curve, second: Curve, third: Curve) =>
  timeline([key(0, 200, 400, "impulsion"), key(10, 0, 300, first), key(60, 0, 100, second), key(100, 200, 200, third)]);

const speedAt = (track: ReturnType<typeof climb>, ms: number) => {
  const step = 0.01;
  return (track.sample((ms + step) / track.duration).v - track.sample((ms - step) / track.duration).v) / (2 * step);
};

describe("le temps d'un geste", () => {
  it("les courbes portent les noms des jetons de mouvement", () => {
    const curves: Curve[] = ["elan", "impulsion", "reception", "linear"];
    for (const name of Object.keys(motion.easing)) expect(curves).toContain(name);
  });

  it("la durée de la boucle additionne les tenues et les transitions", () => {
    const track = climb("elan", "linear", "reception");
    expect(track.duration).toBe(200 + 300 + 100 + 200 + 200 + 400);
    expect(track.spans.map((span) => span.kind)).toEqual(["hold", "move", "move", "move", "hold", "move"]);
    expect(track.spanAt(0.5 / track.duration).kind).toBe("hold");
    expect(track.spanAt(250 / track.duration)).toMatchObject({ kind: "move", key: 1 });
  });

  it("une tenue est vraiment immobile", () => {
    const track = climb("elan", "linear", "reception");
    for (let ms = 0; ms < 200; ms += 7) expect(track.sample(ms / track.duration).v).toBe(0);
    for (let ms = 800; ms < 1000; ms += 7) expect(track.sample(ms / track.duration).v).toBe(100);
  });

  it("le corps part d'une tenue et y arrive sans vitesse", () => {
    const track = climb("elan", "linear", "reception");
    expect(Math.abs(speedAt(track, 200.02))).toBeLessThan(0.001);
    expect(Math.abs(speedAt(track, 799.98))).toBeLessThan(0.001);
  });

  it("une traversée se passe sans arrêt ni à-coup : la vitesse est la même des deux côtés", () => {
    const track = climb("elan", "linear", "reception");
    for (const ms of [500, 600]) {
      const [before, after] = [speedAt(track, ms - 0.02), speedAt(track, ms + 0.02)];
      expect(before).toBeGreaterThan(0.01);
      expect(Math.abs(before - after) / before).toBeLessThan(0.02);
    }
  });

  it("une transition courte est rapide : la durée fait la dynamique", () => {
    const track = climb("linear", "linear", "linear");
    const fastest = (from: number, to: number) =>
      Math.max(...Array.from({ length: 50 }, (_, i) => speedAt(track, from + ((to - from) * (i + 0.5)) / 50)));
    expect(fastest(500, 600)).toBeGreaterThan(5 * fastest(200, 500));
  });

  it("l'élan prend de la vitesse jusqu'à la clé, la réception en perd jusqu'à l'arrêt", () => {
    const track = climb("elan", "linear", "reception");
    const rising = [220, 300, 400, 480, 499].map((ms) => speedAt(track, ms));
    expect(rising).toEqual([...rising].sort((a, b) => a - b));
    const falling = [601, 640, 700, 760, 799].map((ms) => speedAt(track, ms));
    expect(falling).toEqual([...falling].sort((a, b) => b - a));
  });

  it("l'élan arrive plus vite sur la clé qu'une transition neutre, la réception y entre plus vite", () => {
    // Des transitions de vitesses voisines : la courbe a de la marge avant la borne de monotonie.
    const even = (first: Curve, third: Curve) =>
      timeline([
        key(0, 200, 400, "impulsion"),
        key(30, 0, 300, first),
        key(45, 0, 100, "linear"),
        key(100, 200, 200, third),
      ]);
    const neutral = even("linear", "linear");
    expect(speedAt(even("elan", "linear"), 500)).toBeGreaterThan(1.2 * speedAt(neutral, 500));
    expect(speedAt(even("linear", "reception"), 600)).toBeGreaterThan(1.2 * speedAt(neutral, 600));
  });

  it("l'impulsion part de l'arrêt et y revient, même entre deux traversées", () => {
    const track = climb("impulsion", "impulsion", "impulsion");
    for (const ms of [500, 600]) expect(Math.abs(speedAt(track, ms))).toBeLessThan(0.001);
  });

  it("aucune valeur ne dépasse ses clés : pas de rebond", () => {
    const sets: [Curve, Curve, Curve][] = [
      ["elan", "linear", "reception"],
      ["linear", "elan", "impulsion"],
      ["reception", "elan", "linear"],
      ["elan", "elan", "reception"],
    ];
    for (const [first, second, third] of sets) {
      const track = climb(first, second, third);
      let last = -Infinity;
      for (let ms = 200; ms <= 800; ms += 1) {
        const { v } = track.sample(ms / track.duration);
        expect(v).toBeGreaterThanOrEqual(last - 1e-9);
        expect(v).toBeLessThanOrEqual(100 + 1e-9);
        last = v;
      }
    }
  });

  it("la boucle se referme sur la première clé", () => {
    const track = climb("elan", "linear", "reception");
    expect(track.sample(1 - 1e-9).v).toBeCloseTo(0, 6);
    expect(track.sample(1).v).toBe(0);
    expect(track.sample(1.25).v).toBe(track.sample(0.25).v);
  });
});
