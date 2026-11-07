import type { Prescription, SessionSnapshot } from "@tartan/contracts";
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
