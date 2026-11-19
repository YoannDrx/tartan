// Couchée sur le côté gauche, hanches et genoux fléchis, pieds superposés : Lina. Le corps est tourné d'un quart
// de tour, comme au gainage latéral : de profil, on le voit de face.
// - Ouverture de hanche : les pieds restent en contact, le genou du dessus s'ouvre vers le plafond, en tournant
//   autour de l'axe hanche-cheville, puis se referme lentement ; le bassin ne roule pas.
// - Rotation thoracique : les bras tendus devant ; le bras du dessus s'ouvre vers l'arrière, en arc, puis revient.
//   Le moteur n'a pas de rotation du buste sur le bassin : seul le bras s'ouvre, le thorax ne suit pas. C'est la
//   limite de ce geste dans ce moteur.
// Réglé à l'œil d'après les fiches du catalogue : aucune source ouverte pour ces gestes.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { STAND, type ControlPatch } from "../pose";
import { skin } from "../skin";
import { solve, type Side, type Solved } from "../solve";
import { add, cross, dot, normalize, pitch, roll, scale, sub, WORLD, yaw, type Vec3 } from "../vec";

const RIG = { bar: null };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// Le buste incliné de `tilt` degrés, couché sur le côté gauche, la poitrine vers +z, la tête vers +x.
const TILT = 8;
const HIP_FLEX = 50;
const KNEE = 95;
const lying: ControlPatch = {
  pelvisX: 0,
  pelvisY: 42,
  pelvisZ: 0,
  pelvisYaw: 90,
  pelvisRoll: -(90 - TILT),
  pelvisPitch: 0,
  neck: 0,
};
const BODY = solve({ ...STAND, ...lying, footRLift: 300, footLLift: 300 }, RIG);
const { pelvis: frame } = BODY.frames;

// Une jambe repliée : la cuisse fléchie de HIP_FLEX vers l'avant du corps, le tibia de KNEE de plus.
const legOf = (side: Side) => {
  const hip = BODY.legs[side].hip;
  const thigh = add(scale(frame.u, -Math.cos(rad(HIP_FLEX))), scale(frame.f, Math.sin(rad(HIP_FLEX))));
  const s = rad(HIP_FLEX - KNEE);
  const shin = add(scale(frame.u, -Math.cos(s)), scale(frame.f, Math.sin(s)));
  const knee = add(hip, scale(thigh, FIGURE.thigh - 1));
  const ankle = add(knee, scale(shin, FIGURE.shin - 1));
  return { hip, knee, ankle, shin };
};
// Le pôle d'un genou, donné dans le monde, dans le repère où solve.ts le lit (tourné de l'ouverture du pied).
const poleOf = (side: Side, pole: Vec3, footYaw: number): ControlPatch => {
  const k = side === "R" ? 1 : -1;
  const turned = yaw(WORLD, k * footYaw);
  return {
    [`knee${side}Forward`]: dot(pole, turned.f),
    [`knee${side}Up`]: dot(pole, turned.u),
    [`knee${side}Side`]: k * dot(pole, turned.s),
  };
};
// Le pied perpendiculaire au tibia, la pointe vers l'avant de la jambe : son repère se construit comme dans
// solve.ts, et l'avant-pied se place pour que la cheville tombe au bout du tibia.
const footOf = (side: Side): ControlPatch => {
  const { hip, knee, ankle, shin } = legOf(side);
  const k = side === "R" ? 1 : -1;
  const [yawAngle, rollAngle] = [k * 90, -k * (90 - TILT)];
  const frameOf = (heel: number) => pitch(roll(yaw(WORLD, k * yawAngle), k * rollAngle), heel);
  // Le talon qui aligne le haut du pied sur le tibia, remonté de la cheville vers le genou.
  let best = { heel: 0, score: -Infinity };
  for (let heel = -180; heel < 180; heel += 1) {
    const score = dot(frameOf(heel).u, scale(shin, -1));
    if (score > best.score) best = { heel, score };
  }
  const f = frameOf(best.heel);
  const ball = sub(add(ankle, scale(f.f, FIGURE.foot.ball)), scale(f.u, FIGURE.ankle));
  return {
    [`foot${side}X`]: ball.x,
    [`foot${side}Lift`]: ball.y,
    [`foot${side}Z`]: ball.z,
    [`foot${side}Yaw`]: yawAngle,
    [`foot${side}Roll`]: rollAngle,
    [`foot${side}Heel`]: best.heel,
    ...poleOf(side, sub(knee, scale(add(hip, ankle), 0.5)), yawAngle),
  };
};
// Le genou du dessus ouvert de `angle` degrés : son pôle tourne autour de l'axe hanche-cheville, vers le plafond.
const opened = (angle: number): ControlPatch => {
  const { hip, knee, ankle } = legOf("R");
  const axis = normalize(sub(ankle, hip));
  const pole = sub(knee, scale(add(hip, ankle), 0.5));
  const side = cross(axis, pole);
  const a = rad(angle);
  // La rotation, du côté qui fait monter le genou.
  const up = side.y >= 0 ? 1 : -1;
  const turned = add(scale(pole, Math.cos(a)), scale(side, up * Math.sin(a)));
  return poleOf("R", turned, 90);
};

