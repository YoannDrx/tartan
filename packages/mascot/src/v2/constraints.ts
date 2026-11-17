// Ce qu'un geste doit respecter à chaque image : les amplitudes articulaires, le sol, les appuis, la prise.
// Les mesures partent des positions résolues, pas de la description : elles contrôlent le résultat, pas l'intention.
// Les tests du paquet s'en servent ; une planche de relecture peut s'en servir aussi.
import { BARBELL, FIGURE, LIMITS, type Limit } from "./body";
import type { MotionClip, Phase } from "./gesture";
import { volumes } from "./skin";
import { SIDES, type Side, type Solved } from "./solve";
import { add, degrees, distance, dot, normalize, scale, sub, type Frame, type Vec3 } from "./vec";

const angleBetween = (a: Vec3, b: Vec3) =>
  degrees(Math.acos(Math.min(1, Math.max(-1, dot(normalize(a), normalize(b))))));
const within = (d: Vec3, frame: Frame) => ({ f: dot(d, frame.f), u: dot(d, frame.u), s: dot(d, frame.s) });
const outward = (side: Side) => (side === "R" ? 1 : -1);

export type Reading = { limit: Limit; joint: string; value: number };

// Les angles d'un corps résolu, en degrés.
export const measure = (body: Solved): Reading[] => {
  const readings: Reading[] = [
    { limit: "lumbar", joint: "lombaires", value: body.controls.lumbar },
    { limit: "thoracic", joint: "dorsales", value: body.controls.thoracic },
    { limit: "neck", joint: "cou", value: body.controls.neck },
    { limit: "wrist", joint: "poignets", value: body.controls.wrist },
  ];
  for (const side of SIDES) {
    const leg = body.legs[side];
    const arm = body.arms[side];
    // Le genou : sa flexion, comptée négative s'il passe derrière la ligne hanche-cheville (hyperextension).
    const flexion = angleBetween(sub(leg.knee, leg.hip), sub(leg.ankle, leg.knee));
    const chord = sub(leg.ankle, leg.hip);
    const along = dot(sub(leg.knee, leg.hip), chord) / dot(chord, chord);
    const bulge = dot(sub(leg.knee, add(leg.hip, scale(chord, along))), leg.flat.f);
    readings.push({ limit: "knee", joint: `genou ${side}`, value: bulge < -0.01 ? -flexion : flexion });
    readings.push({
      limit: "elbow",
      joint: `coude ${side}`,
      value: angleBetween(sub(arm.elbow, arm.shoulder), sub(arm.wrist, arm.elbow)),
    });
    const thigh = within(normalize(sub(leg.knee, leg.hip)), body.frames.pelvis);
    readings.push({
      limit: "hipFlexion",
      joint: `hanche ${side} (flexion)`,
      value: degrees(Math.atan2(thigh.f, -thigh.u)),
    });
    readings.push({
      limit: "hipAbduction",
      joint: `hanche ${side} (abduction)`,
      value: degrees(Math.asin(Math.min(1, Math.max(-1, outward(side) * thigh.s)))),
    });
    const shin = within(normalize(sub(leg.knee, leg.ankle)), leg.frame);
    readings.push({ limit: "ankle", joint: `cheville ${side}`, value: degrees(Math.atan2(shin.f, shin.u)) });
    readings.push({
      limit: "ankleSide",
      joint: `cheville ${side} (côté)`,
      value: degrees(Math.asin(Math.min(1, Math.max(-1, shin.s)))),
    });
    const upper = within(normalize(sub(arm.elbow, arm.shoulder)), body.frames.thorax);
    readings.push({
      limit: "shoulderExtension",
      joint: `épaule ${side} (extension)`,
      value: upper.u < 0 && upper.f < 0 ? degrees(Math.atan2(-upper.f, -upper.u)) : 0,
    });
  }
  return readings;
};

// Les points qui disent si le corps a bougé : articulations, extrémités, barre.
const landmarks = (body: Solved): Vec3[] => [
  body.pelvis,
  body.waist,
  body.chest,
  body.neck,
  body.head,
  ...SIDES.flatMap((side) => [
    body.legs[side].knee,
    body.legs[side].ankle,
    body.legs[side].heel,
    body.legs[side].ball,
    body.arms[side].elbow,
    body.arms[side].wrist,
    body.arms[side].hand,
  ]),
  ...(body.bar ? [body.bar.center] : []),
];
const moved = (a: Solved, b: Solved) => {
  const [from, to] = [landmarks(a), landmarks(b)];
  return Math.max(...from.map((point, index) => distance(point, to[index]!)));
};

export const phaseAt = (clip: MotionClip, t: number): Phase =>
  clip.phases.find((phase) => t < phase.to) ?? clip.phases[clip.phases.length - 1]!;

