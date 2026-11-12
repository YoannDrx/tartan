import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import {
  BAR_STEP,
  FLIGHT_TICKS,
  OUTCOME,
  RESET_TICKS,
  STAGE,
  START_BAR,
  TAKEOFF_TICK,
  type HighJumpState,
} from "@tartan/game/events/high-jump";
import { m } from "@tartan/i18n";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { HIGH_JUMP_PHASES, HIGH_JUMP_STAGE } from "@tartan/mascot/high-jump";
import { HIGH_JUMP_BAR, HIGH_JUMP_CLIP } from "@tartan/mascot/high-jump-event";
import { drawProp, type PropShape } from "@tartan/mascot/props";
import type { SceneSize } from "./hurdles-scene";

// Une image du saut en hauteur : le geste de packages/mascot, cadré dans le canvas, son temps réglé par l'étape de
// l'essai. La barre monte avec les hauteurs, et l'arc du sauteur avec elle. Une barre tombée repose sur le tapis
// jusqu'à l'essai suivant ; une barre franchie se fête. Rien ici ne touche à la simulation : seulement l'image.

const PAINT = athletePaint("highJump", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("highJump", "neutral"),
  effort: athleteRig("highJump", "effort"),
  joy: athleteRig("highJump", "joy"),
};
const P = HIGH_JUMP_PHASES;
// Où se pose le dernier appui : un repère citron au sol, l'appel se règle dessus.
const PLANT_X = HIGH_JUMP_CLIP.frame(P.takeoff[0]).root.x;

// La barre monte de 10 unités de scène par cran de 5 cm, jusqu'à 2,35 m : au-delà, elle sortirait du cadre.
const LIFT_PER_STEP = 10;
const MAX_LIFT = 150;
export const barLift = (bar: number): number =>
  Math.min(MAX_LIFT, Math.max(0, Math.round((bar - START_BAR) / BAR_STEP) * LIFT_PER_STEP));

// Les ralentis : l'appel (fin de l'élan et début du vol), puis le franchissement, épaules puis jambes. Le relâchement
// se joue dans ce second tronçon : il y gagne du temps à l'écran, pas dans la simulation. Après l'essai, la réception
// prend son temps : la fête sur le tapis, ou la barre qui tombe.
export const SLOW = { takeoff: 0.4, clearance: 0.3, celebration: 0.35, fall: 0.6 } as const;
const TAKEOFF_LEAD = 30;
const TAKEOFF_TAIL = 14;
const CLEARANCE_END = 48;
export const highJumpTimeScale = (state: HighJumpState): number => {
  if (state.stage === STAGE.approach) return state.t >= TAKEOFF_TICK - TAKEOFF_LEAD ? SLOW.takeoff : 1;
  if (state.stage === STAGE.flight) {
    if (state.t < TAKEOFF_TAIL) return SLOW.takeoff;
    if (state.t < CLEARANCE_END) return SLOW.clearance;
  }
  if (state.stage === STAGE.reset) {
    if (state.outcome === OUTCOME.cleared) return SLOW.celebration;
    if (state.outcome === OUTCOME.failed) return SLOW.fall;
  }
  return 1;
};

// L'instant du geste, de 0 à 1, pour l'état de l'essai.
export const clipTime = (state: HighJumpState): number => {
  if (state.stage === STAGE.approach)
    return P.ready[1] + (P.takeoff[0] - P.ready[1]) * Math.min(1, state.t / TAKEOFF_TICK);
  if (state.stage === STAGE.flight)
    return P.takeoff[0] + (P.flight[1] - P.takeoff[0]) * Math.min(1, state.t / FLIGHT_TICKS);
  if (state.outcome === OUTCOME.balked) return P.gather[0];
  const u = Math.min(1, state.t / RESET_TICKS);
  return state.outcome === OUTCOME.cleared
    ? P.landing[0] + (1 - P.landing[0]) * u
    : P.landing[0] + (P.landing[1] - P.landing[0]) * u;
};

// L'arc du sauteur suit la barre : rien à l'appel ni à la réception, toute la hauteur au sommet.
export const arcLift = (t: number, lift: number): number => {
  if (t <= P.takeoff[0] || t >= P.flight[1]) return 0;
  const u = (t - P.takeoff[0]) / (P.flight[1] - P.takeoff[0]);
  return lift * Math.sin(Math.PI * u);
};

const raised = (shape: PropShape, lift: number): PropShape => {
  if (lift === 0 || shape.kind !== "line") return shape;
  if (shape.paint === "bar") {
    return { ...shape, from: { ...shape.from, y: shape.from.y - lift }, to: { ...shape.to, y: shape.to.y - lift } };
  }
  // Les poteaux s'allongent par le haut.
  if (shape.paint === "post") return { ...shape, to: { ...shape.to, y: shape.to.y - lift } };
  return shape;
};

