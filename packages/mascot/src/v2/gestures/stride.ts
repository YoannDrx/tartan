// Le générateur de foulée : une course, une marche technique ou un éducatif, décrit par quelques paramètres
// (cadence, longueur de pas, hauteur du genou, retour du talon, part de vol), plutôt qu'écrit clé par clé.
// L'athlète court sur place et le sol défile sous lui (gesture.ts) : un pied en appui recule à la vitesse du sol,
// de la pose du pied à son décollage. Une boucle fait deux pas, droit puis gauche ; la seconde moitié est le
// miroir de la première, la boucle se referme d'elle-même.
// Chaque pas : la pose du pied devant le bassin, l'appui (le bassin au plus bas, la jambe libre qui passe sous
// lui, talon haut), la poussée (talon levé, genou libre devant), puis le vol, en parabole sous la gravité.
// Les jambes se placent par l'angle de la cuisse et la flexion du genou ; le pied reste perpendiculaire au tibia.
import { FIGURE } from "../body";
import { gesture, type KeyDraft } from "../gesture";
import { BALL_X, STAND, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { solve } from "../solve";
import { airborne } from "./flight";

const RIG = { bar: null };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

export type Stride = {
  key: string;
  athlete: Parameters<typeof gesture>[0]["athlete"];
  // Pas par minute (les deux jambes comptées), et longueur d'un pas en unités du corps (environ 5,4 mm).
  cadence: number;
  step: number;
  // La part du pas passée en l'air (0 : une marche, toujours un pied au sol).
  flight: number;
  // La cuisse de la jambe libre, au plus haut, en degrés devant la verticale ; le talon, au plus près des
  // fesses, en degrés de flexion du genou.
  knee: number;
  heel: number;
  // Le buste penché vers l'avant, en degrés ; l'amplitude du balancier des bras, de 0 à 1 ; l'enfoncement du bassin
  // à l'appui, en unités.
  lean: number;
  arms: number;
  sink: number;
  // La pose du pied, devant le bassin, en unités ; la jambe d'appui à la pose, en degrés de flexion du genou.
  reach?: number;
  // Les lignes du guide : pose du pied droit, appui, poussée, vol (les positions illustrées, dans cet ordre).
  guides?: readonly [number, number, number, number];
};

// Une jambe libre : la cuisse à `thigh` degrés devant la verticale, le genou fléchi de `knee` degrés ; le pied
// dans le prolongement perpendiculaire du tibia, la pointe légèrement tendue (`point` degrés).
const freeLeg = (
  side: "R" | "L",
  hip: { x: number; y: number },
  thigh: number,
  knee: number,
  point = 10,
): ControlPatch => {
  const t = rad(thigh);
  const kneeAt = { x: hip.x + FIGURE.thigh * Math.sin(t), y: hip.y - FIGURE.thigh * Math.cos(t) };
  const s = rad(thigh - knee);
  const ankle = { x: kneeAt.x + FIGURE.shin * Math.sin(s), y: kneeAt.y - FIGURE.shin * Math.cos(s) };
  const heel = knee - thigh + point;
  const h = rad(heel);
  const ball = {
    x: ankle.x + FIGURE.foot.ball * Math.cos(h) - FIGURE.ankle * Math.sin(h),
    y: ankle.y - FIGURE.foot.ball * Math.sin(h) - FIGURE.ankle * Math.cos(h),
  };
  return {
    [`foot${side}X`]: ball.x,
    [`foot${side}Lift`]: Math.max(1, ball.y),
    [`foot${side}Heel`]: heel,
  };
};

export const strideClip = (stride: Stride) => {
  const period = 60 / stride.cadence;
  const speed = stride.step / period;
  const contact = period * (1 - stride.flight);
  const air = period * stride.flight;
  const reach = stride.reach ?? 0.42 * stride.step * (1 - stride.flight * 0.5);
  // Juste avant la pose et juste après le décollage, le pied voyage déjà à la vitesse du sol : l'appui ne glisse
  // ni à la pose ni au décollage. Le vol occupe le reste du temps passé en l'air.
  const lead = 0.015;
  const flightMs = 1000 * air - 2000 * lead;
  if (flightMs < 40) throw new Error(`${stride.key} : le générateur de foulée demande un temps de vol.`);
  const samples = Math.max(5, Math.round(flightMs / 18));
  // Le bassin : sa hauteur jambes tendues, puis un peu plus bas à la pose, au plus bas à l'appui.
  const tall = solve({ ...STAND, pelvisX: -8 }, RIG).pelvis.y;
  const pelvisX = -6 + stride.lean * 0.6;
  const hip = (y: number) => ({ x: pelvisX, y });
  const z = { R: 15, L: -15 };
  const lean: ControlPatch = { pelvisX, pelvisPitch: stride.lean, lumbar: -2, neck: -stride.lean * 0.7 };
  // Les bras opposés aux jambes, coudes pliés : `swing` de -1 (bras droit devant) à 1 (bras droit derrière).
  const armsAt = (swing: number): ControlPatch => {
    const a = stride.arms;
    return {
      handRForward: 18 - 34 * a * swing,
      handRUp: -96 + 14 * a * Math.abs(swing),
      handROut: 30,
      handLForward: 18 + 34 * a * swing,
      handLUp: -96 + 14 * a * Math.abs(swing),
      handLOut: 30,
      elbowRForward: -1,
      elbowRUp: -0.6,
      elbowROut: 0.3,
      elbowLForward: -1,
      elbowLUp: -0.6,
      elbowLOut: 0.3,
    };
  };

  // Le pas du pied `side` : les positions de l'appui, puis celles du vol (le pied `other` vient se poser).
  const stepOf = (side: "R" | "L", first: boolean): KeyDraft[] => {
    const other = side === "R" ? "L" : "R";
    const mirror = side === "R" ? 1 : -1;
    const name = side === "R" ? "right" : "left";
    const stance = (x: number, heel: number): ControlPatch => ({
      [`foot${side}X`]: x,
      [`foot${side}Z`]: z[side],
      [`foot${side}Lift`]: 0,
      [`foot${side}Yaw`]: 6,
      [`foot${side}Heel`]: heel,
    });
    const otherZ = { [`foot${other}Z`]: z[other], [`foot${other}Yaw`]: 6 };
    const touchX = BALL_X + reach;
    const midX = touchX - (speed * contact) / 2;
    const offX = touchX - speed * contact;
    const yTouch = tall - stride.sink * 0.4;
    const yMid = tall - stride.sink;
    const yOff = tall - stride.sink * 0.15;
    const touch: ControlPatch = {
      ...lean,
      ...stance(touchX, 2),
      ...otherZ,
      // La jambe libre vient de quitter le sol : derrière le bassin à la course, presque dessous pour un éducatif.
      ...freeLeg(other, hip(yTouch), -18 * Math.min(1, stride.step / 160), Math.max(stride.heel * 0.6, 50)),
      pelvisY: yTouch,
      ...armsAt(mirror * 0.9),
    };
    const mid: ControlPatch = {
      ...lean,
      ...stance(midX, 0),
      ...otherZ,
      ...freeLeg(other, hip(yMid), stride.knee * 0.35, stride.heel),
      pelvisY: yMid,
      ...armsAt(0),
    };
    const off: ControlPatch = {
      ...lean,
      ...stance(offX, 34),
      ...otherZ,
      ...freeLeg(other, hip(yOff), stride.knee, Math.max(70, stride.heel * 0.75)),
      pelvisY: yOff,
      ...armsAt(-mirror * 0.9),
    };
    const before: ControlPatch = { ...touch, [`foot${side}X`]: touchX + speed * lead, [`foot${side}Lift`]: 2 };
    const after: ControlPatch = { ...off, [`foot${side}X`]: offX - speed * lead, [`foot${side}Lift`]: 2 };
    const guides = stride.guides;
    const line = (index: number) => (first && guides ? { guide: guides[index]! } : {});
    const keys: KeyDraft[] = [
      // La transition vers l'avant-pose est le dernier tronçon du vol.
      {
        id: `${name}-before`,
        set: before,
        air: ["R", "L"],
        move: { ms: flightMs / samples, curve: "linear", phase: "flight" },
      },
      {
        id: `${name}-touch`,
        ...line(0),
        ...(first ? { still: true } : {}),
        set: touch,
        air: [other],
        move: { ms: 1000 * lead, curve: "linear", phase: "flight" },
      },
      {
        id: `${name}-mid`,
        ...line(1),
        ...(first ? { still: true } : {}),
        set: mid,
        air: [other],
        move: { ms: (1000 * contact) / 2, curve: "linear", phase: "stance" },
      },
      {
        id: `${name}-off`,
        ...line(2),
        ...(first ? { still: true } : {}),
        set: off,
        air: [other],
        face: "effort",
        move: { ms: (1000 * contact) / 2, curve: "linear", phase: "stance" },
      },
      {
        id: `${name}-after`,
        set: after,
        air: ["R", "L"],
        move: { ms: 1000 * lead, curve: "linear", phase: "push" },
      },
    ];
    // Le vol : du décollage de `side` à l'avant-pose de `other`, sous la gravité.
    {
      const next = stepOf.cache?.[other];
      if (next) {
        const flight = airborne({}, RIG, {
          from: after,
          to: next,
          ms: flightMs,
          samples,
          phase: "flight",
          id: `${name}-flight`,
        });
        if (first && guides)
          flight[Math.floor(flight.length / 2)] = {
            ...flight[Math.floor(flight.length / 2)]!,
            guide: guides[3]!,
            still: true,
          };
        keys.push(...flight);
      }
    }
    return keys;
  };
  stepOf.cache = undefined as undefined | Record<"R" | "L", ControlPatch>;
  // Une première passe donne la position d'avant pose de chaque pied, qui termine le vol de l'autre.
  const draft = { R: stepOf("R", false), L: stepOf("L", false) };
  stepOf.cache = { R: draft.R[0]!.set!, L: draft.L[0]!.set! };
  const keys = [...stepOf("R", true), ...stepOf("L", false)];
  // La boucle commence à la pose du pied droit : la clé d'avant pose passe à la fin.
  const loop = [...keys.slice(1), keys[0]!];
  // Des repères au sol qui défilent à la vitesse du sol ; une boucle les fait avancer d'un nombre entier d'écarts.
  const travel = 2 * period * speed;
  const every = travel / Math.max(1, Math.round(travel / 150));
  const marks = (t: number): Prop[] => {
    const span = 1200;
    const shift = (((t * travel) % every) + every) % every;
    return Array.from({ length: span / every }, (_, i) => ({
      paint: "lane",
      shape: { kind: "rect", x: -span / 2 + i * every - shift, y: -2, width: 26, height: 6, radius: 2 },
      native: "side",
      at: 0,
      half: 30,
      scroll: true,
    }));
  };
  return gesture({ key: stride.key, athlete: stride.athlete, rig: RIG, keys: loop, treadmill: speed, props: marks });
};