export type Report = {
  // Une articulation hors de son amplitude, un genou en hyperextension.
  limits: string[];
  // Un volume du corps ou de la barre sous le sol.
  ground: string[];
  // Un pied d'appui qui glisse ou décolle.
  feet: string[];
  // Une main qui quitte la barre, une prise qui change de largeur, la barre qui traverse la tête.
  bar: string[];
  // Une tenue qui bouge.
  holds: string[];
  // Une boucle qui ne se referme pas.
  loop: string[];
};

// La dérive tolérée d'un pied d'appui, dans les unités du corps.
export const SLIP = 0.5;

// Passe le geste au crible : `samples` images sur la boucle, plus quelques-unes dans chaque tronçon.
export const inspect = (clip: MotionClip, samples = 240): Report => {
  const report: Report = { limits: [], ground: [], feet: [], bar: [], holds: [], loop: [] };
  const at = (t: number) => `t = ${t.toFixed(4)} (${phaseAt(clip, t).name})`;

  for (let i = 0; i < samples; i += 1) {
    const t = i / samples;
    const body = clip.pose(t);
    for (const { limit, joint, value } of measure(body)) {
      const [low, high] = LIMITS[limit];
      if (!(value >= low - 1e-6 && value <= high + 1e-6))
        report.limits.push(`${joint} : ${value.toFixed(1)}° à ${at(t)}`);
    }
    for (const { c, r } of volumes(body))
      if (!(c.y - r >= -0.01)) {
        report.ground.push(`un volume descend à ${(c.y - r).toFixed(2)} à ${at(t)}`);
        break;
      }
    if (body.bar && clip.rig.bar) {
      for (const side of SIDES)
        if (!(distance(body.arms[side].hand, body.bar.grips[side]) < 0.01))
          report.bar.push(
            `la main ${side} est à ${distance(body.arms[side].hand, body.bar.grips[side]).toFixed(2)} de la barre à ${at(t)}`,
          );
      const width = distance(body.arms.R.hand, body.arms.L.hand);
      if (Math.abs(width - 2 * clip.rig.bar.grip) > 0.02)
        report.bar.push(`la prise mesure ${width.toFixed(2)} à ${at(t)}`);
      const clear = Math.hypot(body.bar.center.x - body.head.x, body.bar.center.y - body.head.y);
      if (clear < FIGURE.head + BARBELL.shaft - 0.5)
        report.bar.push(`la barre traverse la tête (${clear.toFixed(1)}) à ${at(t)}`);
    }
  }

  for (const phase of clip.phases) {
    const inside = (count: number) =>
      Array.from({ length: count }, (_, i) => phase.from + ((phase.to - phase.from) * (i + 0.02)) / count);
    const first = clip.pose(phase.from + (phase.to - phase.from) * 1e-6);
    for (const t of inside(24)) {
      const body = clip.pose(t);
      for (const side of phase.planted) {
        const drift = distance(body.legs[side].ball, first.legs[side].ball);
        const toes = distance(body.legs[side].toe, first.legs[side].toe);
        if (Math.max(drift, toes) >= SLIP || Math.abs(body.legs[side].ball.y) > 1e-6)
          report.feet.push(`le pied ${side} glisse de ${Math.max(drift, toes).toFixed(2)} à ${at(t)}`);
      }
      if (phase.hold && moved(body, first) > 1e-9)
        report.holds.push(`le corps bouge de ${moved(body, first).toExponential(1)} à ${at(t)}`);
    }
  }

  const gap = moved(clip.pose(1 - 1e-7), clip.pose(0));
  if (gap > 1e-3) report.loop.push(`la boucle se referme à ${gap.toFixed(4)} près`);
  return report;
};

export type BarSample = { t: number; phase: string; x: number; y: number; vx: number; vy: number };

// La barre à l'instant `t` : sa position, et sa vitesse en unités par seconde.
export const barAt = (clip: MotionClip, t: number): BarSample => {
  const step = 1e-4;
  const seconds = (clip.duration * 2 * step) / 1000;
  const [before, now, after] = [clip.pose(t - step).bar!, clip.pose(t).bar!, clip.pose(t + step).bar!];
  return {
    t,
    phase: phaseAt(clip, t).name,
    x: now.center.x,
    y: now.center.y,
    vx: (after.center.x - before.center.x) / seconds,
    vy: (after.center.y - before.center.y) / seconds,
  };
};

// La trajectoire de la barre sur toute la boucle.
export const barPath = (clip: MotionClip, samples = 480): BarSample[] =>
  Array.from({ length: samples }, (_, i) => barAt(clip, i / samples));
