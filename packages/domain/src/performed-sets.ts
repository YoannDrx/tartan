import {
  detailedSetInput,
  type AthleteSessionDetail,
  type DetailedSetInput,
  type PerformedSetDraftRow,
  type PerformedSetsDraft,
  type PerformedDraftResolution,
  type ResolvedItem,
} from "@tartan/contracts";

export const performedNumberFields = ["reps", "loadKg", "distanceM", "timeS", "groundContacts"] as const;
export const performedSetsKey = (userId: string, orgId: string, sessionId: string, athleteId?: string): string =>
  `tartan.performed.v1.${userId}.${orgId}.${sessionId}${athleteId ? `.athlete.${athleteId}` : ""}`;
export type PerformedNumberField = (typeof performedNumberFields)[number];
const text = (value: number | null | undefined): string => (value == null ? "" : String(value));

export const proposedSet = (item: ResolvedItem, setIndex: number): PerformedSetDraftRow => ({
  itemRef: item.ref,
  setIndex,
  done: false,
  setKind: "work",
  loadKind:
    item.strengthLoadKind === "bodyweight"
      ? "bodyweight"
      : item.strengthLoadKind === "assistance"
        ? "assisted"
        : item.strengthLoadKind === "external_total" || item.strengthLoadKind === "added_weight"
          ? "external"
          : "",
  repetitionScope: "total",
  sideCount: 1,
  reps: text(item.prescription.reps),
  loadKg: text(item.resolvedLoadKg),
  distanceM: text(item.prescription.distance_m),
  timeS: text(item.prescription.duration_s),
  groundContacts: text(item.prescription.ground_contacts),
});

export const draftFromSession = (session: AthleteSessionDetail): PerformedSetsDraft => ({
  format: 1,
  sessionVersion: session.sessionVersion ?? 1,
  logVersion: session.log?.version ?? 0,
  variant: session.variant,
  status: session.log?.status === "done" ? "done" : "partial",
  rows: session.blocks.flatMap((block) =>
    block.items.flatMap((item) => {
      const saved = (session.log?.detailedSets ?? []).filter((row) => row.itemRef === item.ref);
      const count = Math.max(item.prescription.sets ?? 1, ...saved.map((row) => row.setIndex + 1));
      return Array.from({ length: count }, (_, setIndex) => {
        const row = saved.find((set) => set.setIndex === setIndex);
        return row
          ? {
              ...row,
              reps: text(row.reps),
              loadKg: text(row.loadKg),
              distanceM: text(row.distanceM),
              timeS: text(row.timeS),
              groundContacts: text(row.groundContacts),
            }
          : proposedSet(item, setIndex);
      });
    }),
  ),
});

export type PerformedSetIssue = {
  itemRef: string;
  setIndex: number;
  field: PerformedNumberField | "loadKind" | "row";
  code: "number" | "convention" | "measurement" | "invalid";
};

// Une case proposée n'est jamais une réalisation. Aucune conversion du poids du corps,
// de l'assistance ou des répétitions par côté n'est devinée par le client.
export const confirmedSets = (draft: PerformedSetsDraft): { sets: DetailedSetInput[]; issues: PerformedSetIssue[] } => {
  const sets: DetailedSetInput[] = [];
  const issues: PerformedSetIssue[] = [];
  for (const row of draft.rows.filter((set) => set.done)) {
    const numbers: Partial<Record<PerformedNumberField, number | null>> = {};
    const before = issues.length;
    for (const field of performedNumberFields) {
      const value = row[field].trim().replace(",", ".");
      if (!value) numbers[field] = null;
      else if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
        issues.push({ itemRef: row.itemRef, setIndex: row.setIndex, field, code: "number" });
      } else numbers[field] = Number(value);
    }
    if (!row.loadKind)
      issues.push({ itemRef: row.itemRef, setIndex: row.setIndex, field: "loadKind", code: "convention" });
    if ([numbers.reps, numbers.distanceM, numbers.timeS, numbers.groundContacts].every((n) => n == null || n === 0)) {
      issues.push({ itemRef: row.itemRef, setIndex: row.setIndex, field: "row", code: "measurement" });
    }
    if (row.loadKind === "bodyweight" && numbers.loadKg !== null) {
      issues.push({ itemRef: row.itemRef, setIndex: row.setIndex, field: "loadKg", code: "invalid" });
    }
    if (issues.length !== before) continue;
    const parsed = detailedSetInput.safeParse({ ...row, ...numbers });
    if (parsed.success) sets.push(parsed.data);
    else
      for (const issue of parsed.error.issues) {
        const field = performedNumberFields.find((f) => f === issue.path[0]) ?? "row";
        issues.push({ itemRef: row.itemRef, setIndex: row.setIndex, field, code: "invalid" });
      }
  }
  return { sets, issues };
};

