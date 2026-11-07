import {
  detailedSetInput,
  type AthleteSessionDetail,
  type DetailedSetInput,
  type PerformedSetDraftRow,
  type PerformedSetsDraft,
  type ResolvedItem,
} from "@tartan/contracts";

export const performedNumberFields = ["reps", "loadKg", "distanceM", "timeS", "groundContacts"] as const;
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
