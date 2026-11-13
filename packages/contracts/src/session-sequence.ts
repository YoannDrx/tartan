import { z } from "zod";

// Bornes structurelles avant toute récursion : même une entrée hostile ne peut
// provoquer un parcours de profondeur arbitraire.
export const sequenceRef = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const exercise = z.object({ kind: z.literal("exercise"), itemRef: sequenceRef }).strict();
const recovery = z
  .object({
    kind: z.literal("recovery"),
    ref: sequenceRef,
    durationS: z.number().int().min(1).max(3600),
  })
  .strict();
const atom = z.discriminatedUnion("kind", [exercise, recovery]);
const repeatFields = {
  kind: z.literal("repeat"),
  ref: sequenceRef,
  name: z.string().trim().min(1).max(80),
  rounds: z.number().int().min(2).max(50),
  restBetweenRoundsS: z.number().int().min(0).max(3600),
};
const innerRepeat = z.object({ ...repeatFields, children: z.array(atom).min(1).max(60) }).strict();
const outerRepeat = z
  .object({
    ...repeatFields,
    children: z
      .array(z.discriminatedUnion("kind", [exercise, recovery, innerRepeat]))
      .min(1)
      .max(60),
  })
  .strict();
export const sessionSequence = z.array(z.discriminatedUnion("kind", [exercise, recovery, outerRepeat])).max(60);
export type SessionSequence = z.infer<typeof sessionSequence>;
export type SequenceNode = SessionSequence[number];
export const executionRound = z.object({
  ref: sequenceRef,
  name: z.string(),
  round: z.number().int().positive(),
  rounds: z.number().int().positive(),
});
export type ExecutionRound = z.infer<typeof executionRound>;
export const MAX_SESSION_EXECUTION_STEPS = 500;
