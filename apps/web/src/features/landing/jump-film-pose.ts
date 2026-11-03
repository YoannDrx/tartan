// Le saut du film, en fonctions pures : t (de 0 à 1, la position du défilement) donne une pose unique, à l'aller comme au retour.

export const GROUND = 740;
export const BODY = { torso: 96, shoulder: 88, neck: 132, arm: 48, forearm: 46, thigh: 62, shin: 62 };

export const BAR = { farX: 830, farY: 270, nearX: 1270, nearY: 190 };
export const MAT_TOP = 590;
export const IMPACT = { x: 1150, y: 545 };

// Les seuils du film. Le franchissement occupe un long tronçon du défilement : c'est lui, le ralenti.
export const T = {
  run: 0.115,
  runEnd: 0.36,
  plant: 0.4,
  takeoff: 0.455,
  apex: 0.63,
  impact: 0.775,
  filled: 0.805,
  finish: 0.9,
  // Fin de l'action, pour le compteur d'images.
  end: 0.9,
};

export type Pose = {
  x: number;
  y: number;
  rot: number;
  flip: number;
  sx: number;
  sy: number;
  lean: number;
  head: number;
  armA: number;
  elbowA: number;
  armB: number;
  elbowB: number;
  legA: number;
  kneeA: number;
  legB: number;
  kneeB: number;
};

const HIP = GROUND - BODY.thigh - BODY.shin - 16;
const STAND: Pose = {
  x: 190,
  y: HIP,
  rot: 0,
  flip: 1,
  sx: 1,
  sy: 1,
  lean: 2,
  head: 0,
  armA: 12,
  elbowA: 18,
  armB: -10,
  elbowB: 18,
  legA: 7,
  kneeA: 4,
  legB: -7,
  kneeB: 4,
};

const pose = (from: Pose, patch: Partial<Pose>): Pose => ({ ...from, ...patch });