// Comparaison exacte, sans hash approximatif : une modification non envoyée,
// même sur une série non cochée, ne doit jamais être jetée avec une ancienne file.
export const performedDraftContent = (draft: PerformedSetsDraft): string =>
  JSON.stringify([
    draft.sessionVersion,
    draft.logVersion,
    draft.variant,
    draft.status,
    draft.rows.map((row) => [
      row.itemRef,
      row.setIndex,
      row.done,
      row.setKind,
      row.loadKind,
      row.repetitionScope,
      row.sideCount,
      row.reps,
      row.loadKg,
      row.distanceM,
      row.timeS,
      row.groundContacts,
    ]),
  ]);
export const resolvedDraftReceipt = (
  draft: PerformedSetsDraft,
  observedIds: string[],
  replacementClientId: string | null,
  previous?: PerformedDraftResolution | null,
): PerformedDraftResolution | null => {
  const content = performedDraftContent(draft);
  if (!draft.submittedClientId || draft.submittedContent !== content) return null;
  const followsPrevious =
    previous?.submittedClientId === draft.submittedClientId &&
    previous.content === content &&
    previous.replacementClientId &&
    observedIds.includes(previous.replacementClientId);
  if (!observedIds.includes(draft.submittedClientId) && !followsPrevious) return null;
  return { submittedClientId: draft.submittedClientId, content, replacementClientId };
};
export const isResolvedDraft = (
  draft: PerformedSetsDraft,
  receipt: PerformedDraftResolution | null | undefined,
  serverClientId?: string | null,
): boolean =>
  Boolean(
    receipt &&
    receipt.submittedClientId === draft.submittedClientId &&
    receipt.content === performedDraftContent(draft) &&
    (receipt.replacementClientId === null || receipt.replacementClientId === serverClientId),
  );

// Seulement après comparaison explicite. Une version de prescription différente
// ne prouve pas l'identité des exercices : on ne déplace jamais les anciennes séries.
export const rebasePerformedDraft = (
  draft: PerformedSetsDraft,
  session: AthleteSessionDetail,
): {
  draft: PerformedSetsDraft | null;
  reason: "invalid" | "disabled" | "prescription" | "variant" | "exercise" | "access" | null;
} => {
  if (session.canRecordSets === false) return { draft: null, reason: "access" };
  if (session.sessionVersion === undefined) return { draft: null, reason: "invalid" };
  if (!session.progressionEnabled) return { draft: null, reason: "disabled" };
  if (draft.sessionVersion !== session.sessionVersion) return { draft: null, reason: "prescription" };
  if (draft.variant !== session.variant) return { draft: null, reason: "variant" };
  const refs = new Set(session.blocks.flatMap((block) => block.items.map((item) => item.ref)));
  if (draft.rows.some((row) => !refs.has(row.itemRef))) return { draft: null, reason: "exercise" };
  return {
    draft: {
      format: 1,
      sessionVersion: session.sessionVersion,
      logVersion: session.log?.version ?? 0,
      variant: draft.variant,
      status: draft.status,
      rows: draft.rows.map((row) => ({ ...row })),
    },
    reason: null,
  };
};
