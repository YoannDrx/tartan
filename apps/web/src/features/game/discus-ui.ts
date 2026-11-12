import { PHASE, TURN, discus, type DiscusState } from "@tartan/game/events/discus";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import { drawDiscus } from "./discus-scene";

const t = m.game.events.discus;
// Tours effectués, en dixièmes, et vitesse de rotation en tours par seconde.
const turns = (state: DiscusState) => Math.floor((state.rotation * 10) / TURN) / 10;
const spinPerSecond = (state: DiscusState) => (state.spin * 120) / TURN;

export const discusUi: EventUi<DiscusState> = {
  id: "discus",
  sim: discus,
  recordKey: "tartan.jeu.disque.record",
  action: t.action,
  canvasLabel: t.canvas,
  draw: (ctx, size, state) => drawDiscus(ctx, size, state),
  hud: (state) => [
    { label: t.spin, value: t.spinValue(state.phase === PHASE.flight ? 0 : spinPerSecond(state)) },
    { label: t.turns, value: t.turnsValue(turns(state)) },
    {
      label: t.phase,
      value:
        state.phase === PHASE.waiting
          ? t.phases.waiting
          : state.phase === PHASE.spinning
            ? t.phases.spinning
            : t.phases.flight,
    },
  ],
  headline: (state) =>
    state.overturned ? t.overturned : state.foul ? t.foul : t.result(m.game.distance(state.score ?? 0)),
  details: (state) => (state.foul || state.overturned ? [] : [{ label: t.turns, value: t.turnsValue(turns(state)) }]),
  formatScore: (score) => m.game.distance(score),
  counts: (score) => score > 0,
};
