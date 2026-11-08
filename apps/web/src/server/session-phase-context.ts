import { sessionPhaseReview, uuid, type SaveScheduledSessionInput } from "@tartan/contracts";
import { phasePlanningKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { Access } from "./access";
import { preparePhasePlanning } from "./training-phases.service";

// Stored server-only: no names, descriptions, private notes or health. Never serialize to athlete responses.
export const storedPhaseContext = z.object({
  format: z.literal(1),
  key: z.string(),
  review: sessionPhaseReview,
  athletes: z.array(
    z.object({ athleteId: uuid, phaseId: uuid.nullable(), phaseVersion: z.number().int().positive().nullable() }),
  ),
});
export type StoredPhaseContext = z.infer<typeof storedPhaseContext>;
export const sessionPhaseKey = (input: Pick<SaveScheduledSessionInput, "date" | "assignments">) =>
  phasePlanningKey(
    input.date,
    input.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
    input.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
  );
export async function reviewSessionPhases(
  db: Prisma.TransactionClient,
  access: Access,
  input: Pick<SaveScheduledSessionInput, "date" | "assignments" | "phaseReview">,
  previous: unknown,
  requireResolved: boolean,
): Promise<StoredPhaseContext | null> {
  const key = sessionPhaseKey(input);
  const parsed = storedPhaseContext.safeParse(previous);
  const retained = parsed.success && parsed.data.key === key ? parsed.data : null;
  const org = await db.organization.findUniqueOrThrow({
    where: { id: access.organizationId },
    select: { phasesEnabled: true },
  });
  // Emergency/rollout flag: manual session work remains available. A changed audience/date invalidates old context.
  if (!org.phasesEnabled) return retained;
  // A plain draft remains saveable during a stale/offline phase preview. Publication rechecks it.
  if (!input.phaseReview && !requireResolved) return retained;
  const review = input.phaseReview ?? retained?.review;
  if (!review && !requireResolved) return null;
  const result = await preparePhasePlanning(
    access,
    {
      date: input.date,
      groupIds: input.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
      athleteIds: input.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
      choices: review?.choices ?? [],
    },
    db,
  );
  if (review && review.token !== result.token)
    throw new AppError(409, "phase_context_conflict", m.trainingPhases.contextChanged);
  if (result.athletes.some((a) => a.result.kind === "choose_group")) {
    if (requireResolved || review) throw new AppError(409, "phase_choice_required", m.trainingPhases.reviewRequired);
    return null;
  }
  return {
    format: 1,
    key,
    review: { token: result.token, choices: review?.choices ?? [] },
    athletes: result.athletes.map((a) => ({
      athleteId: a.id,
      phaseId: a.result.kind === "phase" ? a.result.phase.id : null,
      phaseVersion: a.result.kind === "phase" ? a.result.phase.version : null,
    })),
  };
}
