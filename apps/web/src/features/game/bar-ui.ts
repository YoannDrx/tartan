import type { GameEvent } from "@tartan/game";
import { type HighJumpState as BarState, MAX_FAILS, OUTCOME } from "@tartan/game/events/high-jump";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import type { SceneSize } from "./hurdles-scene";

// Ce qu'ont en commun les deux concours à barre (hauteur, perche) : le bandeau, le résultat, le record.
type BarTexts = (typeof m.game.events)["highJump" | "poleVault"];

export const barUi = (options: {
  id: string;
  sim: GameEvent<BarState>;
  recordKey: string;
  texts: BarTexts;
  draw: (ctx: CanvasRenderingContext2D, size: SceneSize, state: BarState) => void;
}): EventUi<BarState> => {
  const t = options.texts;
  const outcome = (value: number) =>
    value === OUTCOME.cleared
      ? t.outcomes.cleared
      : value === OUTCOME.failed
        ? t.outcomes.failed
        : value === OUTCOME.balked
          ? t.outcomes.balked
          : "–";
  return {
    id: options.id,
    sim: options.sim,
    recordKey: options.recordKey,
    action: t.action,
    canvasLabel: t.canvas,
    draw: (ctx, size, state) => options.draw(ctx, size, state),
    hud: (state) => [
      { label: t.bar, value: m.game.distance(state.bar) },
      { label: t.attempt, value: t.attemptValue(Math.min(MAX_FAILS, state.fails + 1)) },
      { label: t.last, value: outcome(state.outcome) },
    ],
    headline: (state) => (state.best > 0 ? t.result(m.game.distance(state.best)) : t.none),
    details: (state) => [{ label: t.attempts, value: String(state.attempts) }],
    formatScore: (score) => m.game.distance(score),
    counts: (score) => score > 0,
  };
};
