import { sessionLogInput, type AthleteSessionDetail, type SessionLogInput } from "@tartan/contracts";

export type LogReviewReason = "invalid" | "prescription" | "variant" | "exercise" | "disabled";
export type LogReview = { input: Omit<SessionLogInput, "clientId">; reason: LogReviewReason | null };

// Relecture explicite uniquement : ce résultat n'est jamais envoyé par le synchroniseur.
// On ne rattache pas des séries à une prescription révisée dont l'ancienne identité
// d'exercice n'est pas connue du client. Les valeurs restent visibles pour comparaison.
export const reviewSessionLogs = (session: AthleteSessionDetail, changes: unknown[]): LogReview => {
  const input: Omit<SessionLogInput, "clientId"> = {
    writeScope: "all",
    status: session.log?.status === "done" ? "done" : "partial",
    variantDone: session.variant,
    expectedVersion: session.log?.version ?? 0,
    expectedSessionVersion: session.sessionVersion,
    rpe: session.log?.rpe ?? null,
    pain: session.log?.pain ?? null,
    durationMin: session.log?.durationMin ?? null,
    comment: session.log?.comment ?? null,
    sets: [],
  };
  let reason: LogReviewReason | null =
    session.sessionVersion === undefined || session.healthConsent === undefined ? "invalid" : null;
  const refs = new Set(session.blocks.flatMap((block) => block.items.map((item) => item.ref)));
  for (const raw of changes) {
    const parsed = sessionLogInput.safeParse(raw);
    if (!parsed.success) {
      reason = "invalid";
      continue;
    }
    const change = parsed.data;
    input.status = change.status;
    if (change.variantDone !== session.variant) reason = "variant";
    const carriesSets = change.detailedSets !== undefined || change.sets.length > 0;
    if (carriesSets && change.expectedSessionVersion !== session.sessionVersion) reason = "prescription";
    if ((change.detailedSets ?? change.sets).some((set) => !refs.has(set.itemRef))) reason = "exercise";
    if (change.detailedSets !== undefined) {
      input.detailedSets = change.detailedSets;
      input.sets = [];
      if (!session.progressionEnabled) reason = "disabled";
    } else if (change.sets.length && input.detailedSets === undefined) input.sets = change.sets;
    if (change.writeScope === "status" || change.writeScope === "sets") continue;
    for (const field of ["rpe", "pain", "durationMin", "comment"] as const) {
      if (change.writeScope === "feedback" && change[field] === undefined) continue;
      // Affectations explicites : aucun champ libre du payload n'est transmis.
      if (field === "rpe") input.rpe = change.rpe ?? null;
      if (field === "pain") input.pain = change.pain ?? null;
      if (field === "durationMin") input.durationMin = change.durationMin ?? null;
      if (field === "comment") input.comment = change.comment ?? null;
    }
  }
  if (!session.healthConsent) {
    input.rpe = null;
    input.pain = null;
  }
  return { input, reason };
};
