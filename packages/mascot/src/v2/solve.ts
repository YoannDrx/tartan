// D'une description (pose.ts) à un corps : la colonne se déroule depuis le bassin, puis la cinématique inverse
// place les genoux et les coudes. Les pieds sont là où la description les pose, les mains sur la barre :
// c'est le bassin qui s'ajuste, jamais un appui qui glisse.
import { FIGURE } from "./body";
import { liftToReach, span, twoBone } from "./ik";
import type { Controls } from "./pose";
import {
  add,
  along,
  cross,
  distance,
  mix,
  normalize,
  pitch,
  roll,
  scale,
  sub,
  vec,
  WORLD,
  yaw,
  type Frame,
  type Vec3,
} from "./vec";

export const SIDES = ["R", "L"] as const;
export type Side = (typeof SIDES)[number];
const outward = (side: Side) => (side === "R" ? 1 : -1);

// Comment la barre est tenue : à deux mains, ou posée sur le haut du dos, les mains la calant.
export type BarHold = "hands" | "back";
// `grip` : la demi-largeur de prise, du milieu de la barre au centre d'une main.
export type Rig = { bar: { grip: number; hold: BarHold } | null };

// Où la barre repose sur le dos, depuis la base du cou : derrière, et un peu plus bas (barre haute, sur les trapèzes).
export const RACK = { back: 15, drop: 3 };
// La flexion gardée par un membre tendu : assez pour ne jamais se verrouiller à l'envers, trop peu pour se voir.
export const SLACK = { arm: 1, leg: 2 };

export type Leg = {
  hip: Vec3;
  knee: Vec3;
  ankle: Vec3;
  heel: Vec3;
  ball: Vec3;
  toe: Vec3;
  // Le repère du pied à plat (l'avant vers la pointe), celui de l'arrière-pied quand le talon se lève, et celui
  // de l'avant-pied et des orteils.
  flat: Frame;
  frame: Frame;
  fore: Frame;
  flexion: number;
};
export type Arm = {
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  // Le centre de la prise : là où la main tient.
  hand: Vec3;
  flexion: number;
};
export type Bar = { center: Vec3; grips: Record<Side, Vec3> };

export type Solved = {
  pelvis: Vec3;
  // Les articulations de la colonne : le haut du bassin, le milieu du dos, la base du cou, le centre de la tête.
  waist: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  frames: { pelvis: Frame; lumbar: Frame; thorax: Frame; neck: Frame; head: Frame };
  legs: Record<Side, Leg>;
  arms: Record<Side, Arm>;
  bar: Bar | null;
  // La description, avec le bassin et la barre tels que les contraintes les ont placés.
  controls: Controls;
};

// Un pied. Posé à plat, il n'a qu'une ouverture ; sur la pointe, l'arrière-pied pivote sur l'avant-pied, dont les
// orteils restent au sol ; décollé ou couché, tout le pied suit le même repère.
const foot = (c: Controls, side: Side) => {
  const k = outward(side);
  const flat = roll(yaw(WORLD, k * c[`foot${side}Yaw`]), k * c[`foot${side}Roll`]);
  const frame = pitch(flat, c[`foot${side}Heel`]);
  const ball = vec(c[`foot${side}X`], c[`foot${side}Lift`], c[`foot${side}Z`]);
  // Les orteils : à plat tant que l'avant-pied touche le sol, dans l'axe du pied dès qu'il le quitte.
  const loose = Math.max(
    Math.min(1, ball.y / 12),
    Math.min(1, Math.abs(c[`foot${side}Roll`]) / 30),
    c[`foot${side}Heel`] < 0 ? 1 : 0,
  );
  let toward = normalize(mix(flat.f, frame.f, loose));
  const reach = FIGURE.foot.toe - FIGURE.foot.ball;
  // Une pointe ne passe pas sous le sol : elle se relève juste assez.
  if (loose < 1 && ball.y + reach * toward.y < 0) {
    const level = normalize(vec(toward.x, 0, toward.z));
    const sink = -ball.y / reach;
    toward = add(scale(level, Math.sqrt(Math.max(0, 1 - sink * sink))), vec(0, sink, 0));
  }
  const fore: Frame = { f: toward, u: normalize(cross(flat.s, toward)), s: flat.s };
  return {
    flat,
    frame,
    fore,
    ball,
    ankle: along(ball, frame, -FIGURE.foot.ball, FIGURE.ankle, 0),
    heel: along(ball, frame, -FIGURE.foot.ball - FIGURE.foot.heel, 0, 0),
    toe: add(ball, scale(toward, reach)),
  };
};

