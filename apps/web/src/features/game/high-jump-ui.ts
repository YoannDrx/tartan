import { MAX_FAILS, OUTCOME, highJump, type HighJumpState } from "@tartan/game/events/high-jump";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import { drawHighJump } from "./high-jump-scene";

const t = m.game.events.highJump;
const outcomeLabel = (outcome: number) =>
  outcome === OUTCOME.cleared
    ? t.outcomes.cleared
    : outcome === OUTCOME.failed
      ? t.outcomes.failed
      : outcome === OUTCOME.balked
        ? t.outcomes.balked
        : "–";

export const highJumpUi: EventUi<HighJumpState> = {
  id: "highJump",
  sim: highJump,
  recordKey: "tartan.jeu.hauteur.record",
  action: t.action,
  canvasLabel: t.canvas,
  draw: (ctx, size, state) => drawHighJump(ctx, size, state),
  hud: (state) => [
    { label: t.bar, value: m.game.distance(state.bar) },
    { label: t.attempt, value: t.attemptValue(Math.min(MAX_FAILS, state.fails + 1)) },
    { label: t.last, value: outcomeLabel(state.outcome) },
  ],
  headline: (state) => (state.best > 0 ? t.result(m.game.distance(state.best)) : t.none),
  details: (state) => [{ label: t.attempts, value: String(state.attempts) }],
  formatScore: (score) => m.game.distance(score),
  counts: (score) => score > 0,
};
