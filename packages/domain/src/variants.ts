import type { AttendanceStatus, SessionVariant } from "@tartan/contracts";

type HasBlocks = { blocks: { variant: string }[] };

export const hasAutonomousVersion = (snapshot: HasBlocks): boolean =>
  snapshot.blocks.some((b) => b.variant === "autonomous" || b.variant === "both");

export const resolveVariant = (attendance: AttendanceStatus, snapshot: HasBlocks): SessionVariant =>
  attendance === "absent" && hasAutonomousVersion(snapshot) ? "autonomous" : "club";

export const blocksForVariant = <T extends { variant: string }>(blocks: T[], variant: SessionVariant): T[] =>
  blocks.filter((b) => b.variant === "both" || b.variant === variant);

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
  blocksForVariant(blocks, variant).reduce((n, b) => n + b.items.length, 0);