// Du coude au centre de la prise, poignet cassé ou non ; puis la portée d'une jambe tendue.
const ARM_REACH = (wrist: number) => span(FIGURE.forearm, FIGURE.hand, Math.abs(wrist));
const LEG_REACH = span(FIGURE.thigh, FIGURE.shin, SLACK.leg);

// La hauteur d'une barre tenue bras tendus par le corps décrit, au-dessus des épaules (`above`) ou en dessous.
// Sert à écrire une clé où ce sont les jambes tendues, et non la barre, qui fixent la hauteur du corps.
export const barAtArmsLength = (c: Controls, grip: number, above: boolean): number => {
  const { shoulder } = solve({ ...c, armsLong: 0 }, { bar: null }).arms.R;
  const reach = span(FIGURE.upperArm, ARM_REACH(c.wrist), SLACK.arm);
  const flat = (c.barX - shoulder.x) ** 2 + (c.pelvisZ + grip - shoulder.z) ** 2;
  const rise = Math.sqrt(Math.max(0, reach * reach - flat));
  return shoulder.y + (above ? rise : -rise);
};

export const solve = (c: Controls, rig: Rig): Solved => {
  const pelvisFrame = pitch(roll(yaw(WORLD, c.pelvisYaw), c.pelvisRoll), c.pelvisPitch);
  const lumbar = pitch(pelvisFrame, c.lumbar);
  const thorax = pitch(lumbar, c.thoracic);
  const neckFrame = pitch(thorax, c.neck);
  const headFrame = pitch(neckFrame, c.head);

  // Le haut du corps, depuis le bassin : il ne dépend que des angles, pas de la position.
  const origin = vec(0, 0, 0);
  const waist = scale(pelvisFrame.u, FIGURE.pelvis);
  const chest = add(waist, scale(lumbar.u, FIGURE.lumbar));
  const neck = add(chest, scale(thorax.u, FIGURE.thorax));
  const head = add(neck, scale(neckFrame.u, FIGURE.neck));
  const shoulder = (side: Side) =>
    along(neck, thorax, 0, -FIGURE.shoulderDrop + FIGURE.shrug * c.shrug, outward(side) * FIGURE.shoulder);
  const hip = (side: Side) => along(origin, pelvisFrame, 0, 0, outward(side) * FIGURE.hip);
  const rack = along(neck, thorax, -RACK.back, -RACK.drop, 0);

  const feet = { R: foot(c, "R"), L: foot(c, "L") };
  const lower = ARM_REACH(c.wrist);
  const armReach = span(FIGURE.upperArm, lower, SLACK.arm);

  let pelvis = vec(c.pelvisX, c.pelvisY, c.pelvisZ);
  let barCenter = vec(c.barX, c.barY, c.pelvisZ);
  const grip = (side: Side) => add(barCenter, vec(0, 0, outward(side) * (rig.bar?.grip ?? 0)));

  if (rig.bar?.hold === "back") {
    // La barre porte le dos : le bassin se déduit d'elle.
    pelvis = vec(barCenter.x - rack.x, barCenter.y - rack.y, pelvis.z);
  } else if (rig.bar) {
    // Bras tendus, le bassin prend la hauteur qui laisse les mains sur la barre. Hors de portée, il la prend
    // toujours : les mains ne lâchent jamais.
    const from = add(pelvis, shoulder("R"));
    const lift = liftToReach(from, grip("R"), armReach);
    if (lift !== null) {
      const weight = distance(from, grip("R")) > armReach ? 1 : c.armsLong;
      pelvis = add(pelvis, vec(0, weight * lift, 0));
    }
  }

  // Une jambe ne s'allonge pas : si un pied est trop loin, le bassin descend.
  let drop = 0;
  for (const side of SIDES) {
    const from = add(pelvis, hip(side));
    if (distance(from, feet[side].ankle) <= LEG_REACH) continue;
    const lift = liftToReach(from, feet[side].ankle, LEG_REACH);
    if (lift !== null) drop = Math.min(drop, lift);
  }
  pelvis = add(pelvis, vec(0, drop, 0));
  // Posée sur le dos, la barre suit le dos.
  if (rig.bar?.hold === "back") barCenter = add(pelvis, rack);

  const at = (offset: Vec3) => add(pelvis, offset);
  const bar: Bar | null = rig.bar ? { center: barCenter, grips: { R: grip("R"), L: grip("L") } } : null;

  const leg = (side: Side): Leg => {
    const placed = feet[side];
    const k = outward(side);
    const turned = yaw(WORLD, k * (c[`foot${side}Yaw`] + c[`knee${side}Out`]));
    const pole = along(vec(0, 0, 0), turned, c[`knee${side}Forward`], c[`knee${side}Up`], k * c[`knee${side}Side`]);
    const from = at(hip(side));
    const bones = twoBone(from, placed.ankle, FIGURE.thigh, FIGURE.shin, pole, SLACK.leg);
    // Un pied hors de portée suit la jambe : rien ne s'étire. Les tests voient alors l'appui bouger.
    const short = sub(bones.end, placed.ankle);
    const moved = (point: Vec3) => add(point, short);
    return {
      hip: from,
      knee: bones.mid,
      ...placed,
      ankle: bones.end,
      heel: moved(placed.heel),
      ball: moved(placed.ball),
      toe: moved(placed.toe),
      flexion: bones.flexion,
    };
  };

  const arm = (side: Side): Arm => {
    const k = outward(side);
    const from = at(shoulder(side));
    const free = along(at(neck), thorax, c[`hand${side}Forward`], c[`hand${side}Up`], k * c[`hand${side}Out`]);
    const pinned = vec(c[`hand${side}X`], c[`hand${side}Y`], c[`hand${side}Z`]);
    const target = bar ? bar.grips[side] : mix(free, pinned, c[`hand${side}Pin`]);
    const pole = along(origin, thorax, c[`elbow${side}Forward`], c[`elbow${side}Up`], k * c[`elbow${side}Out`]);
    const bones = twoBone(from, target, FIGURE.upperArm, lower, pole, SLACK.arm);
    // Le poignet, entre le coude et la prise : cassé, il sort de leur ligne vers l'avant du buste.
    const bend = twoBone(bones.mid, bones.end, FIGURE.forearm, FIGURE.hand, scale(thorax.f, c.wrist >= 0 ? 1 : -1), 0);
    return { shoulder: from, elbow: bones.mid, wrist: bend.mid, hand: bones.end, flexion: bones.flexion };
  };

  return {
    pelvis,
    waist: at(waist),
    chest: at(chest),
    neck: at(neck),
    head: at(head),
    frames: { pelvis: pelvisFrame, lumbar, thorax, neck: neckFrame, head: headFrame },
    legs: { R: leg("R"), L: leg("L") },
    arms: { R: arm("R"), L: arm("L") },
    bar,
    controls: { ...c, pelvisX: pelvis.x, pelvisY: pelvis.y, barX: barCenter.x, barY: barCenter.y },
  };
};
