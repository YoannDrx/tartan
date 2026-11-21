// L'espace de démonstration, côté web : l'ouverture depuis les premiers pas, le bandeau permanent, le sélecteur
// d'espace, et la raison donnée quand une fonction coupée est demandée. Le contenu fictif lui-même (athlètes,
// séances, annonces) est dans `packages/domain/src/demo-space.ts`, comme les séances de départ.

const dateFr = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export const demoSpace = {
  // Premiers pas et carte « Pour démarrer ».
  intro: {
    title: "Espace de démonstration",
    lead: "Vois Tartan rempli avant d'inviter ton groupe : huit athlètes fictifs, leurs séances passées et à venir, leurs validations et leurs ressentis.",
    apart: "Il est séparé de ton espace : rien de ce que tu y fais ne touche tes vrais athlètes.",
    lifetime: "Il s'efface tout seul au bout de 14 jours. Tu peux le supprimer avant.",
    open: "Voir un espace de démonstration",
    opening: "Préparation de la démonstration",
    resume: "Ouvrir ma démonstration",
    reset: "Repartir de zéro",
    resetting: "Remise à zéro",
    remove: "Supprimer la démonstration",
    removing: "Suppression",
    expires: (iso: string) => `Ta démonstration s'efface le ${dateFr(iso)}.`,
    cardLink: "Pas encore d'athlète ? Voir Tartan rempli dans un espace de démonstration",
    failed: "La démonstration n'a pas pu s'ouvrir. Réessaie dans un instant.",
  },
  // Le bandeau, sur chaque écran de l'espace de démonstration.
  banner: {
    label: "Tu es dans l'espace de démonstration",
    title: "Espace de démonstration",
    body: "Athlètes et données fictives, ressentis et blessure compris. Planificateur, envoi de vidéo, invitations, e-mails et notifications sont coupés ici.",
    expires: (iso: string) => `Supprimé le ${dateFr(iso)}.`,
    back: "Revenir à mon espace",
    backing: "Retour à ton espace",
    remove: "Supprimer",
    removeLabel: "Supprimer l'espace de démonstration",
    confirmTitle: "Supprimer la démonstration ?",
    confirmBody: "Les athlètes fictifs et tout ce que tu as fait ici disparaissent. Ton espace n'est pas touché.",
    confirm: "Supprimer la démonstration",
    cancel: "Garder",
    removed: "Démonstration supprimée",
    failed: "La suppression n'a pas abouti. Réessaie dans un instant.",
  },
  // Dans le sélecteur d'espace.
  switcherLabel: (name: string) => `${name} (démonstration)`,
  // La raison donnée par un service coupé dans l'espace de démonstration.
  cut: {
    planner: "Le planificateur est coupé dans l'espace de démonstration.",
    video: "L'envoi de vidéo est coupé dans l'espace de démonstration.",
    invitations: "Les invitations sont coupées dans l'espace de démonstration : ses athlètes sont fictifs.",
    emails: "Aucun e-mail ne part de l'espace de démonstration.",
    push: "Aucune notification ne part de l'espace de démonstration.",
    billing: "L'abonnement ne se gère pas depuis l'espace de démonstration. Reviens à ton espace pour voir ton offre.",
    platformStats: "L'espace de démonstration n'entre pas dans les statistiques.",
    usageAnalytics: "L'espace de démonstration n'entre pas dans la mesure d'audience.",
  },
  // Page de l'abonnement, ouverte depuis l'espace de démonstration.
  billingTitle: "Abonnement",
} as const;
