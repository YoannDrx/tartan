// Jeu de paires : « terme dit par le coach » → fiche attendue, ou aucune fiche (`absent`).
// Il mesure la seule étape « retrouver les fiches », sur une bibliothèque de référence commune à toutes les paires.
import { z } from "zod";
import { catalogueKey } from "@tartan/contracts";
import { e2eLibrary, foldName, isCatalogKey, sameName } from "../format";
import type { ObservedRef } from "../observation";

export const e2ePair = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/),
    // Le terme tel que le coach le dit ou l'écrit.
    said: z.string().trim().min(1).max(120),
    key: catalogueKey.optional(),
    private: z.string().trim().min(1).max(120).optional(),
    absent: z.literal(true).optional(),
  })
  .strict()
  .refine((p) => [p.key, p.private, p.absent].filter((v) => v !== undefined).length === 1, {
    error: "Une paire attend une seule chose : key, private ou absent.",
  });
export type E2ePair = z.infer<typeof e2ePair>;

export const e2ePairs = z
  .object({ version: z.literal(2), library: e2eLibrary, pairs: z.array(e2ePair).min(1).max(5000) })
  .strict()
  .superRefine((set, ctx) => {
    if (new Set(set.pairs.map((p) => p.id)).size !== set.pairs.length)
      ctx.addIssue({ code: "custom", message: "Deux paires portent le même identifiant." });
    const names = new Set(set.library.private.map((e) => foldName(e.name)));
    for (const pair of set.pairs)
      if (pair.private && !names.has(foldName(pair.private)))
        ctx.addIssue({ code: "custom", message: `${pair.id}: fiche privée absente de library.private` });
  });
export type E2ePairs = z.infer<typeof e2ePairs>;

export function pairProblems(set: E2ePairs): string[] {
  return set.pairs.flatMap((pair) =>
    pair.key && !isCatalogKey(pair.key) ? [`${pair.id}: clé inconnue du catalogue « ${pair.key} »`] : [],
  );
}

/** Ce que le planificateur a fait d'un terme : la fiche choisie d'abord (ou aucune), puis ses propositions. */
export type PairResolution = {
  first: ObservedRef | null;
  proposals: ObservedRef[];
  // La fiche choisie est marquée « À vérifier ».
  toVerify: boolean;
};

export type PairScore = {
  // Juste en premier choix : la bonne fiche, ou aucune fiche pour un terme `absent`.
  top1: boolean;
  // La bonne fiche est parmi les trois premières propositions.
  top3: boolean;
  // Une fiche a été choisie alors qu'aucune ne correspond.
  falsePositive: boolean;
};

const isExpected = (pair: E2ePair, ref: ObservedRef) =>
  pair.key !== undefined
    ? ref.kind === "catalog" && ref.key === pair.key
    : pair.private !== undefined && ref.kind === "private" && sameName(ref.name, pair.private);
const isFiche = (ref: ObservedRef | null): ref is ObservedRef =>
  ref !== null && (ref.kind === "catalog" || ref.kind === "private");

export function scorePair(pair: E2ePair, resolution: PairResolution): PairScore {
  const chosen = isFiche(resolution.first) ? resolution.first : null;
  if (pair.absent) return { top1: chosen === null, top3: chosen === null, falsePositive: chosen !== null };
  const top1 = chosen !== null && isExpected(pair, chosen);
  const candidates = [...(chosen ? [chosen] : []), ...resolution.proposals].filter(isFiche);
  const distinct = candidates.filter(
    (ref, index) => candidates.findIndex((other) => JSON.stringify(other) === JSON.stringify(ref)) === index,
  );
  return { top1, top3: distinct.slice(0, 3).some((ref) => isExpected(pair, ref)), falsePositive: false };
}
