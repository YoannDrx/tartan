// Le vol d'un saut : entre le décollage et la réception, le bassin suit la parabole que donne la gravité, le
// reste du corps passe d'une position à l'autre (avec, au besoin, une position au sommet : genoux à la poitrine,
// jambes qui s'inversent). Les pieds en l'air suivent le bassin : leur place se compte depuis lui.
// La parabole est échantillonnée en clés régulières ; l'interpolation entre elles la suit à moins d'une unité.
import type { KeyDraft } from "../gesture";
import { STAND, type Channel, type ControlPatch, type Controls } from "../pose";
import { SIDES, solve, type Rig } from "../solve";
import { along, dot, pitch, roll, vec, WORLD, yaw } from "../vec";

// Le repère du bassin décrit par une position (le même calcul que solve.ts).
const pelvisFrame = (c: Controls) => pitch(roll(yaw(WORLD, c.pelvisYaw), c.pelvisRoll), c.pelvisPitch);

// La pesanteur, dans les unités du corps : une unité vaut environ 5,4 mm, g = 9,81 m/s².
export const GRAVITY = 9.81 / 0.00537;

// La hauteur gagnée au sommet d'un vol de `ms` millisecondes, entre deux points de même hauteur.
export const apexOf = (ms: number) => (GRAVITY * (ms / 1000) ** 2) / 8;
// La durée d'un vol qui monte de `height` unités au-dessus de son départ et y retombe.
export const flightFor = (height: number) => 1000 * Math.sqrt((8 * height) / GRAVITY);

// Les genoux d'un corps tourné ou couché : ils se plient vers l'avant du bassin.
export const kneesForward = (patch: ControlPatch): ControlPatch => {
  const c = { ...STAND, ...patch };
  const frame = pelvisFrame(c);
  const out: ControlPatch = {};
  for (const side of SIDES) {
    const k = side === "R" ? 1 : -1;
    const turned = yaw(WORLD, k * (c[`foot${side}Yaw`] + c[`knee${side}Out`]));
    out[`knee${side}Forward`] = dot(frame.f, turned.f);
    out[`knee${side}Up`] = dot(frame.f, turned.u);
    out[`knee${side}Side`] = k * dot(frame.f, turned.s);
  }
  return out;
};

// Un pied décollé, placé dans le repère du bassin : vers l'avant, vers le haut, vers l'extérieur.
export const footFromPelvis = (
  base: ControlPatch,
  patch: ControlPatch,
  rig: Rig,
  side: "R" | "L",
  forward: number,
  up: number,
  out: number,
): ControlPatch => {
  const c = settle(base, patch, rig);
  const frame = pelvisFrame(c);
  const ball = along(vec(c.pelvisX, c.pelvisY, c.pelvisZ), frame, forward, up, (side === "R" ? 1 : -1) * out);
  return { [`foot${side}X`]: ball.x, [`foot${side}Lift`]: ball.y, [`foot${side}Z`]: ball.z };
};

// La description complète d'une position, telle que les contraintes la placent.
export const settle = (base: ControlPatch, patch: ControlPatch, rig: Rig): Controls =>
  solve({ ...STAND, ...base, ...patch }, rig).controls;

const RELATIVE: Partial<Record<Channel, Channel>> = {};
for (const side of SIDES) {
  RELATIVE[`foot${side}X`] = "pelvisX";
  RELATIVE[`foot${side}Lift`] = "pelvisY";
  RELATIVE[`foot${side}Z`] = "pelvisZ";
}

export type Flight = {
  // Le décollage et la réception : les positions complètes, la base du geste comprise.
  from: ControlPatch;
  to: ControlPatch;
  // La durée du vol, en millisecondes, et le nombre de tronçons qui l'échantillonnent.
  ms: number;
  samples?: number;
  phase: string;
  // Une position au sommet : ses valeurs s'ajoutent au passage, en cloche, nulles au décollage et à la réception.
  apex?: ControlPatch;
  // Le corps tourne en l'air : les jambes suivent le repère du bassin.
  rotate?: boolean;
  id?: string;
  face?: KeyDraft["face"];
};

