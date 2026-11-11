// Les événements que la route du webhook sait traiter : la console vérifie que l'endpoint Stripe les couvre tous.
export const STRIPE_WEBHOOK_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.created",
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.updated",
  "invoice.voided",
  "charge.refunded",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
] as const;