const CONFETTI_MS = 1_800;
const CONFETTI_COLORS = [
  tokens.color.film.lime,
  tokens.color.film.sun,
  tokens.color.film.electric,
  tokens.color.film.matRed,
  tokens.band.text,
];
type Piece = { x: number; y: number; vx: number; vy: number; spin: number; color: string; size: number };

const confetti = (seed: number, origin: { x: number; y: number }): Piece[] => {
  let s = (seed * 2_654_435_761) >>> 0;
  const next = () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
  return Array.from({ length: 80 }, (_, index) => ({
    x: origin.x + (next() - 0.5) * 120,
    y: origin.y,
    vx: (next() - 0.5) * 900,
    vy: -380 - next() * 620,
    spin: (next() - 0.5) * 14,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]!,
    size: 10 + next() * 10,
  }));
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Un dessinateur garde ce qui dure plus qu'une image : la barre qui monte en douceur, et la fête d'une barre franchie.
export const createHighJumpPainter = () => {
  let shown: number | null = null;
  let lastFrame = 0;
  let celebrated = -1;
  let party: { start: number; pieces: Piece[]; height: number } | null = null;

  return (ctx: CanvasRenderingContext2D, size: SceneSize, state: HighJumpState, family = "sans-serif") => {
    const now = performance.now();
    const still = reducedMotion();
    const target = barLift(state.bar);
    // La barre monte pendant le retour au départ, en un peu plus d'une demi-seconde.
    if (shown === null || still || state.attempts === 0) shown = target;
    else shown += (target - shown) * Math.min(1, (now - lastFrame) / 180);
    lastFrame = now;
    const lift = Math.round(shown);

    if (state.attempts === 0) {
      celebrated = -1;
      party = null;
    }
    if (state.stage === STAGE.reset && state.outcome === OUTCOME.cleared && celebrated !== state.attempts) {
      celebrated = state.attempts;
      const { far, near } = HIGH_JUMP_BAR;
      party = {
        start: now,
        height: state.best,
        pieces: still ? [] : confetti(state.attempts, { x: (far.x + near.x) / 2, y: (far.y + near.y) / 2 - lift }),
      };
    }

    const { width, height } = size;
    const stage = HIGH_JUMP_CLIP.stage;
    const scale = Math.min(width / stage.width, height / stage.height);
    const left = (width - stage.width * scale) / 2;
    const top = (height - stage.height * scale) / 2;
    const t = clipTime(state);
    const { pose, root } = HIGH_JUMP_CLIP.frame(t);
    const fallen = state.stage === STAGE.reset && state.outcome === OUTCOME.failed;
    const shapes = HIGH_JUMP_CLIP.props(t).map((shape) =>
      // La barre tombée : posée sur le tapis, en travers.
      fallen && shape.paint === "bar" && shape.kind === "line"
        ? {
            ...shape,
            from: { x: HIGH_JUMP_BAR.far.x, y: HIGH_JUMP_STAGE.matTop - 4 },
            to: { x: HIGH_JUMP_BAR.near.x - 60, y: HIGH_JUMP_STAGE.matTop + 30 },
          }
        : raised(shape, lift),
    );

    ctx.fillStyle = tokens.band.background;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(scale, scale);
    for (const shape of shapes) if (!shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
    ctx.fillStyle = tokens.band.action;
    ctx.fillRect(PLANT_X - 40, HIGH_JUMP_STAGE.ground + 16, 80, 12);
    const face = HIGH_JUMP_CLIP.face(t);
    drawMascot(ctx, pose, {
      paint: PAINT,
      bones: BONES[fallen ? "neutral" : face],
      at: { x: root.x, y: root.y - arcLift(t, lift) },
    });
    for (const shape of shapes) if (shape.front) drawProp(ctx, shape, PROPS[shape.paint]);

    // La fête : la hauteur franchie en grand, et les confettis qui retombent sur le tapis.
    const elapsed = party ? now - party.start : Infinity;
    if (party && elapsed < CONFETTI_MS) {
      const seconds = elapsed / 1000;
      ctx.globalAlpha = Math.min(1, 2 * (1 - elapsed / CONFETTI_MS));
      ctx.fillStyle = tokens.band.text;
      ctx.font = `700 96px ${family}`;
      ctx.textAlign = "center";
      ctx.fillText(m.game.distance(party.height), stage.width / 2, 150);
      for (const piece of party.pieces) {
        const x = piece.x + piece.vx * seconds;
        const y = piece.y + piece.vy * seconds + 900 * seconds * seconds;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(piece.spin * seconds);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
};

export const drawHighJump = createHighJumpPainter();
