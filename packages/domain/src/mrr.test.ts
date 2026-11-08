import { describe, expect, it } from "vitest";
import { churnPercent, discountedMonthlyCents, effectiveMrrCents, monthlyCents, summarizeRevenue } from "./mrr";
import { isRefundAmountValid, refundableCents, stripeCreditReason, withdrawalWindow } from "./refunds";

const NOW = new Date("2030-06-12T10:00:00Z");
const base = { listMrrCents: 1900, discountedMrrCents: 1900, discountEndsAt: null };

describe("revenu récurrent", () => {
  it("ramène un abonnement annuel au mois", () => {
    expect(monthlyCents(19000, "year")).toBe(1583);
    expect(monthlyCents(1900, "month")).toBe(1900);
  });

  it("n'applique que les remises durables", () => {
    expect(discountedMonthlyCents(1900, { percentOff: 50, duration: "once" })).toBe(1900);
    expect(discountedMonthlyCents(1900, { percentOff: 50, duration: "repeating" })).toBe(950);
    expect(discountedMonthlyCents(1900, { amountOff: 500, duration: "forever" })).toBe(1400);
  });

  it("revient au tarif plein quand la remise est finie", () => {
    const sub = { status: "active" as const, listMrrCents: 1900, discountedMrrCents: 950 };
    expect(effectiveMrrCents({ ...sub, discountEndsAt: new Date("2030-07-01T00:00:00Z") }, NOW)).toBe(950);
    expect(effectiveMrrCents({ ...sub, discountEndsAt: new Date("2030-06-01T00:00:00Z") }, NOW)).toBe(1900);
  });

  it("exclut les essais et isole les impayés", () => {
    const summary = summarizeRevenue(
      [
        { ...base, status: "active" },
        { ...base, status: "trialing" },
        { ...base, status: "past_due" },
        { ...base, status: "canceled" },
      ],
      NOW,
    );
    expect(summary).toEqual({ mrrCents: 1900, arrCents: 22800, paying: 1, trialing: 1, pastDue: 1, atRiskCents: 1900 });
  });

  it("n'invente pas de churn sans base", () => {
    expect(churnPercent(0, 0)).toBeNull();
    expect(churnPercent(40, 2)).toBe(5);
  });
});

describe("remboursements", () => {
  it("borne le montant au reste à rembourser", () => {
    expect(refundableCents(1900, 500)).toBe(1400);
    expect(isRefundAmountValid(1400, 1900, 500)).toBe(true);
    expect(isRefundAmountValid(1401, 1900, 500)).toBe(false);
    expect(isRefundAmountValid(0, 1900, 0)).toBe(false);
    expect(isRefundAmountValid(10.5, 1900, 0)).toBe(false);
  });

  it("compte la rétractation depuis la souscription", () => {
    const subscribed = new Date("2030-06-01T10:00:00Z");
    expect(withdrawalWindow(subscribed, NOW).open).toBe(true);
    expect(withdrawalWindow(subscribed, new Date("2030-06-16T10:00:00Z")).open).toBe(false);
  });

  it("traduit les motifs pour Stripe", () => {
    expect(stripeCreditReason("withdrawal")).toBe("order_change");
    expect(stripeCreditReason("fraud")).toBe("fraudulent");
  });
});
