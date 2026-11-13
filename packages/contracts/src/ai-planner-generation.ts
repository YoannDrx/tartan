import { z } from "zod";
import { plannerItem, plannerInterpretation, plannerQuestion, plannerSession } from "./ai-planner";

// The model writes one ordered tree. IDs and the compatibility projection belong to the server.
const exercise = z.object({ kind: z.literal("exercise"), ...plannerItem.omit({ ref: true }).shape }).strict();
const recovery = z.object({ kind: z.literal("recovery"), durationS: z.number().int().min(1).max(3600) }).strict();
const leaf = z.discriminatedUnion("kind", [exercise, recovery]);
const repeat = z
  .object({
    kind: z.literal("repeat"),
    name: z.string().trim().min(1).max(80),
    rounds: z.number().int().min(2).max(50),
    restBetweenRoundsS: z.number().int().min(0).max(3600),
    children: z.array(leaf).min(1).max(60),
  })
  .strict();
const innerNode = z.discriminatedUnion("kind", [exercise, recovery, repeat]);
const outerRepeat = repeat.extend({ children: z.array(innerNode).min(1).max(60) });
export const plannerGenerationNode = z.discriminatedUnion("kind", [exercise, recovery, outerRepeat]);
export const plannerGeneration = plannerInterpretation.extend({
  questions: z.array(plannerQuestion.extend({ exerciseName: plannerQuestion.shape.exerciseName.unwrap() })).max(10),
  sessions: z
    .array(
      plannerSession.extend({
        blocks: z
          .array(
            z
              .object({
                name: z.string().min(1).max(80),
                content: z.array(plannerGenerationNode).min(1).max(60),
              })
              .strict(),
          )
          .min(1)
          .max(12),
      }),
    )
    .max(14),
});
export type PlannerGeneration = z.infer<typeof plannerGeneration>;
export type PlannerGenerationNode = z.infer<typeof plannerGenerationNode>;
