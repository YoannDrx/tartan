export type BillingSnapshot = {
  paid: boolean;
  status: string | null;
  cancelAt: Date | null;
  subscriptionId: string | null;
  periodEnd?: Date | null;
};

export type BillingEmail =
  | { kind: "started"; dedupeKey: string }
  | { kind: "cancel"; dedupeKey: string; cancelAt: Date }
  | { kind: "ended"; dedupeKey: string; unpaid: boolean }
  | { kind: "payment_failed"; dedupeKey: string }
  | { kind: "recovered"; dedupeKey: string };

// Une transition produit un seul mail : la clé reste la même si un webhook ou la réconciliation la rejoue.
export const billingEmailsFor = (prev: BillingSnapshot, next: BillingSnapshot): BillingEmail[] => {
  const emails: BillingEmail[] = [];
  const started = next.paid && next.subscriptionId && (!prev.paid || prev.subscriptionId !== next.subscriptionId);
  if (started) emails.push({ kind: "started", dedupeKey: `${next.subscriptionId}:started` });
  if (next.paid && next.subscriptionId && next.cancelAt && next.cancelAt.getTime() !== prev.cancelAt?.getTime()) {
    emails.push({
      kind: "cancel",
      dedupeKey: `${next.subscriptionId}:cancel:${next.cancelAt.toISOString().slice(0, 10)}`,
      cancelAt: next.cancelAt,
    });
  }
  // Une clé par échéance : un nouvel impayé le mois suivant sera signalé, pas le même deux fois.
  const period = (next.periodEnd ?? prev.periodEnd)?.toISOString().slice(0, 10) ?? "inconnue";
  if (next.paid && next.subscriptionId && next.status === "past_due" && prev.status !== "past_due") {
    emails.push({ kind: "payment_failed", dedupeKey: `${next.subscriptionId}:past_due:${period}` });
  }
  if (next.paid && next.subscriptionId && prev.status === "past_due" && next.status === "active") {
    emails.push({ kind: "recovered", dedupeKey: `${next.subscriptionId}:recovered:${period}` });
  }
  if (prev.paid && !next.paid) {
    const id = next.subscriptionId ?? prev.subscriptionId ?? "inconnu";
    emails.push({ kind: "ended", dedupeKey: `${id}:ended`, unpaid: prev.status === "past_due" });
  }
  return emails;
};
