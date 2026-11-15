import type { AttendanceStatus, SessionVariant } from "@tartan/contracts";

type HasBlocks = { blocks: { variant: string }[] };

export const hasAutonomousVersion = (snapshot: HasBlocks): boolean =>
  snapshot.blocks.some((b) => b.variant === "autonomous" || b.variant === "both");

export const resolveVariant = (attendance: AttendanceStatus, snapshot: HasBlocks): SessionVariant =>
  attendance === "absent" && hasAutonomousVersion(snapshot) ? "autonomous" : "club";

export const blocksForVariant = <T extends { variant: string }>(blocks: T[], variant: SessionVariant): T[] =>
  blocks.filter((b) => b.variant === "both" || b.variant === variant);

// Fusionne la liste du club (blocs communs compris) et celle de l'autonomie en une seule séance ordonnée.
// Les blocs propres à l'autonomie prennent la place des blocs propres au club : après les blocs communs
// d'ouverture et ceux du milieu, avant les blocs communs de fin. Sans bloc propre au club, ils vont à la fin.
export const mergeVariantBlocks = <T extends { variant: string }>(club: T[], autonomous: T[]): T[] => {
  let lastClubOnly = -1;
  club.forEach((b, i) => {
    if (b.variant !== "both") lastClubOnly = i;
  });
  if (lastClubOnly === -1) return [...club, ...autonomous];
  return [...club.slice(0, lastClubOnly + 1), ...autonomous, ...club.slice(lastClubOnly + 1)];
};

// Génère la version autonomie à partir de la version club, à ajuster ensuite par le coach.
export const generateAutonomousBlocks = <T extends { variant: string }>(blocks: T[]): T[] => {
  const club = blocks.filter((b) => b.variant === "club");
  const others = blocks.filter((b) => b.variant !== "autonomous");
  return [...others, ...club.map((b) => ({ ...b, variant: "autonomous" }))];
};

const field = (item: unknown, key: string) =>
  item !== null && typeof item === "object" && key in item ? (item as Record<string, unknown>)[key] : undefined;

/** Un exercice répété par un circuit compte une fois : ses passages partagent la référence de la fiche de séance. */
export const exerciseCount = <T extends { variant: string; items: unknown[] }>(
  blocks: T[],
  variant: SessionVariant,
): number =>
  new Set(
    blocksForVariant(blocks, variant).flatMap((b) =>
      b.items
        .filter((item) => field(item, "kind") !== "recovery")
        .map((item, index) => String(field(item, "sourceRef") ?? field(item, "ref") ?? `${b.variant}:${index}`)),
    ),
  ).size;

/** Les exercices d'une séance dans l'ordre, une fois chacun, avec leur nombre de passages. */
export const programItems = <T extends { ref: string; sourceRef?: string | null; kind?: string }>(items: T[]) => {
  const byKey = new Map<string, { item: T; passes: number }>();
  for (const item of items) {
    if (item.kind === "recovery") continue;
    const key = item.sourceRef ?? item.ref;
    const seen = byKey.get(key);
    if (seen) seen.passes += 1;
    else byKey.set(key, { item, passes: 1 });
  }
  return [...byKey.values()];
};
