import { athletePaint, colorDistance, DISTINCT, SURFACES } from "@tartan/design-tokens/athletes";
import { POLE_VAULT } from "@tartan/mascot/pole-vault";
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
  sceneAt,
  sceneProps,
  SCENES,
  T,
  WORLD_AT,
  WORLD_SURFACE,
} from "@/features/landing/jump-film-pose";

const STEPS = 1500;
const times = Array.from({ length: STEPS + 1 }, (_, index) => index / STEPS);

describe("le relais du film", () => {
  it("fait courir trois athlètes l'un après l'autre, chacun pour une promesse", () => {
    expect(SCENES.map((scene) => scene.athlete)).toEqual(["hurdles", "poleVault", "highJump"]);
    const order = times.map(sceneAt).filter((scene, index, all) => scene !== all[index - 1]);
    expect(order).toEqual(["hurdles", "poleVault", "highJump"]);
    // Le titre de la page, puis une promesse par athlète, la validation et la conclusion.
    expect(times.map(BEAT_AT).filter((beat, index, all) => beat !== all[index - 1])).toEqual([0, 1, 2, 3, 4, 5]);
    expect([0, FILM.hurdles, FILM.poleVault, FILM.highJump].map(BEAT_AT)).toEqual([0, 1, 2, 3]);
    expect([FILM.hurdles, FILM.poleVault, FILM.highJump].map(sceneAt)).toEqual(["hurdles", "poleVault", "highJump"]);
  });

  it("ouvre sur un athlète debout, au calme, et finit les bras en l'air", () => {
    const start = frameAt(0);
    expect(start).toMatchObject({ scene: "hurdles", face: "neutral", running: false });
    expect(frameAt(FILM.hurdles * 0.5).pose).toEqual(start.pose);
    const end = frameAt(1);
    expect(end).toMatchObject({ scene: "highJump", face: "joy", running: false });
    const joints = jointPositions(end.pose, end.pose);
    expect(joints.handA.y).toBeLessThan(joints.head.y);
  });

  it("ne saute pas d'une image à la suivante à l'intérieur d'une scène", () => {
    let previous = frameAt(0);
    for (const t of times.slice(1)) {
      const next = frameAt(t);
      if (next.scene === previous.scene) {
        expect(Math.hypot(next.pose.x - previous.pose.x, next.pose.y - previous.pose.y), `t = ${t}`).toBeLessThan(14);
      }
      previous = next;
    }
  });

  it("garde chaque athlète au-dessus de la piste du film", () => {
    for (const t of times) {
      const { pose } = frameAt(t);
      const joints = jointPositions(pose, pose);
      expect(Math.max(joints.footA.y, joints.footB.y), `t = ${t}`).toBeLessThan(GROUND + 2);
    }
  });

  it("joue le saut en hauteur de bout en bout, sur ses propres seuils", () => {
    let previous = highJumpTime(FILM.highJump);
    for (const t of times.filter((value) => value > FILM.highJump)) {
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
    expect(frameAt(FILM_STILL).scene).toBe("highJump");
  });

  it("mène chaque geste à son terme avant le relais : la course au bord de la scène, le perchiste sur le tapis", () => {
    // Inès finit sa course au bout de la piste, à droite de la seconde haie.
    const runner = frameAt(FILM.poleVault - 1e-6).pose;
    expect(runner.x).toBeGreaterThan(1_200);
    // Malo est retombé sur le tapis, et s'y relève : le bassin est au-dessus du tapis, plus haut que rien.
    const vaulter = frameAt(FILM.highJump - 1e-6).pose;
    const lift = GROUND - (POLE_VAULT.box.y - 8);
    expect(vaulter.x).toBeGreaterThan(POLE_VAULT.mat.from);
    expect(vaulter.y).toBeLessThan(POLE_VAULT.mat.top + lift);
    expect(vaulter.y).toBeGreaterThan(POLE_VAULT.mat.top + lift - 200);
  });

  it("pose le sautoir de la perche sur le sol du film, et plante la perche dans le butoir", () => {
    const lift = GROUND - (POLE_VAULT.box.y - 8);
    for (const t of [FILM.poleVault, (FILM.poleVault + FILM.highJump) / 2, FILM.highJump - 1e-6]) {
      const props = sceneProps("poleVault", t);
      expect(props.some((shape) => shape.paint === "lane")).toBe(false);
      const pole = props.find((shape) => shape.kind === "curve");
      if (pole?.kind !== "curve") throw new Error("La perche manque à la scène.");
      const { pose } = frameAt(t);
      const hand = jointPositions(pose, pose).handB;
      // La perche reste en main jusqu'au lâcher, au-dessus de la barre.
      if (t < FILM.poleVault + (FILM.highJump - FILM.poleVault) * 0.5)
        expect(Math.hypot(pole.to.x - hand.x, pole.to.y - hand.y), `t = ${t}`).toBeLessThan(1e-6);
      if (t > FILM.poleVault + 0.1) expect(pole.from).toEqual({ x: POLE_VAULT.box.x, y: POLE_VAULT.box.y + lift });
    }
    expect(sceneProps("hurdles", FILM.hurdles).filter((shape) => shape.paint === "hurdle")).toHaveLength(2);
  });

  it("habille chaque athlète pour chaque monde qu'il traverse", () => {
    const seen = new Set<string>();
    for (const t of times) {
      const world = WORLD_AT(t);
      const athlete = SCENES.find((scene) => scene.id === sceneAt(t))!.athlete;
      const key = `${athlete} ${world}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const surface = WORLD_SURFACE[world];
      const paint = athletePaint(athlete, surface);
      for (const part of ["skin", "hair", "tee", "shorts", "shoe"] as const) {
        expect(colorDistance(paint[part], SURFACES[surface]), `${key} ${part}`).toBeGreaterThanOrEqual(DISTINCT);
      }
    }
    expect([...seen].sort()).toEqual(
      [
        "highJump coche",
        "highJump nuit",
        "highJump piste",
        "hurdles couloir",
        "hurdles piste",
        "poleVault craie",
      ].sort(),
    );
  });
});
