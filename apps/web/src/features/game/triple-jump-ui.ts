import { TAP_MAX, angleOf } from "@tartan/game/events/long-jump";
import { GRADE, HOP_MAX_ANGLE, PHASE, tripleJump, type TripleJumpState } from "@tartan/game/events/triple-jump";
import { m } from "@tartan/i18n";
import type { EventUi } from "./event-ui";
import { drawTripleJump } from "./triple-jump-scene";

const t = m.game.events.tripleJump;
const gradeLabel = (grade: number) =>
  grade === GRADE.perfect
    ? t.grades.perfect
    : grade === GRADE.good
      ? t.grades.good
      : grade === GRADE.ok
        ? t.grades.ok
        : "–";
const phaseLabel = (state: TripleJumpState) =>
  state.phase === PHASE.hop
    ? t.phases.hop
    : state.phase === PHASE.step
      ? t.phases.step
      : state.phase === PHASE.jump
        ? t.phases.jump
        : t.phases.run;

export const tripleJumpUi: EventUi<TripleJumpState> = {
  id: "tripleJump",
  sim: tripleJump,
  recordKey: "tartan.jeu.triple.record",
  action: t.action,
  canvasLabel: t.canvas,
  draw: (ctx, size, state, family) => drawTripleJump(ctx, size, state, m.game.metres, family),
  hud: (state) => [
    { label: t.speed, value: m.game.events.longJump.speedValue(state.phase === PHASE.run ? state.v : state.speed) },
    {
      label: t.phase,
      value:
        state.phase === PHASE.run && state.hold > TAP_MAX
          ? m.game.events.longJump.angleValue(Math.min(HOP_MAX_ANGLE, angleOf(state.hold)))
          : phaseLabel(state),
    },
    { label: m.game.wind, value: m.game.windValue(state.wind) },
  ],
  headline: (state) =>
    state.foul
      ? m.game.events.longJump.foul
      : state.broken
        ? t.broken
        : state.short
          ? m.game.events.longJump.short
          : m.game.events.longJump.result(m.game.distance(state.score ?? 0)),
  details: (state) =>
    state.foul || state.takeoffX < 0
      ? []
      : [
          // Seuls les bonds faits et les réceptions jouées : un rythme cassé n'affiche pas de bond vide.
          ...[t.phases.hop, t.phases.step, t.phases.jump].flatMap((label, index) =>
            (state.bounds[index] ?? 0) > 0 && index < state.phase
              ? [{ label, value: m.game.distance(state.bounds[index] ?? 0) }]
              : [],
          ),
          ...((state.grades[0] ?? 0) !== GRADE.none
            ? [
                {
                  label: t.landings,
                  value: state.grades
                    .filter((g) => g !== GRADE.none)
                    .map(gradeLabel)
                    .join(", "),
                },
              ]
            : []),
        ],
  formatScore: (score) => m.game.distance(score),
  counts: (score) => score > 0,
};
