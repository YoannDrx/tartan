export type SubscriptionRevenue = {
  status: "trialing" | "active" | "past_due" | "canceled";
  listMrrCents: number | null;
  discountedMrrCents: number | null;
  discountEndsAt: Date | null;
  cancelAt?: Date | null;
};

// Montant mensuel hors taxes : un abonnement annuel compte pour un douzième.
export const monthlyCents = (unitCents: number, interval: "month" | "year"): number =>
  interval === "year" ? Math.round(unitCents / 12) : unitCents;

export type Discount = { percentOff?: number | null; amountOff?: number | null; duration: string };

// Une remise ponctuelle ne change pas le revenu récurrent ; une remise durable le réduit.
export const discountedMonthlyCents = (listCents: number, discount: Discount | null): number => {
  if (!discount || discount.duration === "once") return listCents;
  if (discount.percentOff) return Math.round(listCents * (1 - discount.percentOff / 100));
  if (discount.amountOff) return Math.max(0, listCents - discount.amountOff);
  return listCents;
};

export const effectiveMrrCents = (sub: SubscriptionRevenue, now: Date): number => {
  if (sub.status !== "active") return 0;
  const discountRuns = sub.discountEndsAt === null || sub.discountEndsAt > now;
  return (discountRuns ? sub.discountedMrrCents : sub.listMrrCents) ?? sub.listMrrCents ?? 0;
};

export const summarizeRevenue = (subs: readonly SubscriptionRevenue[], now: Date) => {
  const mrrCents = subs.reduce((total, sub) => total + effectiveMrrCents(sub, now), 0);
  return {
    mrrCents,
    arrCents: mrrCents * 12,
    paying: subs.filter((sub) => sub.status === "active").length,
    trialing: subs.filter((sub) => sub.status === "trialing").length,
    pastDue: subs.filter((sub) => sub.status === "past_due").length,
    // Le revenu en retard de paiement se lit à part : il n'est pas encaissé.
    atRiskCents: subs
      .filter((sub) => sub.status === "past_due")
      .reduce((total, sub) => total + (sub.discountedMrrCents ?? sub.listMrrCents ?? 0), 0),
  };
};

// Churn du mois : abonnés perdus rapportés à ceux du début de période. Sans base, la mesure n'existe pas.
export const churnPercent = (startPaying: number, lost: number): number | null =>
  startPaying > 0 ? Math.round((lost / startPaying) * 1000) / 10 : null;
