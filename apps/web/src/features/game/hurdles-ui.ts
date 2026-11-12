import { GRADE, clockMs, hurdles, type HurdlesState } from "@tartan/game/events/hurdles";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import { drawHurdles } from "./hurdles-scene";

const t = m.game.events.hurdles;
const count = (state: HurdlesState, grades: number[]) => state.hurdles.filter((g) => grades.includes(g)).length;

export const hurdlesUi: EventUi<HurdlesState> = {
  id: "hurdles",
  sim: hurdles,
  recordKey: "tartan.jeu.haies.record",
  action: t.action,
  canvasLabel: t.canvas,
  draw: (ctx, size, state, family) => drawHurdles(ctx, size, state, m.game.metres, family),
  hud: (state) => [
    { label: m.game.clock, value: m.game.seconds(clockMs(state.tick)) },
    { label: m.game.wind, value: m.game.windValue(state.wind) },
    { label: t.cleared, value: t.clearedValue(state.next) },
  ],
  headline: (state) => t.result(m.game.seconds(state.score ?? 0)),
  details: (state) => [
    { label: t.grades.perfect, value: String(count(state, [GRADE.perfect])) },
    { label: t.grades.good, value: String(count(state, [GRADE.good])) },
    { label: t.grades.touched, value: String(count(state, [GRADE.early, GRADE.late])) },
    { label: t.grades.down, value: String(count(state, [GRADE.clipped, GRADE.crashed])) },
  ],
  formatScore: (score) => m.game.seconds(score),
  counts: (score) => score > 0,
};
