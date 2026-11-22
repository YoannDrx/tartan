// La matrice des écrans : chaque page de l'application, qui l'ouvre, et les parcours qui la prouvent.
// `tests/screen-matrix.test.ts` échoue pour toute page absente d'ici ; `screen-matrix.spec.ts` visite chaque écran
// sans paramètre, pour chaque rôle, à 390, 768 et 1440 px.
export type ScreenRole = "public" | "coach" | "athlete" | "admin";
export type Screen = {
  path: string;
  roles: ScreenRole[];
  // Les parcours (`e2e/…`) ou tests (`tests/…`) qui ouvrent cet écran et en vérifient le contenu, en plus du balayage.
  // Un écran à paramètre en a au moins un ; un écran sans paramètre peut ne compter que sur le balayage.
  proof: string[];
};

const both: ScreenRole[] = ["coach", "athlete"];

export const SCREENS: Screen[] = [
  // Site public et pages légales
  { path: "/", roles: ["public"], proof: ["landing.spec.ts"] },
  { path: "/tarifs", roles: ["public"], proof: ["landing.spec.ts", "pilot.spec.ts"] },
  { path: "/aide", roles: ["public"], proof: ["help.spec.ts"] },
  { path: "/contact", roles: ["public"], proof: ["help.spec.ts"] },
  { path: "/cgv", roles: ["public"], proof: ["mobile-legal.spec.ts"] },
  { path: "/conditions", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/confidentialite", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/mentions-legales", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/suppression-compte", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/hors-ligne", roles: ["public"], proof: ["landing.spec.ts"] },
  { path: "/mobile/aide", roles: ["public"], proof: ["mobile-legal.spec.ts"] },
  { path: "/mobile/conditions", roles: ["public"], proof: ["mobile-legal.spec.ts"] },
  { path: "/mobile/confidentialite", roles: ["public"], proof: ["mobile-legal.spec.ts"] },
  { path: "/mobile/contact", roles: ["public"], proof: ["mobile-legal.spec.ts"] },
  // Entrée, compte et liens reçus
  { path: "/connexion", roles: ["public"], proof: ["password.spec.ts", "age-confirmation.spec.ts"] },
  { path: "/mot-de-passe-oublie", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/nouveau-mot-de-passe", roles: ["public"], proof: ["pilot.spec.ts"] },
  { path: "/confirmer-age", roles: ["public"], proof: ["terrain.spec.ts"] },
  { path: "/bienvenue", roles: ["athlete"], proof: ["age-confirmation.spec.ts", "tests/athlete-arrival.test.ts"] },
  { path: "/bienvenue/inviter", roles: ["coach"], proof: ["onboarding.spec.ts"] },
  { path: "/i/[token]", roles: ["public"], proof: ["pilot.spec.ts", "password.spec.ts", "avatar.spec.ts"] },
  { path: "/accord-parental/[token]", roles: ["public"], proof: ["tests/access.test.ts"] },
  { path: "/e-mails/[kind]/[token]", roles: ["public"], proof: ["tests/email.test.ts"] },
  // Espace commun
  { path: "/accueil", roles: both, proof: ["space-switch.spec.ts"] },
  { path: "/notifications", roles: both, proof: ["notification-center.spec.ts"] },
  { path: "/nouveautes", roles: both, proof: [] },
  // Réglages : le sommaire, puis une page par rubrique
  { path: "/reglages", roles: both, proof: ["settings-sections.spec.ts"] },
  { path: "/reglages/profil", roles: both, proof: ["settings-sections.spec.ts", "avatar.spec.ts"] },
  { path: "/reglages/connexion", roles: both, proof: ["settings-sections.spec.ts", "password.spec.ts"] },
  { path: "/reglages/notifications", roles: both, proof: ["settings-sections.spec.ts"] },
  { path: "/reglages/apparence", roles: both, proof: ["settings-sections.spec.ts", "date-theme.spec.ts"] },
  { path: "/reglages/confidentialite", roles: both, proof: ["settings-sections.spec.ts", "pilot.spec.ts"] },
  { path: "/reglages/aide", roles: both, proof: ["settings-sections.spec.ts", "help.spec.ts"] },
  { path: "/synchronisation", roles: both, proof: [] },
  { path: "/annonces", roles: both, proof: ["notification-center.spec.ts"] },
  { path: "/calendrier", roles: both, proof: ["calendar-views.spec.ts", "demo-space.spec.ts", "filled-sweep.spec.ts"] },
  { path: "/phases", roles: both, proof: ["training-phases.spec.ts", "filled-sweep.spec.ts"] },
  { path: "/analyse", roles: both, proof: ["training-analysis.spec.ts"] },
  { path: "/outils/charges", roles: both, proof: ["strength-calculator.spec.ts"] },
  { path: "/historique/[athleteId]", roles: both, proof: ["screen-matrix.spec.ts"] },
  {
    path: "/planificateur",
    roles: ["coach"],
    proof: ["ai-planner.spec.ts", "ai-disabled.spec.ts", "demo-space.spec.ts"],
  },
  { path: "/planificateur/propositions", roles: ["coach"], proof: ["ai-disabled.spec.ts"] },
  // Coach
  {
    path: "/suivi",
    roles: ["coach"],
    proof: [
      "absence.spec.ts",
      "captures.spec.ts",
      "avatar.spec.ts",
      "onboarding.spec.ts",
      "demo-space.spec.ts",
      "filled-sweep.spec.ts",
    ],
  },
  { path: "/premiers-pas", roles: ["coach"], proof: ["onboarding.spec.ts", "demo-space.spec.ts"] },
  {
    path: "/seances/nouvelle",
    roles: ["coach"],
    proof: ["coach-screens.spec.ts", "session-sequences.spec.ts", "exercise-finder.spec.ts"],
  },
  { path: "/seances/[id]", roles: ["coach"], proof: ["coach-screens.spec.ts", "demo-space.spec.ts"] },
  { path: "/seances/[id]/suivi", roles: ["coach"], proof: ["coach-performed-sets.spec.ts", "filled-sweep.spec.ts"] },
  { path: "/seances/[id]/charges", roles: ["coach"], proof: ["filled-pages.spec.ts"] },
  { path: "/seances/[id]/athletes/[athleteId]/series", roles: ["coach"], proof: ["coach-performed-sets.spec.ts"] },
  {
    path: "/exercices",
    roles: ["coach"],
    proof: ["exercise-guides.spec.ts", "exercise-aliases.spec.ts", "exercise-lists.spec.ts", "exercise-finder.spec.ts"],
  },
  {
    path: "/exercices/[id]",
    roles: ["coach"],
    proof: ["screen-matrix.spec.ts", "exercise-guides.spec.ts", "exercise-lists.spec.ts"],
  },
  {
    path: "/athletes",
    roles: ["coach"],
    proof: ["athletic-performances.spec.ts", "demo-space.spec.ts", "filled-sweep.spec.ts"],
  },
  { path: "/athletes/[id]", roles: ["coach"], proof: ["athletic-performances.spec.ts", "demo-space.spec.ts"] },
  { path: "/videos", roles: ["coach"], proof: ["video-collaboration.spec.ts", "video-filters.spec.ts"] },
  { path: "/videos/[id]", roles: ["coach"], proof: ["video-collaboration.spec.ts", "video-fullscreen.spec.ts"] },
  { path: "/abonnement", roles: ["coach"], proof: ["subscription.spec.ts", "demo-space.spec.ts"] },
  {
    path: "/reglages/espace",
    roles: ["coach"],
    proof: ["settings-sections.spec.ts", "training-profile.spec.ts", "avatar.spec.ts"],
  },
  { path: "/reglages/groupes", roles: ["coach"], proof: ["settings-sections.spec.ts", "pilot.spec.ts"] },
  { path: "/reglages/membres", roles: ["coach"], proof: ["settings-sections.spec.ts", "staff-invitation.spec.ts"] },
  { path: "/reglages/abonnement", roles: ["coach"], proof: ["settings-sections.spec.ts"] },
  { path: "/reglages/references-force", roles: ["coach"], proof: ["strength-mappings.spec.ts"] },
  // Athlète
  {
    path: "/aujourdhui",
    roles: ["athlete"],
    proof: ["session-open.spec.ts", "regularity.spec.ts", "password.spec.ts"],
  },
  { path: "/progres", roles: ["athlete"], proof: ["record-card.spec.ts", "filled-sweep.spec.ts"] },
  { path: "/mes-videos", roles: ["athlete"], proof: ["video-collaboration.spec.ts"] },
  { path: "/mes-videos/[id]", roles: ["athlete"], proof: ["video-collaboration.spec.ts", "video-fullscreen.spec.ts"] },
  { path: "/seance/[id]", roles: ["athlete"], proof: ["session-open.spec.ts", "exercise-guides.spec.ts"] },
  { path: "/seance/[id]/mode", roles: ["athlete"], proof: ["session-sequences.spec.ts", "exercise-guides.spec.ts"] },
  { path: "/seance/[id]/series", roles: ["athlete"], proof: ["performed-sets.spec.ts"] },
  // Console d'administration
  { path: "/verification-admin", roles: ["admin"], proof: ["admin-passkey.spec.ts"] },
  { path: "/admin", roles: ["admin"], proof: ["admin-console.spec.ts", "admin-operations.spec.ts"] },
  { path: "/admin/revenus", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/utilisateurs", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/utilisateurs/[id]", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/espaces", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/espaces/[id]", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/abonnements", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/factures", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/factures/[id]", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/litiges", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/usage", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/versions", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/journal", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/configuration", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/mascotte", roles: ["admin"], proof: ["mascot-board.spec.ts"] },
  { path: "/admin/mouvements", roles: ["admin"], proof: ["admin-console.spec.ts"] },
  { path: "/admin/exercices", roles: ["admin"], proof: ["catalog-video.spec.ts", "tests/catalog-media.test.ts"] },
];

// Ce que le balayage visite : les écrans sans paramètre, pour chaque rôle qui les ouvre.
export const sweptScreens = (role: ScreenRole) =>
  SCREENS.filter((screen) => screen.roles.includes(role) && !screen.path.includes("["));
