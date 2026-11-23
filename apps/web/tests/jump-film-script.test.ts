import { athletePaint, colorDistance, DISTINCT, SURFACES } from "@tartan/design-tokens/athletes";
import { jointPositions } from "@tartan/mascot/skeleton";
import { describe, expect, it } from "vitest";
import {
  BEAT_AT,
  FILM,
  FILM_STILL,
  frameAt,
  GROUND,
  highJumpTime,
  poseAt,
  T,
  WORLD_AT,
  WORLD_SURFACE,
} from "@/features/landing/jump-film-pose";

const STEPS = 1500;
const times = Array.from({ length: STEPS + 1 }, (_, index) => index / STEPS);

// Depuis le 23 novembre 2026, le film ne joue plus qu'un geste : le saut en hauteur (demande du fondateur).
describe("le film du saut", () => {
  it("accompagne chaque promesse d'une phase du saut, puis valide la séance", () => {
    // Le titre de la page, puis l'élan, l'appel, le franchissement, la validation et la conclusion.
    expect(times.map(BEAT_AT).filter((beat, index, all) => beat !== all[index - 1])).toEqual([0, 1, 2, 3, 4, 5]);
    expect([0, FILM.start, FILM.plant, FILM.flight, FILM.impact, FILM.finish].map(BEAT_AT)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(highJumpTime(FILM.plant)).toBeCloseTo(T.runEnd, 12);
    expect(highJumpTime(FILM.flight)).toBeCloseTo(T.takeoff, 12);
  });

  it("ouvre sur l'athlète debout, au calme, et finit les bras en l'air", () => {
    const start = frameAt(0);
    expect(start).toMatchObject({ face: "neutral", running: false });
    expect(frameAt(FILM.start * 0.5).pose).toEqual(start.pose);
    const end = frameAt(1);
    expect(end).toMatchObject({ face: "joy", running: false });
    const joints = jointPositions(end.pose, end.pose);
    expect(joints.handA.y).toBeLessThan(joints.head.y);
  });

  it("ne saute pas d'une image à la suivante", () => {
    let previous = frameAt(0);
    for (const t of times.slice(1)) {
      const next = frameAt(t);
      expect(Math.hypot(next.pose.x - previous.pose.x, next.pose.y - previous.pose.y), `t = ${t}`).toBeLessThan(14);
      previous = next;
    }
  });

  it("garde l'athlète au-dessus de la piste du film", () => {
    for (const t of times) {
      const { pose } = frameAt(t);
      const joints = jointPositions(pose, pose);
      expect(Math.max(joints.footA.y, joints.footB.y), `t = ${t}`).toBeLessThan(GROUND + 2);
    }
  });

  it("joue le saut de bout en bout, sur ses propres seuils", () => {
    let previous = highJumpTime(0);
    for (const t of times) {
      const now = highJumpTime(t);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
    expect(highJumpTime(FILM.impact)).toBeCloseTo(T.impact, 12);
    expect(highJumpTime(FILM.finish)).toBeCloseTo(T.finish, 12);
    expect(highJumpTime(1)).toBe(1);
    // L'image fixe du film, sans mouvement, est l'apex du saut.
    expect(highJumpTime(FILM_STILL)).toBeCloseTo(T.apex, 12);
    expect(frameAt(FILM_STILL).pose).toEqual(poseAt(highJumpTime(FILM_STILL)));
  });

  it("habille l'athlète pour chaque monde qu'il traverse", () => {
    const worlds = new Set(times.map(WORLD_AT));
    expect([...worlds].sort()).toEqual(["coche", "couloir", "craie", "nuit", "piste"]);
    for (const world of worlds) {
      const surface = WORLD_SURFACE[world];
      const paint = athletePaint("highJump", surface);
      for (const part of ["skin", "hair", "tee", "shorts", "shoe"] as const) {
        expect(colorDistance(paint[part], SURFACES[surface]), `${world} ${part}`).toBeGreaterThanOrEqual(DISTINCT);
      }
    }
  });
});