// Le bras du dessous sous la tête, celui du dessus sur la hanche ; pour la rotation, les deux bras tendus devant.
const armsRest: ControlPatch = {
  handLForward: 14,
  handLUp: 40,
  handLOut: 6,
  handRForward: 4,
  handRUp: -92,
  handROut: 30,
  elbowLForward: 0.4,
  elbowLUp: 1,
  elbowLOut: 0.3,
  elbowRForward: -1,
  elbowRUp: 0,
  elbowROut: 0.6,
};
const base: ControlPatch = { ...lying, ...footOf("L"), ...footOf("R"), ...armsRest };

// Le corps posé : le bassin remonte juste assez pour que rien ne passe sous le sol.
const lowest = (body: Solved) =>
  Math.min(...skin(body).parts.flatMap((part) => part.spheres.map(({ c, r }) => c.y - r)));
const LIFT = -lowest(solve({ ...STAND, ...base }, RIG)) + 0.5;
const raise = (patch: ControlPatch): ControlPatch => ({
  ...patch,
  pelvisY: (patch.pelvisY ?? 0) + LIFT,
  footRLift: (patch.footRLift ?? 0) + LIFT,
  footLLift: (patch.footLLift ?? 0) + LIFT,
});
const rest = raise(base);

export const bandClamshell = gesture({
  key: "band-clamshell",
  athlete: "longJump",
  rig: RIG,
  base: rest,
  keys: [
    { id: "closed", guide: 0, set: opened(0), hold: 700, move: { ms: 900, curve: "reception", phase: "close" } },
    { id: "opening", guide: 1, set: opened(22), still: true, move: { ms: 500, curve: "elan", phase: "open" } },
    {
      id: "open",
      guide: 2,
      set: opened(42),
      hold: 500,
      face: "effort",
      move: { ms: 500, curve: "reception", phase: "open" },
    },
    { id: "closing", guide: 3, set: opened(20), still: true, move: { ms: 700, curve: "elan", phase: "close" } },
  ],
  // Le genou s'ouvre vers le plafond : il se lit depuis la tête, puis de dessus.
  views: ["front", "top"],
});

// --- Rotation thoracique au sol -------------------------------------------------------------------------------

// Le bras du dessus, tendu, sur un arc de `angle` degrés : devant (0), vers le plafond (90), en arrière (140).
const reachArc = (angle: number): ControlPatch => {
  const a = rad(angle);
  // Dans le repère du buste : vers l'avant (la poitrine), vers l'extérieur (le plafond, pour le bras droit).
  return {
    handRForward: 112 * Math.cos(a),
    handRUp: -14,
    handROut: -6 + 112 * Math.sin(a),
    elbowRForward: -Math.sin(a),
    elbowRUp: -0.3,
    elbowROut: Math.cos(a),
  };
};
const armsForward: ControlPatch = {
  handLForward: 108,
  handLUp: -16,
  handLOut: -10,
  elbowLForward: 0,
  elbowLUp: -0.4,
  elbowLOut: -1,
};
export const thoracicOpenBook = gesture({
  key: "thoracic-open-book",
  athlete: "longJump",
  rig: RIG,
  base: { ...rest, ...armsForward, neck: 4 },
  keys: [
    { id: "together", guide: 0, set: reachArc(0), hold: 800, move: { ms: 900, curve: "reception", phase: "close" } },
    { id: "lifting", guide: 1, set: reachArc(70), still: true, move: { ms: 900, curve: "elan", phase: "open" } },
    { id: "open", guide: 2, set: reachArc(100), hold: 700, move: { ms: 700, curve: "reception", phase: "open" } },
    { id: "returning", guide: 3, set: reachArc(60), still: true, move: { ms: 900, curve: "elan", phase: "close" } },
  ],
  views: ["front", "side"],
});
