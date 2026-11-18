// La peau : des volumes simples posés sur le squelette. Chaque partie du corps est l'enveloppe de quelques
// sphères ; projetée, elle donne un aplat sans contour, juste de profil comme de face. Les membres s'affinent
// vers leur extrémité, les articulations se lisent à la jonction de deux parties.
import type { GearRole } from "../exercise";
import type { PaintRole } from "../skeleton";
import { BARBELL, FIGURE } from "./body";
import { SIDES, type Side, type Solved } from "./solve";
import { add, along, mix, vec, type Frame, type Vec3 } from "./vec";

// Ce qu'un rendu doit colorer : les rôles d'un athlète du groupe, plus ceux du matériel (la barre, ses disques,
// un banc, une boîte). Les couleurs viennent de l'hôte, donc des jetons de design.
export type SkinPaint = PaintRole | GearRole;

export type Sphere = { c: Vec3; r: number };
export type Part = {
  id: string;
  paint: SkinPaint;
  spheres: Sphere[];
  // Un disque de fonte : ses deux sphères sont les centres de ses deux faces, et son rayon.
  disc?: boolean;
  // Dessinée juste au-dessus d'une autre partie, quelle que soit la vue : le short sur la cuisse, la manche sur le bras.
  over?: string;
  // Un décalage de profondeur, dans les unités du corps : la main passe devant la barre qu'elle tient.
  lift?: number;
};

// Un repère dessiné à plat (la tête, le dossard) : où il se pose, et son axe vertical.
export type Anchor = { at: Vec3; up: Vec3 };

export type Skin = { parts: Part[]; head: Anchor; bib: Anchor };

// Les rayons, de la racine d'un membre à son extrémité.
export const GIRTH = {
  thigh: [16, 10.2],
  // Le mollet : un renflement sous le genou, à cette part du tibia.
  shin: { knee: 9.6, calf: 10.6, at: 0.28, ankle: 6.2 },
  upperArm: [9.6, 7.4],
  forearm: [7.6, 5],
  hand: [5, 6.2],
  neck: 8.5,
  // Le short couvre le haut de la cuisse, la manche le haut du bras.
  shorts: { until: 0.5, radius: [17.2, 14.4] },
  sleeve: { until: 0.42, radius: [10.8, 9.8] },
  // Le buste : les hanches, la taille, les côtes, le haut de la poitrine. Demi-largeur, puis rayon.
  hips: { radius: 17.5 },
  waist: { half: 9, radius: 16 },
  ribs: { half: 12, radius: 17.5 },
  chest: { half: 20, radius: 20, drop: 16 },
  shoe: { heel: 7, ankle: 7, ball: 6.2, toe: 5, half: 4.6 },
} as const;

const out = (side: Side) => (side === "R" ? 1 : -1);

