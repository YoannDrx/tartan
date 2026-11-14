export type PlanKey = "pilot" | "discovery" | "coach" | "club";
export type BillingInterval = "month" | "year";

export type PlanLimits = {
  maxAthletes: number | null;
  maxGroups: number | null;
  maxCoaches: number | null;
  maxVideosPerMonth: number | null;
  videoRetentionDays: number | null;
};

export type PlanDefinition = {
  key: PlanKey;
  limits: PlanLimits;
  // Prix en centimes. Null : pas de vente (pilote, découverte gratuite).
  prices: Record<BillingInterval, number> | null;
};

export const TRIAL_DAYS = 14;

// Hypothèse de lancement validée par le fondateur, à confronter à 10 à 20 coachs (§ 17.1).
export const PLANS: Record<PlanKey, PlanDefinition> = {
  pilot: {
    key: "pilot",
    limits: { maxAthletes: null, maxGroups: null, maxCoaches: null, maxVideosPerMonth: null, videoRetentionDays: null },
    prices: null,
  },
  discovery: {
    key: "discovery",
    limits: { maxAthletes: 5, maxGroups: 1, maxCoaches: 1, maxVideosPerMonth: 10, videoRetentionDays: 30 },
    prices: null,
  },
  coach: {
    key: "coach",
    limits: { maxAthletes: 30, maxGroups: null, maxCoaches: 2, maxVideosPerMonth: 100, videoRetentionDays: 365 },
    prices: { month: 1900, year: 19000 },
  },
  club: {
    key: "club",
    // La vidéo est le coût variable (§ 17.1) : l'offre Club a un plafond large, jamais une dépense sans limite.
    limits: { maxAthletes: null, maxGroups: null, maxCoaches: null, maxVideosPerMonth: 500, videoRetentionDays: 1095 },
    prices: { month: 5900, year: 59000 },
  },
};

// Vidéos qu'un athlète envoie lui-même, par mois, en plus du quota de l'espace (décision du 14 novembre 2026).
// Elles ne comptent pas dans le quota de l'espace : un athlète ne peut pas bloquer son coach.
export const ATHLETE_VIDEOS_PER_MONTH: Record<PlanKey, number | null> = {
  pilot: null,
  discovery: 8,
  coach: 20,
  club: 20,
};

export type LimitKey = keyof Omit<PlanLimits, "videoRetentionDays">;

export const isWithinLimit = (limit: number | null, used: number): boolean => limit === null || used < limit;

export const isPaidPlan = (plan: PlanKey): boolean => PLANS[plan].prices !== null;

export const formatPrice = (cents: number): string => {
  const euros = cents / 100;
  return `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")} €`;
};

// Tout ce qui protège les personnes reste gratuit, à toute offre : ni limite ni paiement (§ 17.1).
export type SubscriptionState = "trialing" | "active" | "past_due" | "canceled";

// Après un impayé, l'accès est conservé pendant les relances du prestataire : couper ferait perdre le suivi.
export const planForSubscription = (plan: PlanKey, status: SubscriptionState): PlanKey =>
  status === "canceled" ? "discovery" : plan;

export const REFERRAL_QUALIFYING_DAYS = 30;
export const MAX_REWARDS_PER_YEAR = 12;

export const isReferralQualified = (input: {
  plan: PlanKey;
  status: SubscriptionState;
  paidSince: Date | null;
  now: Date;
}): boolean =>
  isPaidPlan(input.plan) &&
  input.status === "active" &&
  input.paidSince !== null &&
  input.now.getTime() - input.paidSince.getTime() >= REFERRAL_QUALIFYING_DAYS * 86400 * 1000;
