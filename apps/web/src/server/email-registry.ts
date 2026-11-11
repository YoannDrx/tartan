// Le registre des e-mails : chaque message que Tartan envoie y figure, avec sa catégorie.
// Le catalogue d'essai et docs/reference/emails.md sont contrôlés contre cette liste.

export type EmailCategory =
  // Connexion et protection du compte : part même après une plainte ou une désinscription.
  | "security"
  // Invitation par un coach, accord demandé à un parent.
  | "invitation"
  // Abonnement, paiement, échéances légales.
  | "billing"
  // Vie du compte et de l'espace : bienvenue, préavis de suppression.
  | "account"
  // Résumés et notifications, que chacun peut couper.
  | "activity"
  // Alertes adressées à l'éditeur.
  | "internal";

type EmailDefinition = {
  category: EmailCategory;
  // Genre de la ligne dans la file EmailOutbox, quand l'envoi y passe.
  outbox?: string;
};

export const EMAILS = {
  verify: { category: "security" },
  magic_link: { category: "security" },
  reset_password: { category: "security" },
  password_changed: { category: "security" },
  invitation_athlete: { category: "invitation", outbox: "invitation_athlete" },
  invitation_staff: { category: "invitation", outbox: "invitation_staff" },
  parental_consent: { category: "invitation" },
  welcome: { category: "account" },
  weekly_digest: { category: "activity" },
  notification_fallback: { category: "activity" },
  // Adressé au responsable de l'espace et à l'éditeur.
  content_report: { category: "account" },
  founder_alert: { category: "internal" },
  inactivity: { category: "account" },
  workspace_inactivity: { category: "account" },
  video_purge: { category: "account" },
  subscription_started: { category: "billing", outbox: "started" },
  subscription_cancelled: { category: "billing", outbox: "cancel" },
  subscription_ended: { category: "billing", outbox: "ended" },
  payment_failed: { category: "billing", outbox: "payment_failed" },
  payment_action_required: { category: "billing", outbox: "payment_action_required" },
  payment_recovered: { category: "billing", outbox: "recovered" },
  trial_ending: { category: "billing", outbox: "trial_ending" },
  renewal_notice: { category: "billing", outbox: "renewal_notice" },
  account_deleted: { category: "account", outbox: "account_deleted" },
  space_transferred: { category: "account", outbox: "space_transferred" },
} as const satisfies Record<string, EmailDefinition>;

export type EmailKey = keyof typeof EMAILS;

export const EMAIL_KEYS = Object.keys(EMAILS) as EmailKey[];

export const categoryOf = (key: EmailKey): EmailCategory => EMAILS[key].category;

const BY_OUTBOX_KIND = new Map<string, EmailKey>(
  EMAIL_KEYS.flatMap((key) => {
    const definition: EmailDefinition = EMAILS[key];
    return definition.outbox ? [[definition.outbox, key] as const] : [];
  }),
);

// Une ligne de la file dont le genre n'est pas au registre ne part pas : elle est marquée en échec.
export const emailForOutboxKind = (kind: string): EmailKey | null => BY_OUTBOX_KIND.get(kind) ?? null;

export type SuppressionReason = "bounce" | "complaint" | "suppressed";

// Une adresse qui rebondit n'existe plus : rien ne part. Une plainte ou une désinscription coupe tout,
// sauf ce qui permet de se connecter et de protéger son compte.
export const isBlockedBy = (category: EmailCategory, reason: SuppressionReason): boolean =>
  reason === "bounce" || category !== "security";
