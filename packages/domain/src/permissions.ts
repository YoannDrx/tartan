import type { OrgRole } from "@tartan/contracts";

// Matrice du cahier des charges, § 5.3. « scope » précise la portée côté service.
export type Scope = "all" | "own_groups" | "own_sessions" | "self" | "read";

const matrix = {
  inviteAthlete: { owner: "all", coach: "own_groups" },
  inviteCoach: { owner: "all" },
  viewExercises: { owner: "all", coach: "all", assistant: "all", athlete: "read" },
  editExercises: { owner: "all", coach: "all", assistant: "all" },
  manageSessions: { owner: "all", coach: "all", assistant: "own_sessions" },
  viewTracking: { owner: "all", coach: "own_groups", assistant: "own_groups", athlete: "self" },
  manageAthletes: { owner: "all", coach: "own_groups" },
  // Tests de force, références, performances et phases d'un athlète : la même portée que la gestion des fiches,
  // sans elle. C'est ce qu'un athlète autonome reçoit pour lui-même, pas le droit de gérer un groupe.
  recordPerformance: { owner: "all", coach: "own_groups" },
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

export const PERMISSIONS = Object.keys(matrix) as Permission[];

export const scopeOf = (role: OrgRole, permission: Permission): Scope | null => {
  const entry = matrix[permission] as Partial<Record<OrgRole, Scope>>;
  return entry[role] ?? null;
};

export const can = (role: OrgRole, permission: Permission): boolean => scopeOf(role, permission) !== null;

export const isStaff = (role: OrgRole): boolean => role === "owner" || role === "coach" || role === "assistant";

// ── Espace personnel ─────────────────────────────────────────────────────────
// Un athlète qui s'entraîne seul a son espace, dont il est l'unique membre, avec le rôle athlète et sa fiche.
// Il y garde tout ce qu'un athlète peut faire, et planifie en plus pour sa seule fiche : séances et modèles,
// bibliothèque et listes, tests de force, références, performances, phases. Rien d'autre : ni invitation, ni
// gestion de fiches ou de groupes, ni notes privées, ni annonces, ni abonnement, ni réglage de l'espace.
export type SpaceKind = "coach" | "personal";

export const PERSONAL_PLANNING: readonly Permission[] = ["manageSessions", "editExercises", "recordPerformance"];

export const personalScopeOf = (role: OrgRole, permission: Permission): Scope | null => {
  if (role !== "athlete") return null;
  if (PERSONAL_PLANNING.includes(permission)) return "self";
  return scopeOf("athlete", permission);
};

// La règle d'un espace : celle de la matrice pour l'espace d'un coach, celle du titulaire pour un espace personnel.
export const canIn = (kind: SpaceKind, role: OrgRole, permission: Permission): boolean =>
  kind === "personal" ? personalScopeOf(role, permission) !== null : can(role, permission);

// Qui ouvre le calendrier de planification, le constructeur et le planificateur : l'équipe d'un espace de coach,
// le titulaire d'un espace personnel.
export const plansSessions = (kind: SpaceKind, role: OrgRole): boolean => canIn(kind, role, "manageSessions");