// Les clés intérieures du vol. La clé de réception se décrit à part : sa transition dure `ms / samples`.
export const airborne = (base: ControlPatch, rig: Rig, flight: Flight): KeyDraft[] => {
  const samples = flight.samples ?? 8;
  const [a, b] = [settle(base, flight.from, rig), settle(base, flight.to, rig)];
  const seconds = flight.ms / 1000;
  const keys: KeyDraft[] = [];
  for (let i = 1; i < samples; i += 1) {
    const u = i / samples;
    const bell = Math.sin(Math.PI * u);
    const set = {} as Controls;
    for (const channel of Object.keys(a) as Channel[]) {
      const anchor = RELATIVE[channel];
      if (anchor) continue;
      set[channel] = a[channel] + (b[channel] - a[channel]) * u;
      const top = flight.apex?.[channel];
      if (top !== undefined) set[channel] += bell * top;
    }
    // Le bassin : en ligne droite à l'horizontale, en parabole à la verticale.
    set.pelvisY = a.pelvisY + (b.pelvisY - a.pelvisY) * u + (GRAVITY * seconds * seconds * u * (1 - u)) / 2;
    // Les pieds : leur écart au bassin passe d'une position à l'autre.
    for (const [channel, anchor] of Object.entries(RELATIVE) as [Channel, Channel][]) {
      const offset = a[channel] - a[anchor] + (b[channel] - b[anchor] - (a[channel] - a[anchor])) * u;
      set[channel] = set[anchor] + offset + bell * (flight.apex?.[channel] ?? 0);
    }
    // Un corps qui tourne en l'air (un saut à la barre) : les jambes suivent le bassin, dans son repère.
    if (flight.rotate)
      for (const side of SIDES) {
        const k = side === "R" ? 1 : -1;
        const local = (c: Controls) => {
          const frame = pelvisFrame(c);
          const d = vec(c[`foot${side}X`] - c.pelvisX, c[`foot${side}Lift`] - c.pelvisY, c[`foot${side}Z`] - c.pelvisZ);
          return vec(dot(d, frame.f), dot(d, frame.u), dot(d, frame.s));
        };
        const [la, lb] = [local(a), local(b)];
        const l = vec(la.x + (lb.x - la.x) * u, la.y + (lb.y - la.y) * u, la.z + (lb.z - la.z) * u);
        const frame = pelvisFrame(set);
        const ball = along(vec(set.pelvisX, set.pelvisY, set.pelvisZ), frame, l.x, l.y, l.z);
        set[`foot${side}X`] = ball.x;
        set[`foot${side}Lift`] = ball.y;
        set[`foot${side}Z`] = ball.z;
        // Le pied tourne avec le bassin ; le genou se plie vers l'avant du bassin.
        set[`foot${side}Yaw`] = a[`foot${side}Yaw`] + k * (set.pelvisYaw - a.pelvisYaw);
        // La pointe garde son angle avec le bassin : le talon se compte depuis la bascule du bassin.
        const heel = (c: Controls) => c[`foot${side}Heel`] - c.pelvisPitch;
        set[`foot${side}Heel`] = heel(a) + (heel(b) - heel(a)) * u + set.pelvisPitch;
        const turned = yaw(WORLD, k * (set[`foot${side}Yaw`] + set[`knee${side}Out`]));
        set[`knee${side}Forward`] = dot(frame.f, turned.f);
        set[`knee${side}Up`] = dot(frame.f, turned.u);
        set[`knee${side}Side`] = k * dot(frame.f, turned.s);
      }
    keys.push({
      id: `${flight.id ?? flight.phase}-${i}`,
      set,
      air: ["R", "L"],
      ...(flight.face ? { face: flight.face } : {}),
      move: { ms: flight.ms / samples, curve: "linear", phase: flight.phase },
    });
  }
  return keys;
};
