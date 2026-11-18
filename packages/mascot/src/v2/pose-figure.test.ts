import { describe, expect, it } from "vitest";
import { ATHLETE_IDS } from "../athletes";
import type { MascotCanvas } from "../canvas";
import { CLIPS } from "../events";
import { POSES } from "../poses";
import type { AthletePaint } from "../skeleton";
import { FIGURE, HEIGHT } from "./body";
import { nativeOf, oldJoints, SCALE } from "./lift-v1";
import {
  drawPoseFigure,
  poseBody,
  poseNodes,
  POSE_SCALE,
  poseRoot,
  svgJumperFigure,
  svgPoseFigure,
  type PoseCanvas,
} from "./pose-figure";
import { SIDES } from "./solve";
import { distance, vec } from "./vec";

const PAINT: AthletePaint = {
  skin: "skin",
  tee: "tee",
  shorts: "shorts",
  shoe: "shoe",
  hair: "hair",
  eye: "eye",
  bib: "bib",
  mark: "mark",
};
const LIFT = 1000;
// Un point de l'ancien squelette, dans l'espace du nouveau corps (le bassin résolu à LIFT).
const seen = (point: { x: number; y: number }) => ({ x: point.x * SCALE, y: LIFT - point.y * SCALE });
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Toutes les poses du groupe : les poses nommées et les épreuves, image par image.
const EVENT_POSES = Object.entries(CLIPS).flatMap(([id, clip]) =>
  Array.from({ length: 40 }, (_, i) => [`${id} ${i}/40`, clip.frame(i / 40).pose] as const),
);
const ALL = [...Object.entries(POSES), ...EVENT_POSES];

