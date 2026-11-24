import type { MeResponse, SignupOptions, SpaceSummary } from "@tartan/contracts";
import { HISTORY_SCOPES, normalizeHistoryScopes, plansSessions, type HistoryScope } from "@tartan/domain";
import { m } from "@tartan/i18n";

// L'athlète autonome dans l'app native (lot AA3) : l'aiguillage d'un compte sans espace, son espace personnel et le
// partage de son historique. Règles pures, testées sans écran.

export type WelcomeChoice = "coach" | "solo" | "invite";

// Les choix de l'aiguillage, de même rang et dans l'ordre du web. Un choix que la console ferme n'est pas montré :
// mieux vaut ne rien proposer qu'un formulaire entier refusé au dernier envoi. Le lien d'invitation reste toujours.
// Tant que le réglage n'est pas lu, seul le lien est proposé ; un compte qui a déjà son espace personnel y retourne.
export const welcomeChoices = (options: SignupOptions | null | undefined, hasPersonal = false): WelcomeChoice[] => [
  ...(options?.coach ? (["coach"] as const) : []),
  ...(options?.athlete || hasPersonal ? (["solo"] as const) : []),
  "invite",
];

export const isPersonalSpace = (space: Pick<SpaceSummary, "kind"> | null | undefined): boolean =>
  space?.kind === "personal";

export const hasPersonalSpace = (me: Pick<MeResponse, "spaces"> | null | undefined): boolean =>
  Boolean(me?.spaces.some((space) => space.kind === "personal"));

// Qui ouvre le constructeur, le calendrier de planification et le planificateur : l'équipe d'un espace de coach, le
// titulaire d'un espace personnel. Un ancien serveur ne dit pas `kind` : c'est un espace de coach.
export const canPlanIn = (space: Pick<SpaceSummary, "kind" | "role"> | null | undefined): boolean =>
  Boolean(space && plansSessions(space.kind ?? "coach", space.role));

// Le titulaire d'un espace personnel planifie pour sa seule fiche. Ailleurs, rien n'est imposé.
export const personalAthleteOf = (
  space: Pick<SpaceSummary, "kind" | "role" | "athleteId"> | null | undefined,
): string | null => (space && isPersonalSpace(space) && space.role === "athlete" ? space.athleteId : null);

// Ce que dit le sélecteur d'espace sous le nom : le rôle, ou « Espace personnel », qui n'a pas de rôle à dire.
export const spaceCaption = (space: Pick<SpaceSummary, "kind" | "role">): string =>
  isPersonalSpace(space) ? m.mobile.solo.spaceKind : m.roles[space.role];

// Une case du partage, cochée ou décochée ; l'ordre reste celui de l'écran, la santé n'en est jamais une.
export const toggleHistoryScope = (scopes: readonly HistoryScope[], scope: HistoryScope): HistoryScope[] =>
  normalizeHistoryScopes(scopes.includes(scope) ? scopes.filter((entry) => entry !== scope) : [...scopes, scope]);

export const SHARE_SCOPES = HISTORY_SCOPES;

// L'écran de partage suit l'arrivée dans le groupe d'un coach, pour un athlète qui avait déjà son espace personnel.
export const offersHistoryShare = (input: { hadPersonal: boolean; role: string | undefined }): boolean =>
  input.hadPersonal && input.role === "athlete";