export const skin = (body: Solved): Skin => {
  const { frames } = body;
  const parts: Part[] = [];
  const limb = (
    id: string,
    paint: SkinPaint,
    from: Vec3,
    to: Vec3,
    radius: readonly [number, number],
    extra: Partial<Part> = {},
  ) =>
    parts.push({
      id,
      paint,
      spheres: [
        { c: from, r: radius[0] },
        { c: to, r: radius[1] },
      ],
      ...extra,
    });
  const pair = (origin: Vec3, frame: Frame, forward: number, up: number, half: number, r: number) =>
    [-1, 1].map((k): Sphere => ({ c: along(origin, frame, forward, up, k * half), r }));

  // Le buste, du bas vers le haut : il se plie à la taille et au milieu du dos.
  const hips = SIDES.map((side): Sphere => ({ c: body.legs[side].hip, r: GIRTH.hips.radius }));
  const waist = pair(body.waist, frames.pelvis, 0, 2, GIRTH.waist.half, GIRTH.waist.radius);
  const ribs = pair(body.chest, frames.lumbar, 1.5, 0, GIRTH.ribs.half, GIRTH.ribs.radius);
  const chest = pair(body.neck, frames.thorax, 3, -GIRTH.chest.drop, GIRTH.chest.half, GIRTH.chest.radius);
  parts.push({ id: "belly", paint: "tee", spheres: [...waist, ...ribs] });
  parts.push({
    id: "pelvis",
    paint: "shorts",
    spheres: [...hips, ...waist.map((s) => ({ c: s.c, r: s.r + 0.6 }))],
    over: "belly",
  });
  parts.push({ id: "chest", paint: "tee", spheres: [...ribs, ...chest], over: "pelvis" });
  parts.push({
    id: "neck",
    paint: "skin",
    spheres: [
      { c: body.neck, r: GIRTH.neck },
      { c: body.head, r: GIRTH.neck },
    ],
  });

  for (const side of SIDES) {
    const leg = body.legs[side];
    limb(`thigh${side}`, "skin", leg.hip, leg.knee, GIRTH.thigh);
    limb(`shorts${side}`, "shorts", leg.hip, mix(leg.hip, leg.knee, GIRTH.shorts.until), GIRTH.shorts.radius, {
      over: `thigh${side}`,
    });
    const { shin, shoe } = GIRTH;
    parts.push({
      id: `shin${side}`,
      paint: "skin",
      spheres: [
        { c: leg.knee, r: shin.knee },
        { c: mix(leg.knee, leg.ankle, shin.at), r: shin.calf },
        { c: leg.ankle, r: shin.ankle },
      ],
    });
    parts.push({
      id: `shoe${side}`,
      paint: "shoe",
      spheres: [
        { c: leg.ankle, r: shoe.ankle },
        { c: along(leg.heel, leg.frame, shoe.heel + 0.3, shoe.heel, 0), r: shoe.heel },
        { c: along(leg.ball, leg.fore, 0, shoe.ball, shoe.half), r: shoe.ball },
        { c: along(leg.ball, leg.fore, 0, shoe.ball, -shoe.half), r: shoe.ball },
        { c: along(leg.toe, leg.fore, -shoe.toe - 0.2, shoe.toe, 0), r: shoe.toe },
      ],
    });

    const arm = body.arms[side];
    limb(`upperArm${side}`, "skin", arm.shoulder, arm.elbow, GIRTH.upperArm);
    limb(`sleeve${side}`, "tee", arm.shoulder, mix(arm.shoulder, arm.elbow, GIRTH.sleeve.until), GIRTH.sleeve.radius, {
      over: `upperArm${side}`,
    });
    limb(`forearm${side}`, "skin", arm.elbow, arm.wrist, GIRTH.forearm);
    // La main : du poignet aux doigts refermés, un peu au-delà du centre de la prise.
    limb(`hand${side}`, "skin", arm.wrist, mix(arm.wrist, arm.hand, 1.35), GIRTH.hand, { lift: 6 });
  }

  if (body.bar) {
    const { center } = body.bar;
    const at = (z: number) => add(center, vec(0, 0, z));
    limb("barShaft", "iron", at(-BARBELL.collar), at(BARBELL.collar), [BARBELL.shaft, BARBELL.shaft]);
    for (const side of SIDES) {
      const k = out(side);
      limb(`barSleeve${side}`, "iron", at(k * BARBELL.collar), at(k * BARBELL.half), [BARBELL.sleeve, BARBELL.sleeve]);
      [0, 1].forEach((index) => {
        const inner = BARBELL.collar + 3 + index * (BARBELL.thickness + BARBELL.gap);
        parts.push({
          id: `plate${side}${index}`,
          paint: "plate",
          disc: true,
          spheres: [
            { c: at(k * inner), r: BARBELL.plate },
            { c: at(k * (inner + BARBELL.thickness)), r: BARBELL.plate },
          ],
        });
      });
    }
  }

  return {
    parts,
    head: { at: body.head, up: frames.head.u },
    bib: { at: along(body.neck, frames.thorax, 12, -26, 0), up: frames.thorax.u },
  };
};

// Tout ce qui est dessiné, en sphères : ce que les tests comparent au sol. La tête compte pour sa propre sphère.
export const volumes = (body: Solved): Sphere[] => [
  ...skin(body).parts.flatMap((part) => part.spheres),
  { c: body.head, r: FIGURE.head },
];
