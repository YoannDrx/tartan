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

export const exerciseCount = <T extends { variant: string; items: unknown[] }>(
  blocks: T[],
  variant: SessionVariant,
): number =>
  blocksForVariant(blocks, variant).reduce(
    (n, b) =>
      n +
      b.items.filter(
        (item) => !(item !== null && typeof item === "object" && "kind" in item && item.kind === "recovery"),
      ).length,
    0,
  );
