import { BOARD_X, TAP_MAX, UNITS_PER_MM, angleOf, longJump, type LongJumpState } from "@tartan/game/events/long-jump";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import { drawLongJump } from "./long-jump-scene";

const t = m.game.events.longJump;
// L'angle affiché : celui de l'appel une fois parti, sinon celui que donnerait le relâchement maintenant.
const shownAngle = (state: LongJumpState) =>
  state.takeoffX >= 0 || state.foul ? state.angle : state.hold > TAP_MAX ? angleOf(state.hold) : 0;

export const longJumpUi: EventUi<LongJumpState> = {
  id: "longJump",
  sim: longJump,
  recordKey: "tartan.jeu.longueur.record",
  action: t.action,
  canvasLabel: t.canvas,
  draw: (ctx, size, state, family) => drawLongJump(ctx, size, state, m.game.metres, family),
  hud: (state) => [
    { label: t.speed, value: t.speedValue(state.v) },
    { label: t.angle, value: t.angleValue(shownAngle(state)) },
    { label: m.game.wind, value: m.game.windValue(state.wind) },
  ],
  headline: (state) => (state.foul ? t.foul : state.short ? t.short : t.result(m.game.distance(state.score ?? 0))),
  details: (state) =>
    state.foul
      ? []
      : [
          { label: t.takeoff, value: t.angleValue(state.angle) },
          { label: t.speed, value: t.speedValue(state.v) },
          { label: t.board, value: t.boardValue(Math.round((BOARD_X - state.takeoffX) / UNITS_PER_MM / 10)) },
        ],
  formatScore: (score) => m.game.distance(score),
  counts: (score) => score > 0,
};
