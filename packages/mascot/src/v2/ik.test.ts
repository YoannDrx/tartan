import { describe, expect, it } from "vitest";
import { FIGURE, HEADS, HEIGHT, LIMITS } from "./body";
import { measure } from "./constraints";
import { liftToReach, span, twoBone } from "./ik";
import { STAND } from "./pose";
import { project } from "./project";
import { SIDES, solve } from "./solve";
import { distance, dot, sub, vec } from "./vec";

describe("morphologie", () => {
  it("le personnage mesure entre 6 et 7 têtes", () => {
    expect(HEADS).toBeGreaterThanOrEqual(6);
    expect(HEADS).toBeLessThanOrEqual(7);
  });

  it("debout, le sommet du crâne est à la taille annoncée, les pieds à plat", () => {
    const body = solve(STAND, { bar: null });
    expect(body.head.y + FIGURE.head).toBeGreaterThan(HEIGHT - 1);
    expect(body.head.y + FIGURE.head).toBeLessThanOrEqual(HEIGHT);
    for (const side of SIDES) {
      expect(body.legs[side].ball.y).toBe(0);
      expect(body.legs[side].heel.y).toBeCloseTo(0, 9);
      expect(body.legs[side].ankle.y).toBeCloseTo(FIGURE.ankle, 9);
    }
  });

  it("debout, toutes les articulations sont dans leurs amplitudes", () => {
    for (const { limit, value } of measure(solve(STAND, { bar: null }))) {
      expect(value).toBeGreaterThanOrEqual(LIMITS[limit][0]);
      expect(value).toBeLessThanOrEqual(LIMITS[limit][1]);
    }
  });
});

describe("cinématique inverse à deux os", () => {
  const root = vec(0, 100, 0);

  it("garde la longueur des deux os et atteint la cible", () => {
    for (const target of [vec(30, 20, 10), vec(-20, 40, 35), vec(5, 160, -15), vec(60, 90, 0)]) {
      const { mid, end } = twoBone(root, target, 60, 52, vec(1, 0, 0));
      expect(distance(root, mid)).toBeCloseTo(60, 6);
      expect(distance(mid, end)).toBeCloseTo(52, 6);
      expect(distance(end, target)).toBeLessThan(1e-6);
    }
  });

  it("plie l'articulation du côté du pôle", () => {
    const target = vec(0, 10, 0);
    for (const pole of [vec(1, 0, 0), vec(-1, 0, 0), vec(0, 0, 1), vec(0.3, 0.4, -1)]) {
      const { mid } = twoBone(root, target, 60, 52, pole);
      expect(dot(sub(mid, root), pole)).toBeGreaterThan(0);
    }
  });

  it("hors de portée, le membre s'arrête tendu sans se retourner", () => {
    const { mid, end, flexion } = twoBone(root, vec(0, -300, 0), 60, 52, vec(1, 0, 0), 2);
    expect(flexion).toBeCloseTo(2, 6);
    expect(distance(root, end)).toBeCloseTo(span(60, 52, 2), 6);
    expect(mid.x).toBeGreaterThan(0);
  });

  it("la flexion va de zéro, membre tendu, à la flexion complète", () => {
    expect(twoBone(root, vec(0, 100 - span(60, 52, 90), 0), 60, 52, vec(1, 0, 0)).flexion).toBeCloseTo(90, 6);
    expect(twoBone(root, vec(0, 100 - span(60, 52, 140), 0), 60, 52, vec(1, 0, 0)).flexion).toBeCloseTo(140, 6);
  });

  it("trouve la hauteur qui met un point à portée, du même côté", () => {
    const [from, to] = [vec(10, 50, 0), vec(0, 0, 20)];
    const lift = liftToReach(from, to, 100)!;
    expect(distance(vec(10, 50 + lift, 0), to)).toBeCloseTo(100, 6);
    expect(50 + lift).toBeGreaterThan(0);
    const below = liftToReach(vec(10, -50, 0), to, 100)!;
    expect(-50 + below).toBeLessThan(0);
    expect(liftToReach(vec(150, 0, 0), to, 100)).toBeNull();
  });
});

describe("résolution du corps", () => {
  it("un pied trop loin fait descendre le bassin, il ne décolle pas", () => {
    const body = solve({ ...STAND, footRZ: 120, footLZ: -120 }, { bar: null });
    expect(body.pelvis.y).toBeLessThan(solve(STAND, { bar: null }).pelvis.y - 20);
    for (const side of SIDES) {
      expect(body.legs[side].ball.y).toBe(0);
      expect(distance(body.legs[side].knee, body.legs[side].ankle)).toBeCloseTo(FIGURE.shin, 6);
      expect(distance(body.legs[side].hip, body.legs[side].knee)).toBeCloseTo(FIGURE.thigh, 6);
    }
  });

  it("les deux mains tiennent la barre, bras tendus : le bassin se règle sur elle", () => {
    const rig = { bar: { grip: 60, hold: "hands" as const } };
    for (const barY of [60, 90, 120]) {
      const body = solve({ ...STAND, pelvisPitch: 40, pelvisX: -40, barX: 10, barY, armsLong: 1 }, rig);
      for (const side of SIDES) {
        expect(distance(body.arms[side].hand, body.bar!.grips[side])).toBeLessThan(1e-6);
        expect(body.arms[side].flexion).toBeLessThan(2);
        expect(distance(body.arms[side].elbow, body.arms[side].wrist)).toBeCloseTo(FIGURE.forearm, 6);
      }
      expect(body.bar!.center.y).toBe(barY);
    }
  });

  it("posée sur le dos, la barre donne la place du bassin et suit le dos", () => {
    const rig = { bar: { grip: 72, hold: "back" as const } };
    const body = solve({ ...STAND, pelvisPitch: 30, barX: 0, barY: 160 }, rig);
    expect(body.bar!.center.x).toBeCloseTo(0, 9);
    expect(body.bar!.center.y).toBeCloseTo(160, 9);
    expect(body.pelvis.x).toBeLessThan(-20);
    // Une barre plus haute que le corps debout : les jambes tendues arrêtent le bassin, la barre reste sur le dos.
    const tall = solve({ ...STAND, barX: 0, barY: 999 }, rig);
    expect(tall.bar!.center.y).toBeLessThan(HEIGHT);
    expect(tall.legs.R.flexion).toBeLessThan(3);
  });

  it("une seule description, deux vues : de face la largeur se voit, de profil elle s'efface", () => {
    const body = solve({ ...STAND, barX: 10, barY: 150, armsLong: 1 }, { bar: { grip: 95, hold: "hands" } });
    const [right, left] = [body.arms.R.hand, body.arms.L.hand];
    expect(Math.abs(project(right, "front").x - project(left, "front").x)).toBeCloseTo(190, 6);
    expect(Math.abs(project(right, "side").x - project(left, "side").x)).toBeCloseTo(0, 6);
    expect(project(right, "side").y).toBeCloseTo(project(right, "front").y, 9);
    // De face, le côté droit de l'athlète est à gauche de l'image.
    expect(project(right, "front").x).toBeLessThan(project(left, "front").x);
  });
});
