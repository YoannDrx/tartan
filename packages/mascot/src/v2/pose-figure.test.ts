import { describe, expect, it } from "vitest";
import { ATHLETE_IDS } from "../athletes";
import type { MascotCanvas } from "../canvas";
import { CLIPS } from "../events";
import { POSES } from "../poses";
import { discusAt, DISCUS_TIMES } from "../discus";
import { closestOnPole, poleAt, POLE_VAULT_TIMES } from "../pole-vault";
import type { AthletePaint } from "../skeleton";
import { FIGURE, HEIGHT } from "./body";
import { nativeOf, oldJoints, SCALE } from "./lift-v1";
import {
  drawPoseFigure,
  poseBody,
  poseHands,
  poseNodes,
  POSE_SCALE,
  poseRoot,
  svgJumperFigure,
  svgPoseFigure,
  type HeldPose,
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

  // Aucun bras ne se tend dans le vide : chaque main atteint la cible que le corps lui donne. Sans prise imposée, le
  // bras reprend les angles de l'ancien bras, dans les limites de l'épaule ; avec une prise (la main du bas sur la
  // perche), la main y est.
  it.each(ALL)("%s : chaque main atteint sa cible, sans se verrouiller tendue, ou sur sa prise", (_, pose) => {
    const body = poseBody(pose);
    const joints = oldJoints(pose, { x: 0, y: 0 }, "side");
    const c = body.controls;
    for (const side of SIDES) {
      const arm = body.arms[side];
      const target = vec(c[`hand${side}X`], c[`hand${side}Y`], c[`hand${side}Z`]);
      expect(distance(arm.hand, target), `main ${side}`).toBeLessThan(1);
      const limb = side === "R" ? "A" : "B";
      const held = (pose as HeldPose).grip?.[`hand${limb}`];
      if (held) {
        expect(gap(arm.hand, seen(held)), `prise ${side}`).toBeLessThan(1);
        continue;
      }
      const [s, e, h] = [joints[`shoulder${limb}`], joints[`elbow${limb}`], joints[`hand${limb}`]];
      const turn = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x);
      let old = Math.abs(((turn(e, h) - turn(s, e)) * 180) / Math.PI) % 360;
      old = Math.min(Math.min(old, 360 - old), 146);
      // Un ancien bras plié le reste : le nouveau ne se verrouille pas tendu vers une main hors de portée.
      if (old >= 12) expect(arm.flexion, `coude ${side}`).toBeGreaterThan(old / 3);
    }
  });

  // Dans les épreuves, un pied posé sur la piste y reste exactement : la cheville du nouveau corps est sur celle de
  // l'ancien, à une unité près, dans la scène.
  it.each(Object.entries(CLIPS))("%s : chaque cheville au sol reste sur son appui", (_, clip) => {
    let grounded = 0;
    for (let i = 0; i <= 200; i += 1) {
      const { pose, root } = clip.frame(i / 200);
      const body = poseBody(pose);
      const joints = oldJoints(pose, root, "side");
      for (const side of SIDES) {
        const old = joints[`ankle${side === "R" ? "A" : "B"}`];
        // Debout, l'ancienne cheville est 16 au-dessus du sol.
        if (old.y < clip.stage.ground - 20) continue;
        grounded += 1;
        const ankle = body.legs[side].ankle;
        const drawn = { x: root.x + ankle.x * POSE_SCALE, y: root.y - (ankle.y - LIFT) * POSE_SCALE };
        expect(gap(drawn, old), `${i}/200 ${side}`).toBeLessThan(1);
      }
    }
    expect(grounded).toBeGreaterThan(5);
  });

  // L'objet tenu suit la main du corps dessiné : la perche des deux mains jusqu'au lâcher, le disque dans la main
  // qui le lance. À chaque image où l'ancien geste le tenait, la main est dessus, à une unité près.
  it("la perche est dans les deux mains, et le disque dans la main qui le lance, jusqu'au lâcher", () => {
    for (let i = 0; i <= 400; i += 1) {
      const t = i / 400;
      if (t <= POLE_VAULT_TIMES.release) {
        const { pose, root } = CLIPS.poleVault.frame(t);
        const pole = poleAt(t);
        const hands = poseHands(pose, root);
        expect(gap(closestOnPole(pole, hands.handB), hands.handB), `perche, main du haut, ${t}`).toBeLessThan(1);
        expect(gap(closestOnPole(pole, hands.handA), hands.handA), `perche, main du bas, ${t}`).toBeLessThan(1);
      }
      if (t <= DISCUS_TIMES.release) {
        const { pose, root } = CLIPS.discus.frame(t);
        expect(gap(discusAt(t), poseHands(pose, root).handA), `disque, ${t}`).toBeLessThan(1);
      }
    }
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
