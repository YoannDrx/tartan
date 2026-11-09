export const WITHDRAWAL_DAYS = 14;
export const refundReasons = ["withdrawal", "duplicate", "service_issue", "goodwill", "fraud"] as const;
export type RefundReason = (typeof refundReasons)[number];

const DAY_MS = 86_400_000;

// Le délai court depuis la souscription, pas depuis la facture. L'admin tranche : l'app ne sait pas qui est consommateur.
export const withdrawalWindow = (subscribedAt: Date, now: Date): { open: boolean; endsAt: Date } => {
  const endsAt = new Date(subscribedAt.getTime() + WITHDRAWAL_DAYS * DAY_MS);
  return { open: now <= endsAt, endsAt };
};

export const refundableCents = (paidCents: number, refundedCents: number): number =>
  Math.max(0, paidCents - refundedCents);

export const isRefundAmountValid = (amountCents: number, paidCents: number, refundedCents: number): boolean =>
  Number.isInteger(amountCents) && amountCents > 0 && amountCents <= refundableCents(paidCents, refundedCents);

// Stripe ne connaît que quatre motifs d'avoir.
export const stripeCreditReason = (
  reason: RefundReason,
): "duplicate" | "fraudulent" | "order_change" | "product_unsatisfactory" => {
  if (reason === "duplicate") return "duplicate";
  if (reason === "fraud") return "fraudulent";
  if (reason === "service_issue") return "product_unsatisfactory";
  return "order_change";
};
