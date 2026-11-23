import type { OrgRole } from "@tartan/contracts";
import { can } from "@tartan/domain";

// Les rubriques des réglages de l'app native : un sommaire (`/settings`) et une page par rubrique, dans le même ordre
// et selon les mêmes droits que la web app. Pas de rubrique d'abonnement : aucune offre payante sur iOS et Android.
export const SETTINGS_RUBRICS = [
  "profil",
  "connexion",
  "notifications",
  "apparence",
  "confidentialite",
  "espace",
  "groupes",
  "membres",
  "aide",
] as const;
export type SettingsRubric = (typeof SETTINGS_RUBRICS)[number];

// Les rubriques du compte se voient sans espace (compte neuf) ; celles de l'espace suivent le rôle.
const RULES: Record<SettingsRubric, (role: OrgRole | null) => boolean> = {
  profil: () => true,
  connexion: () => true,
  notifications: () => true,
  apparence: () => true,
  confidentialite: () => true,
  espace: (role) => role !== null && can(role, "manageOrganization"),
  groupes: (role) => role !== null && can(role, "inviteAthlete"),
  membres: (role) => role !== null && can(role, "manageOrganization"),
  aide: () => true,
};

export const canOpenRubric = (role: OrgRole | null, rubric: SettingsRubric): boolean => RULES[rubric](role);

export type SettingsGroupId = "compte" | "espace" | "aide";
const GROUPS: { id: SettingsGroupId; rubrics: SettingsRubric[] }[] = [
  { id: "compte", rubrics: ["profil", "connexion", "notifications", "apparence", "confidentialite"] },
  { id: "espace", rubrics: ["espace", "groupes", "membres"] },
  { id: "aide", rubrics: ["aide"] },
];

// Ce qui est à moi, ce qui est à l'espace, puis l'aide ; un groupe vide disparaît.
export const settingsGroups = (role: OrgRole | null): { id: SettingsGroupId; rubrics: SettingsRubric[] }[] =>
  GROUPS.map((group) => ({
    id: group.id,
    rubrics: group.rubrics.filter((rubric) => canOpenRubric(role, rubric)),
  })).filter((group) => group.rubrics.length > 0);

export const rubricHref = (rubric: SettingsRubric) => `/settings/${rubric}` as const;
