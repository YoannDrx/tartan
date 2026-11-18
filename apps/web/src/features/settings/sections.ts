import type { OrgRole } from "@tartan/contracts";
import { can } from "@tartan/domain";

// Les rubriques des réglages : un sommaire (`/reglages`) et une sous-page par rubrique.
// Tables pures : la barre latérale, le sommaire, les redirections et les tests lisent la même source.
export const SETTINGS_RUBRICS = [
  "profil",
  "connexion",
  "notifications",
  "apparence",
  "confidentialite",
  "espace",
  "groupes",
  "membres",
  "abonnement",
  "aide",
] as const;
export type SettingsRubric = (typeof SETTINGS_RUBRICS)[number];

export const SETTINGS_ROOT = "/reglages";
// Sur ordinateur, le sommaire affiche directement cette rubrique à côté de la barre latérale.
export const FIRST_RUBRIC: SettingsRubric = "profil";

export const rubricPath = (rubric: SettingsRubric): string => `${SETTINGS_ROOT}/${rubric}`;

export const rubricOfPath = (pathname: string): SettingsRubric | null =>
  SETTINGS_RUBRICS.find((rubric) => pathname === rubricPath(rubric) || pathname.startsWith(`${rubricPath(rubric)}/`)) ??
  null;

// Qui voit quelle rubrique. Les sous-pages appliquent la même règle, puis leurs services revérifient chaque droit.
const RULES: Record<SettingsRubric, (role: OrgRole) => boolean> = {
  profil: () => true,
  connexion: () => true,
  notifications: () => true,
  apparence: () => true,
  confidentialite: () => true,
  espace: (role) => can(role, "manageOrganization"),
  groupes: (role) => can(role, "inviteAthlete"),
  membres: (role) => can(role, "manageOrganization") || can(role, "inviteAthlete"),
  abonnement: (role) => can(role, "manageSubscription"),
  aide: () => true,
};

export const canOpenRubric = (role: OrgRole, rubric: SettingsRubric): boolean => RULES[rubric](role);

export const visibleRubrics = (role: OrgRole): SettingsRubric[] =>
  SETTINGS_RUBRICS.filter((rubric) => canOpenRubric(role, rubric));

// Ce qui est à moi, ce qui est à l'espace, puis l'aide. Un rôle sans réglage d'espace lit une seule liste.
export type SettingsGroupId = "compte" | "espace" | "aide";
const GROUPS: { id: SettingsGroupId; rubrics: SettingsRubric[] }[] = [
  { id: "compte", rubrics: ["profil", "connexion", "notifications", "apparence", "confidentialite"] },
  { id: "espace", rubrics: ["espace", "groupes", "membres", "abonnement"] },
  { id: "aide", rubrics: ["aide"] },
];

export const settingsGroups = (role: OrgRole): { id: SettingsGroupId | null; rubrics: SettingsRubric[] }[] => {
  const groups = GROUPS.map((group) => ({
    id: group.id,
    rubrics: group.rubrics.filter((rubric) => canOpenRubric(role, rubric)),
  })).filter((group) => group.rubrics.length > 0);
  return groups.some((group) => group.id === "espace") ? groups : [{ id: null, rubrics: visibleRubrics(role) }];
};

// Les ancres de l'ancienne page unique. Des e-mails, des notifications et des favoris visent encore
// `/reglages#invitations` : le sommaire les mène à la bonne rubrique. `hash` nomme la section d'arrivée ;
// `fallback` sert au rôle qui n'ouvre pas la première rubrique (le parrainage du coach non propriétaire).
export type SettingsAnchorTarget = { rubric: SettingsRubric; hash?: string; fallback?: SettingsRubric };

export const SETTINGS_ANCHORS = {
  apparence: { rubric: "apparence" },
  profil: { rubric: "profil" },
  espace: { rubric: "espace" },
  signalements: { rubric: "espace", hash: "signalements" },
  membres: { rubric: "membres", hash: "membres" },
  // L'ancre #invitations a toujours désigné les groupes : c'est là qu'est le lien à partager.
  invitations: { rubric: "groupes" },
  inviter: { rubric: "membres", hash: "inviter" },
  confidentialite: { rubric: "confidentialite" },
  offre: { rubric: "abonnement" },
  parrainage: { rubric: "abonnement", hash: "parrainage", fallback: "aide" },
  agenda: { rubric: "notifications", hash: "agenda" },
  bloques: { rubric: "confidentialite", hash: "bloques" },
  emails: { rubric: "notifications", hash: "emails" },
  notifications: { rubric: "notifications" },
  categories: { rubric: "notifications", hash: "categories" },
  console: { rubric: "aide", hash: "console" },
  aide: { rubric: "aide" },
  compte: { rubric: "confidentialite", hash: "compte" },
} as const satisfies Record<string, SettingsAnchorTarget>;

export type SettingsAnchor = keyof typeof SETTINGS_ANCHORS;

// L'adresse de la rubrique qui remplace une ancienne ancre, requête conservée (`?espace=`).
// `null` : ancre inconnue, ou rubrique fermée à ce rôle ; on reste sur le sommaire.
export const settingsAnchorHref = (hash: string, search: string, role: OrgRole): string | null => {
  const anchor = hash.replace(/^#/, "");
  if (!Object.hasOwn(SETTINGS_ANCHORS, anchor)) return null;
  const target: SettingsAnchorTarget = SETTINGS_ANCHORS[anchor as SettingsAnchor];
  const rubric = [target.rubric, target.fallback].find(
    (candidate): candidate is SettingsRubric => candidate !== undefined && canOpenRubric(role, candidate),
  );
  if (!rubric) return null;
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return `${rubricPath(rubric)}${query}${target.hash ? `#${target.hash}` : ""}`;
};
