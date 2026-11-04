// Une entrée de groupe ouvre les séances à partir de ce jour, pas l'historique du groupe.
// Une attribution individuelle est explicite ; une validation existante reste consultable.
export const isSessionAssigned = (input: {
  date: string;
  assignments: readonly { targetType: "athlete" | "group"; targetId: string }[];
  athleteId: string;
  groups: readonly { groupId: string; joinedOn: string }[];
  hasLog?: boolean;
}): boolean =>
  Boolean(input.hasLog) ||
  input.assignments.some((target) =>
    target.targetType === "athlete"
      ? target.targetId === input.athleteId
      : input.groups.some((group) => group.groupId === target.targetId && group.joinedOn <= input.date),
  );
