import type { OrgRole } from "@tartan/contracts";

// Matrice du cahier des charges, § 5.3. « scope » précise la portée côté service.
export type Scope = "all" | "own_groups" | "own_sessions" | "self" | "read";

const matrix = {
  inviteAthlete: { owner: "all", coach: "own_groups" },
  inviteCoach: { owner: "all" },
  editExercises: { owner: "all", coach: "all", assistant: "all" },
  manageSessions: { owner: "all", coach: "all", assistant: "own_sessions" },
  viewTracking: { owner: "all", coach: "own_groups", assistant: "own_groups", athlete: "self" },
  manageAthletes: { owner: "all", coach: "own_groups" },
  viewInjuries: { owner: "all", coach: "own_groups", assistant: "read", athlete: "self" },
  editInjuries: { owner: "all", coach: "own_groups", athlete: "self" },
  privateNotes: { owner: "all", coach: "own_groups" },
  uploadVideos: { owner: "all", coach: "own_groups", assistant: "own_groups", athlete: "self" },
  filmAndAnnotate: { owner: "all", coach: "all", assistant: "all" },
  viewVideos: { owner: "all", coach: "own_groups", assistant: "own_groups", athlete: "self" },
  replyVideos: { owner: "all", coach: "all", assistant: "all", athlete: "self" },
  validateSession: { athlete: "self" },
  manageSubscription: { owner: "all" },
  manageOrganization: { owner: "all" },
  publishAnnouncement: { owner: "all", coach: "own_groups", assistant: "own_groups" },
} as const satisfies Record<string, Partial<Record<OrgRole, Scope>>>;

export type Permission = keyof typeof matrix;

export const scopeOf = (role: OrgRole, permission: Permission): Scope | null => {
  const entry = matrix[permission] as Partial<Record<OrgRole, Scope>>;
  return entry[role] ?? null;
};

export const can = (role: OrgRole, permission: Permission): boolean => scopeOf(role, permission) !== null;

export const isStaff = (role: OrgRole): boolean => role === "owner" || role === "coach" || role === "assistant";