// Trajectoire du bassin : deux demi-paraboles autour de l'apex.
const arc = (u: number) => ({
  x: 745 + 405 * u,
  y: u <= 0.5 ? 105 + 335 * ((0.5 - u) / 0.5) ** 2 : 105 + 440 * ((u - 0.5) / 0.5) ** 2,
});

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (from: number, to: number, value: number) => {
  const u = clamp((value - from) / (to - from));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

// La course : foulée, balancier des bras, buste qui penche, puis avant-dernier appui plus bas.
const runPose = (t: number): Pose => {
  const u = clamp((t - T.run) / (T.runEnd - T.run));
  const phi = u * Math.PI * 9;
  const stride = Math.sin(phi);
  const lift = Math.cos(phi);
  return {
    x: mix(190, 640, u * u * (1.6 - 0.6 * u)),
    y: HIP - 8 - 18 * Math.abs(stride) + 16 * smooth(0.82, 1, u),
    rot: mix(6, 12, smooth(0, 0.3, u)) - 10 * smooth(0.82, 1, u),
    flip: 1,
    sx: 1 - 0.04 * Math.abs(stride),
    sy: 1 + 0.05 * Math.abs(stride),
    lean: 4,
    head: -6,
    armA: -52 * stride,
    elbowA: 82,
    armB: 52 * stride,
    elbowB: 82,
    legA: 12 + 48 * stride,
    kneeA: 58 + 40 * lift,
    legB: 12 - 48 * stride,
    kneeB: 58 - 40 * lift,
  };
};

const ANTICIPATION = pose(STAND, {
  sx: 1.1,
  sy: 0.88,
  rot: -7,
  lean: -5,
  armA: -38,
  elbowA: 60,
  armB: -48,
  elbowB: 60,
  legA: 26,
  kneeA: 38,
  legB: -18,
  kneeB: 32,
});

const INTRO: Array<{ t: number; p: Pose }> = [
  { t: -0.1, p: STAND },
  { t: 0, p: STAND },
  { t: 0.075, p: STAND },
  { t: T.run, p: ANTICIPATION },
];

const FLAT = { sx: 1, sy: 1 };
const JUMP: Array<{ t: number; p: Pose }> = [
  { t: T.runEnd, p: runPose(T.runEnd) },
  // Dernier appui : le pied planté loin devant, le corps penché en arrière.
  {
    t: T.plant,
    p: pose(STAND, {
      x: 690,
      y: HIP + 34,
      rot: -16,
      sx: 1.12,
      sy: 0.86,
      lean: -6,
      head: 6,
      armA: -46,
      elbowA: 34,
      armB: -58,
      elbowB: 34,
      legA: 18,
      kneeA: 4,
      legB: -24,
      kneeB: 82,
    }),
  },
  // Impulsion : le genou libre monte, les bras avec lui.
  {
    t: 0.43,
    p: pose(STAND, {
      x: 716,
      y: HIP - 44,
      rot: -5,
      sx: 0.9,
      sy: 1.16,
      lean: 2,
      head: 2,
      armA: 150,
      elbowA: 18,
      armB: 128,
      elbowB: 20,
      legA: -7,
      kneeA: 4,
      legB: 92,
      kneeB: 104,
    }),
  },
  // Le dos se tourne vers la barre : le personnage se retourne, comme une carte.
  {
    t: T.takeoff,
    p: pose(STAND, {
      ...arc(0),
      rot: 10,
      flip: -1,
      sx: 0.88,
      sy: 1.2,
      lean: -2,
      armA: 170,
      elbowA: 8,
      armB: 96,
      elbowB: 26,
      legA: -4,
      kneeA: 18,
      legB: 62,
      kneeB: 86,
    }),
  },
  {
    t: 0.5,
    p: pose(STAND, {
      ...arc(0.17),
      rot: 36,
      flip: -1,
      ...FLAT,
      sy: 1.1,
      sx: 0.94,
      lean: -6,
      head: -6,
      armA: 174,
      elbowA: 8,
      armB: 62,
      elbowB: 22,
      legA: -6,
      kneeA: 30,
      legB: 22,
      kneeB: 66,
    }),
  },
  {
    t: 0.55,
    p: pose(STAND, {
      ...arc(0.37),
      rot: 66,
      flip: -1,
      ...FLAT,
      lean: -18,
      head: -14,
      armA: 112,
      elbowA: 12,
      armB: 40,
      elbowB: 16,
      legA: -14,
      kneeA: 58,
      legB: -8,
      kneeB: 66,
    }),
  },
  // Apex : hanches au point haut, tête déjà de l'autre côté, tibias qui pendent.
  {
    t: 0.6,
    p: pose(STAND, {
      ...arc(0.47),
      rot: 90,
      flip: -1,
      ...FLAT,
      lean: -24,
      head: -22,
      armA: 26,
      elbowA: 8,
      armB: 8,
      elbowB: 8,
      legA: -30,
      kneeA: 78,
      legB: -22,
      kneeB: 88,
    }),
  },
  {
    t: T.apex,
    p: pose(STAND, {
      ...arc(0.5),
      rot: 94,
      flip: -1,
      ...FLAT,
      lean: -26,
      head: -24,
      armA: 18,
      elbowA: 8,
      armB: 2,
      elbowB: 8,
      legA: -32,
      kneeA: 82,
      legB: -24,
      kneeB: 92,
    }),
  },
  {
    t: 0.67,
    p: pose(STAND, {
      ...arc(0.55),
      rot: 100,
      flip: -1,
      ...FLAT,
      lean: -22,
      head: -18,
      armA: 24,
      elbowA: 8,
      armB: 8,
      elbowB: 8,
      legA: -16,
      kneeA: 74,
      legB: -8,
      kneeB: 82,
    }),
  },
  // Dégagement : les jambes partent vers le haut, la tête tombe vers le tapis.
  {
    t: 0.715,
    p: pose(STAND, {
      ...arc(0.68),
      rot: 122,
      flip: -1,
      sx: 0.96,
      sy: 1.06,
      lean: -6,
      head: 8,
      armA: 58,
      elbowA: 10,
      armB: 42,
      elbowB: 10,
      legA: 58,
      kneeA: 18,
      legB: 66,
      kneeB: 12,
    }),
  },
  {
    t: 0.75,
    p: pose(STAND, {
      ...arc(0.87),
      rot: 148,
      flip: -1,
      sx: 0.94,
      sy: 1.1,
      lean: 8,
      head: 14,
      armA: 84,
      elbowA: 10,
      armB: 66,
      elbowB: 10,
      legA: 78,
      kneeA: 16,
      legB: 84,
      kneeB: 12,
    }),
  },
  { t: T.impact, p: legsUp(IMPACT.x, IMPACT.y, 164, 1.26, 0.7) },
  { t: 0.79, p: legsUp(1156, 552, 168, 1.34, 0.62) },
  // Rebond dans le tapis, puis roulade arrière.
  { t: 0.835, p: legsUp(1168, 420, 176, 0.92, 1.12) },
  { t: 0.875, p: legsUp(1180, 545, 170, 1.18, 0.78) },
  { t: T.finish, p: legsUp(1186, 520, 188, 1, 1) },
  {
    t: 0.94,
    p: pose(STAND, {
      x: 1190,
      y: MAT_TOP - 140,
      rot: 360,
      flip: -1,
      sx: 1.1,
      sy: 0.9,
      lean: 2,
      armA: 92,
      elbowA: 40,
      armB: -74,
      elbowB: -40,
      legA: 10,
      kneeA: 18,
      legB: -6,
      kneeB: 16,
    }),
  },
  // Debout sur le tapis, il regarde la barre restée en place, les bras en l'air.
  {
    t: 0.97,
    p: pose(STAND, {
      x: 1190,
      y: MAT_TOP - 146,
      rot: 360,
      flip: -1,
      sx: 0.96,
      sy: 1.06,
      lean: -2,
      head: -10,
      armA: 122,
      elbowA: 8,
      armB: -122,
      elbowB: -8,
      legA: 7,
      kneeA: 3,
      legB: -7,
      kneeB: 3,
    }),
  },
  {
    t: 1.1,
    p: pose(STAND, {
      x: 1190,
      y: MAT_TOP - 144,
      rot: 360,
      flip: -1,
      lean: -2,
      head: -10,
      armA: 122,
      elbowA: 8,
      armB: -122,
      elbowB: -8,
      legA: 7,
      kneeA: 3,
      legB: -7,
      kneeB: 3,
    }),
  },
];

function legsUp(x: number, y: number, rot: number, sx: number, sy: number): Pose {
  return pose(STAND, {
    x,
    y,
    rot,
    flip: -1,
    sx,
    sy,
    lean: 10,
    head: 16,
    armA: 96,
    elbowA: 12,
    armB: 76,
    elbowB: 12,
    legA: 82,
    kneeA: 22,
    legB: 92,
    kneeB: 14,
  });
}

// Catmull-Rom non uniforme : un léger dépassement sur les clés, voulu, donne le rebond du dessin animé.
const KEYS = Object.keys(STAND) as Array<keyof Pose>;
const sample = (track: Array<{ t: number; p: Pose }>, t: number): Pose => {
  let i = 0;
  while (i < track.length - 2 && t > track[i + 1]!.t) i += 1;
  const k1 = track[i]!;
  const k2 = track[i + 1]!;
  const k0 = track[i - 1] ?? k1;
  const k3 = track[i + 2] ?? k2;
  const span = k2.t - k1.t;
  const u = clamp((t - k1.t) / span);
  const u2 = u * u;
  const u3 = u2 * u;
  const out = {} as Pose;
  for (const key of KEYS) {
    const m1 = k0 === k1 ? 0 : ((k2.p[key] - k0.p[key]) / (k2.t - k0.t)) * span;
    const m2 = k3 === k2 ? 0 : ((k3.p[key] - k1.p[key]) / (k3.t - k1.t)) * span;
    out[key] =
      (2 * u3 - 3 * u2 + 1) * k1.p[key] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2.p[key] + (u3 - u2) * m2;
  }
  out.flip = clamp(out.flip, -1, 1);
  return out;
};

export const poseAt = (t: number): Pose => {
  if (t < T.run) return sample(INTRO, t);
  if (t < T.runEnd) {
    const run = runPose(t);
    const blend = smooth(T.run, T.run + 0.03, t);
    if (blend >= 1) return run;
    const out = {} as Pose;
    for (const key of KEYS) out[key] = mix(ANTICIPATION[key], run[key], blend);
    return out;
  }
  return sample(JUMP, t);
};

// La ligne de couloir qui décolle : au sol pendant la course, puis elle suit le bassin jusqu'au tapis.
const TRAIL_STEPS = 140;
const trailPoints = Array.from({ length: TRAIL_STEPS + 1 }, (_, i) => {
  const t = T.run + ((T.impact - T.run) * i) / TRAIL_STEPS;
  const { x, y } = poseAt(t);
  return { t, x, y: mix(GROUND + 6, y, smooth(T.plant, T.takeoff + 0.012, t)) };
});
export const TRAIL_PATH = `M -60 ${GROUND + 6} ${trailPoints.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}`;

const trailLengths = trailPoints.reduce<number[]>((all, point, i) => {
  const previous = trailPoints[i - 1];
  const step = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : point.x + 60;
  all.push((all[i - 1] ?? 0) + step);
  return all;
}, []);
export const TRAIL_LENGTH = trailLengths[trailLengths.length - 1] ?? 1;

export const trailAt = (t: number) => {
  if (t <= T.run) return 0;
  if (t >= T.impact) return TRAIL_LENGTH;
  const at = ((t - T.run) / (T.impact - T.run)) * TRAIL_STEPS;
  const i = Math.floor(at);
  return mix(trailLengths[i] ?? 0, trailLengths[i + 1] ?? TRAIL_LENGTH, at - i);
};

// La barre tremble après le passage du corps, sans tomber.
export const barWobble = (t: number) => {
  const since = t - T.apex - 0.03;
  if (since <= 0 || t >= T.filled) return 0;
  return 1.5 * Math.exp(-since / 0.045) * Math.sin(since * 150);
};

// Confettis à l'impact : même graine à chaque rendu, donc identiques côté serveur et à l'aller-retour.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const random = seeded(4242);
export const CONFETTI = Array.from({ length: 42 }, (_, i) => {
  const angle = -Math.PI * (0.06 + 0.88 * random());
  const speed = 380 + 900 * random();
  return {
    kind: i % 3,
    color: i % 5,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (random() - 0.5) * 900,
    size: 12 + 18 * random(),
  };
});
export const confettiAt = (piece: (typeof CONFETTI)[number], t: number) => {
  const d = (t - T.impact) / 0.11;
  return {
    x: IMPACT.x + piece.vx * d,
    y: IMPACT.y + piece.vy * d + 620 * d * d,
    rot: piece.spin * d,
  };
};

// Le monde et le texte à l'écran pour une position donnée. Les changements sont francs, jamais en fondu.
export const WORLD_AT = (t: number) => {
  if (t < 0.1) return "piste";
  if (t < 0.345) return "couloir";
  if (t < 0.5) return "craie";
  if (t < T.impact) return "nuit";
  if (t < T.finish) return "coche";
  return "piste";
};
export const BEAT_AT = (t: number) => {
  if (t < 0.1) return 0;
  if (t < 0.345) return 1;
  if (t < 0.5) return 2;
  if (t < T.impact) return 3;
  if (t < T.finish) return 4;
  return 5;
};