describe("le corps du moteur des gestes dans les anciennes poses", () => {
  it("garde la hauteur de la hanche de l'ancien corps : une seule échelle, la tête plus petite", () => {
    expect(POSE_SCALE).toBeCloseTo(1 / SCALE, 9);
    // 6,8 têtes : la tête du nouveau corps, dans les unités des anciennes scènes.
    expect(HEIGHT / (2 * FIGURE.head)).toBeGreaterThan(6.5);
    expect(poseRoot({ x: 10, y: 20 })).toBe(
      `translate(10 ${20 + Math.round(LIFT * POSE_SCALE * 1000) / 1000}) scale(${Math.round(POSE_SCALE * 1000) / 1000})`,
    );
  });

  // Une main ou une cheville se pose au point de l'ancien squelette ; un point hors d'atteinte du nouveau membre
  // (l'ancien bras était plus long) est visé bras ou jambe tendus, et manqué d'autant.
  it.each(ALL)("%s : les mains et les chevilles se posent aux points de l'ancien squelette", (_, pose) => {
    const body = poseBody(pose);
    const joints = oldJoints(pose, { x: 0, y: 0 }, "side");
    const c = body.controls;
    for (const side of SIDES) {
      const limb = side === "R" ? "A" : "B";
      const arm = body.arms[side];
      // La main vise l'ancienne main : dans le plan de l'image, exactement.
      const target = vec(c[`hand${side}X`], c[`hand${side}Y`], c[`hand${side}Z`]);
      expect(gap(target, seen(joints[`hand${limb}`])), `cible ${side}`).toBeLessThan(1e-6);
      const reach = distance(arm.shoulder, arm.elbow) + distance(arm.elbow, arm.hand);
      const short = Math.max(0, distance(target, arm.shoulder) - reach);
      expect(distance(arm.hand, target), `main ${side}`).toBeLessThan(short + 1.5);
      const leg = body.legs[side];
      // De profil, chaque cheville reste à la largeur des hanches.
      const old = seen(joints[`ankle${limb}`]);
      const ankle = vec(old.x, old.y, (side === "R" ? 1 : -1) * FIGURE.hip);
      const stretch = distance(leg.hip, leg.knee) + distance(leg.knee, leg.ankle);
      const far = Math.max(0, distance(ankle, leg.hip) - stretch);
      expect(distance(leg.ankle, ankle), `cheville ${side}`).toBeLessThan(far + 1.5);
    }
  });

  it("les anciens bras portaient un peu plus loin : la main manque l'objet de peu, et seulement bras tendu", () => {
    const misses = ALL.flatMap(([, pose]) => {
      const body = poseBody(pose);
      const joints = oldJoints(pose, { x: 0, y: 0 }, "side");
      return SIDES.map((side) => gap(body.arms[side].hand, seen(joints[`hand${side === "R" ? "A" : "B"}`])));
    });
    // La plupart des mains tombent juste ; les autres, l'élan d'un bras lancé, ne tiennent rien.
    expect(misses.filter((miss) => miss < 1.5).length / misses.length).toBeGreaterThan(0.75);
  });

  it("chaque athlète se dessine dans chaque pose, de profil, de face et de dos, sans valeur manquante", () => {
    for (const id of ATHLETE_IDS)
      for (const [name, pose] of Object.entries(POSES))
        for (const view of ["side", "front", "back"] as const) {
          const nodes = poseNodes(id, "joy", pose, view);
          expect(nodes.length, `${id} ${name} ${view}`).toBeGreaterThan(15);
          expect(JSON.stringify(nodes)).not.toMatch(/NaN|Infinity|undefined|null/);
          expect(nativeOf(view)).toBeDefined();
        }
  });

  it("la figure SVG garde le format des anciennes : des aplats peints, la tête et le dossard posés", () => {
    const figure = svgPoseFigure("poleVault", "effort", POSES.run, PAINT, { x: 100, y: 200 });
    expect(figure.root).toBe(poseRoot({ x: 100, y: 200 }));
    const ids = figure.bones.map((bone) => bone.id as string);
    expect(ids).toContain("head");
    expect(ids).toContain("bib");
    const colors = new Set(
      figure.bones.flatMap((bone) => bone.shapes.map((shape) => ("fill" in shape ? shape.fill : shape.stroke))),
    );
    for (const role of ["skin", "tee", "shorts", "shoe", "hair", "bib", "mark"]) expect(colors, role).toContain(role);
    // La mascotte d'origine : le même corps, sans dossard.
    const jumper = svgJumperFigure(POSES.cheer, {
      skin: "skin",
      tee: "tee",
      shorts: "shorts",
      shoe: "shoe",
      hair: "hair",
      eye: "eye",
    });
    expect(jumper.bones.map((bone) => bone.id as string)).not.toContain("bib");
  });

  it("se dessine sur un canvas : un tracé rempli par aplat, la tête et le dossard posés par leur placement", () => {
    const fills: string[] = [];
    const moves: number[][] = [];
    let depth = 0;
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      save: () => (depth += 1),
      restore: () => (depth -= 1),
      translate: (x: number, y: number) => moves.push([x, y]),
      rotate: () => undefined,
      scale: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      arc: () => undefined,
      closePath: () => undefined,
      stroke: () => undefined,
      fill(path?: unknown) {
        fills.push(`${String(ctx.fillStyle)}${typeof path === "string" ? " path" : ""}`);
      },
    } satisfies MascotCanvas & PoseCanvas;
    drawPoseFigure(ctx, "hurdles", "neutral", POSES.stand, { paint: PAINT, at: { x: 50, y: 60 }, path: (d) => d });
    expect(depth).toBe(0);
    expect(moves[0]).toEqual([50, 60 + LIFT * POSE_SCALE]);
    const nodes = poseNodes("hurdles", "neutral", POSES.stand);
    const paths = nodes.filter((node) => node.kind === "path");
    expect(fills.filter((fill) => fill.endsWith(" path"))).toHaveLength(paths.length);
    expect(fills).toContain("bib");
    expect(fills).toContain("hair");
  });
});
