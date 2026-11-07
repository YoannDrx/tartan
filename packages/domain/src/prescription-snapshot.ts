import {
  snapshotItem,
  type Prescription,
  type PrescriptionRefreshPreview,
  type SessionSnapshot,
} from "@tartan/contracts";
import { applyOverride, latestTest, resolveLoadKg, type StrengthTest } from "./charges";

type Reference = StrengthTest & NonNullable<SessionSnapshot["blocks"][number]["items"][number]["strengthReference"]>;
const sameLoad = (a: Prescription["load"], b: Prescription["load"]) =>
  a?.type === b?.type &&
  a?.value === b?.value &&
  (a?.type !== "pct_1rm" || (b?.type === "pct_1rm" && a.test === b.test));

// Un déplacement, une consigne ou un changement de maximum ne réécrit pas la charge.
// Modifier la prescription de charge constitue un nouveau choix explicite du coach.
export const freezePrescription = (
  snapshot: SessionSnapshot,
  references: Reference[],
  overrides: { itemRef: string; prescription: Prescription }[],
  previous?: SessionSnapshot,
): SessionSnapshot => {
  const oldItems = new Map(previous?.blocks.flatMap((b) => b.items.map((i) => [i.ref, i] as const)) ?? []);
  const adapted = new Map(overrides.map((o) => [o.itemRef, o.prescription]));
  return {
    ...snapshot,
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      items: block.items.map((item) => {
        const prescription = applyOverride(item.prescription, adapted.get(item.ref));
        const old = oldItems.get(item.ref);
        if (
          old &&
          old.exerciseId === item.exerciseId &&
          sameLoad(old.prescription.load, prescription.load) &&
          old.resolvedLoadKg !== undefined
        )
          return {
            ...item,
            prescription,
            resolvedLoadKg: old.resolvedLoadKg,
            strengthReference: old.strengthReference ?? null,
            ...(old.strengthLoadKind !== undefined ? { strengthLoadKind: old.strengthLoadKind } : {}),
            ...(old.loadStepKg !== undefined ? { loadStepKg: old.loadStepKg } : {}),
          };
        const key = prescription.load?.type === "pct_1rm" ? prescription.load.test : null;
        const source = key ? (latestTest(references, key) as Reference | null) : null;
        return {
          ...item,
          prescription,
          resolvedLoadKg: resolveLoadKg(prescription, references),
          strengthReference: source ? { ...source } : null,
        };
      }),
    })),
  };
};

// Action explicite : recalculer seulement les pourcentages du document individuel figé.
// Les kilogrammes absolus, adaptations et autres consignes restent identiques.
export const refreshPrescriptionLoads = (snapshot: SessionSnapshot, references: Reference[]) => {
  const changes: PrescriptionRefreshPreview["athletes"][number]["changes"] = [];
  const incompatible: PrescriptionRefreshPreview["athletes"][number]["incompatible"] = [];
  const next: SessionSnapshot = {
    ...snapshot,
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      items: block.items.map((item) => {
        const load = item.prescription.load;
        if (load?.type !== "pct_1rm") return item;
        const source = latestTest(references, load.test) as Reference | null;
        const convention = item.strengthReference?.loadKind ?? item.strengthLoadKind;
        if (source?.loadKind && convention && source.loadKind !== convention) {
          incompatible.push({ itemRef: item.ref, exerciseName: item.name });
          return item;
        }
        const updated = snapshotItem.parse({
          ...item,
          resolvedLoadKg: resolveLoadKg(item.prescription, source ? [source] : []),
          strengthReference: source,
          ...(source?.stepKg ? { loadStepKg: source.stepKg } : {}),
        });
        const before = {
          kg: item.resolvedLoadKg ?? null,
          reference: snapshotItem.parse(item).strengthReference ?? null,
        };
        const after = { kg: updated.resolvedLoadKg ?? null, reference: updated.strengthReference ?? null };
        if (JSON.stringify(before) !== JSON.stringify(after))
          changes.push({ itemRef: item.ref, exerciseName: item.name, percentage: load.value, before, after });
        return updated;
      }),
    })),
  };
  return { snapshot: next, changes, incompatible };
};
