import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prices: [] as Array<{
    id: string;
    lookup_key: string;
    product: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string; interval_count: number };
  }>,
  retrieveProduct: vi.fn(),
  createProduct: vi.fn(),
  createPrice: vi.fn(),
  updatePortal: vi.fn(),
  StripeInvalidRequestError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));

vi.mock("stripe", () => {
  class Stripe {
    static errors = { StripeInvalidRequestError: mocks.StripeInvalidRequestError };
    prices = {
      list: vi.fn(async ({ lookup_keys }: { lookup_keys: string[] }) => ({
        data: mocks.prices.filter((price) => lookup_keys.includes(price.lookup_key)),
      })),
      create: mocks.createPrice,
    };
    products = { retrieve: mocks.retrieveProduct, create: mocks.createProduct };
    billingPortal = {
      configurations: {
        list: vi.fn(async () => ({ data: [{ id: "bpc_test", metadata: { app: "tartan" } }] })),
        update: mocks.updatePortal,
        create: vi.fn(),
      },
    };
    webhookEndpoints = {
      list: vi.fn(async () => ({ data: [{ url: "https://app.tartan.coach/api/webhooks/stripe" }] })),
      create: vi.fn(),
    };
  }
  return { default: Stripe };
});

describe("configuration du catalogue Stripe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fictif");
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.updatePortal.mockResolvedValue({ id: "bpc_test" });
    mocks.prices = [
      ["coach", "month", 1900],
      ["coach", "year", 19000],
      ["club", "month", 5900],
      ["club", "year", 59000],
    ].map(([plan, interval, amount]) => ({
      id: `price_${plan}_${interval}`,
      lookup_key: `tartan_${plan}_${interval}`,
      product: `prod_${plan}`,
      unit_amount: Number(amount),
      currency: "eur",
      recurring: { interval: String(interval), interval_count: 1 },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("réutilise les produits et tarifs créés dans le Dashboard", async () => {
    await import("../scripts/stripe-setup");
    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.createPrice).not.toHaveBeenCalled();
    expect(mocks.updatePortal).toHaveBeenCalledWith(
      "bpc_test",
      expect.objectContaining({
        features: expect.objectContaining({
          subscription_update: expect.objectContaining({
            products: expect.arrayContaining([
              expect.objectContaining({ product: "prod_coach", prices: ["price_coach_month", "price_coach_year"] }),
              expect.objectContaining({ product: "prod_club", prices: ["price_club_month", "price_club_year"] }),
            ]),
          }),
        }),
      }),
    );
  });

  it("s'arrête si les tarifs d'une offre appartiennent à deux produits", async () => {
    mocks.prices[1]!.product = "prod_autre";
    await expect(import("../scripts/stripe-setup")).rejects.toThrow("plusieurs produits");
    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.updatePortal).not.toHaveBeenCalled();
  });

  it("crée les produits et tarifs absents du compte", async () => {
    mocks.prices = [];
    mocks.retrieveProduct.mockRejectedValue(new mocks.StripeInvalidRequestError("resource_missing"));
    mocks.createProduct.mockImplementation(async ({ id }: { id: string }) => ({ id }));
    mocks.createPrice.mockImplementation(async ({ lookup_key }: { lookup_key: string }) => ({ id: lookup_key }));
    await import("../scripts/stripe-setup");
    expect(mocks.createProduct).toHaveBeenCalledTimes(2);
    expect(mocks.createPrice).toHaveBeenCalledTimes(4);
  });

  it("ne crée pas de produit si Stripe refuse la lecture pour une autre raison", async () => {
    mocks.prices = [];
    mocks.retrieveProduct.mockRejectedValue(new Error("Droits insuffisants"));
    await expect(import("../scripts/stripe-setup")).rejects.toThrow("Droits insuffisants");
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });
});
