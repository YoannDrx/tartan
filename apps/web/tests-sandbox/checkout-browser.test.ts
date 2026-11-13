import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PLANS } from "@tartan/domain";
import { POST } from "../app/api/webhooks/stripe/route";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createCheckout, createPortal } from "@/server/billing.service";
import { applySubscription } from "@/server/subscription-state.service";
import { makeOrg } from "../tests/helpers";
import { listenToSandbox, sdkOverCli, until, type Delivery } from "./sdk-over-cli";

// Recette volontaire des pages hébergées : aucun appel Stripe ni webhook simulé.
// Le retour vers Tartan est intercepté ; les droits sont prouvés dans la base locale
// via le vrai handler signé, pas via une fausse page de succès.
const sdk = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  billingEnabled: () => true,
  stripe: () => sdk.current,
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), flush: vi.fn().mockResolvedValue(true) }));

const enabled = process.env.RUN_STRIPE_BROWSER === "1";
const stripe = sdkOverCli();
sdk.current = stripe;
const customers = new Set<string>();
const checkoutIds = new Set<string>();
const subscriptions = new Set<string>();
const spaces = new Set<string>();
let browser: Browser | undefined;
let stop: (() => Promise<void>) | undefined;
let deliveries: Delivery[] = [];
const evidence = path.resolve(import.meta.dirname, "../../../.local/stripe-browser");

beforeAll(async () => {
  if (!enabled) return;
  if (process.env.CI) throw new Error("interactive_sandbox_recipe_not_for_ci");
  await mkdir(evidence, { recursive: true, mode: 0o700 });
  const prices = await stripe.prices.list({ limit: 100 });
  const price = prices.data.find((row) => row.lookup_key === "tartan_coach_month" && !row.livemode);
  if (!price) throw new Error("sandbox_coach_price_missing");
  env().STRIPE_PRICE_COACH_MONTH = price.id;
  const portals = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const portal = portals.data.find((row) => row.metadata?.app === "tartan");
  if (!portal || portal.features.subscription_cancel.mode !== "at_period_end")
    throw new Error("sandbox_portal_missing_or_incompatible");
  env().STRIPE_PORTAL_CONFIGURATION_ID = portal.id;
  env().NEXT_PUBLIC_APP_URL = "https://preview.tartan.coach";
  const listener = await listenToSandbox(POST, (secret) => {
    env().STRIPE_WEBHOOK_SECRET = secret;
  });
  stop = listener.stop;
  deliveries = listener.deliveries;
  browser = await chromium.launch({
    channel: "chrome",
    headless: process.env.STRIPE_BROWSER_HEADLESS === "1",
    slowMo: 100,
  });
});

afterAll(async () => {
  const failures: unknown[] = [];
  try {
    await browser?.close();
  } catch (error) {
    failures.push(error);
  }
  // Même une réponse perdue pendant createCheckout peut avoir créé un client distant.
  for (const id of spaces) {
    try {
      const org = await prisma.organization.findUniqueOrThrow({ where: { id } });
      const intent = await prisma.checkoutIntent.findUnique({ where: { organizationId: id } });
      if (org.stripeCustomerId) customers.add(org.stripeCustomerId);
      if (intent?.sessionId) checkoutIds.add(intent.sessionId);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const id of checkoutIds) {
    try {
      const session = await stripe.checkout.sessions.retrieve(id);
      if (session.status === "open") await stripe.checkout.sessions.expire(id);
      if (typeof session.subscription === "string") subscriptions.add(session.subscription);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const id of subscriptions) {
    try {
      if ((await stripe.subscriptions.retrieve(id)).status !== "canceled") await stripe.subscriptions.cancel(id);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const id of customers) {
    try {
      await stripe.customers.del(id);
    } catch (error) {
      failures.push(error);
    }
  }
  await stop?.();
  env().STRIPE_WEBHOOK_SECRET = undefined;
  if (failures.length) throw new AggregateError(failures, "sandbox_browser_cleanup_incomplete");
});

const fillCard = async (page: Page, number: string) => {
  const form = await until("formulaire de paiement", async () => {
    for (const frame of page.frames()) {
      if (await frame.getByRole("button", { name: "Carte bancaire", exact: true }).isVisible()) return frame;
    }
    return null;
  });
  await form.getByRole("button", { name: "Carte bancaire", exact: true }).press("Enter");
  await form.getByRole("textbox", { name: /numéro de carte/i }).fill(number);
  await form.getByRole("textbox", { name: /expiration/i }).fill("12/34");
  await form.getByRole("textbox", { name: /code de sécurité/i }).fill("123");
  await form.getByRole("textbox", { name: /nom complet/i }).fill("Coach Recette Tartan");
  await form.getByRole("combobox", { name: "Adresse", exact: true }).fill("1 rue de la Recette");
  await form.getByRole("combobox", { name: "Adresse", exact: true }).press("Tab");
  await form.getByRole("textbox", { name: /code postal/i }).fill("75001");
  await form.getByRole("textbox", { name: /ville/i }).fill("Paris");
  return form;
};

const authenticate = async (page: Page, name: string) => {
  const complete = await until(
    "authentification 3-D Secure proposée",
    async () => {
      for (const frame of page.frames()) {
        const button = frame.getByRole("button", { name: /^Complete$/ });
        if (await button.isVisible()) return button;
      }
      return null;
    },
    45_000,
  );
  // Une capture pleine page perturbe le rendu des cadres Stripe ; conserver le viewport.
  await page.screenshot({ path: path.join(evidence, `${name}-challenge.png`), fullPage: false });
  await complete.press("Enter");
};

it.skipIf(!enabled).each([
  { name: "carte", number: "4242424242424242", challenge: false },
  { name: "3ds", number: "4000002500003155", challenge: true },
])(
  "Checkout hébergé $name, droits par webhook puis résiliation au portail",
  async ({ name, number, challenge }) => {
    const space = await makeOrg("CheckoutNavigateur");
    spaces.add(space.organizationId);
    await applySubscription({
      organizationId: space.organizationId,
      plan: "discovery",
      status: "active",
      provider: "manual",
      providerRef: null,
      currentPeriodEnd: null,
      cancelAt: null,
    });
    const checkout = await createCheckout(space.owner.userId, space.organizationId, {
      plan: "coach",
      interval: "month",
    });
    expect(new URL(checkout.url).hostname).toBe("checkout.stripe.com");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } });
    customers.add(org.stripeCustomerId!);
    const intent = await prisma.checkoutIntent.findUniqueOrThrow({ where: { organizationId: space.organizationId } });
    checkoutIds.add(intent.sessionId!);
    expect((await stripe.checkout.sessions.retrieve(intent.sessionId!)).livemode).toBe(false);
    const page = await browser!.newPage({ viewport: { width: 1280, height: 1000 }, locale: "fr-FR" });
    await page.route("https://preview.tartan.coach/abonnement**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Retour de recette locale</p>" }),
    );
    try {
      await page.goto(checkout.url);
      const form = await fillCard(page, number);
      await page.screenshot({ path: path.join(evidence, `${name}-checkout.png`), fullPage: false });
      await form.getByRole("button", { name: "Démarrer l’essai" }).press("Enter");
      if (challenge) await authenticate(page, name);
      await browserExpect(page).toHaveURL("https://preview.tartan.coach/abonnement?merci=1", { timeout: 60_000 });
      const subscription = await until("abonnement reçu après Checkout", () =>
        prisma.subscription.findFirst({
          where: { organizationId: space.organizationId, provider: "stripe", status: "trialing" },
        }),
      );
      subscriptions.add(subscription.providerRef!);
      expect((await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan).toBe("coach");
      await until("création de l’abonnement reçue", async () =>
        deliveries.some((row) => row.type === "customer.subscription.created" && row.status === 200),
      );
      expect((await stripe.checkout.sessions.retrieve(intent.sessionId!)).status).toBe("complete");
      // Accélération de l'essai uniquement : la carte vient du navigateur, pas de l'API.
      await stripe.subscriptions.update(subscription.providerRef!, { trial_end: "now" });
      if (challenge) {
        const unpaid = await until("facture à authentifier", () =>
          prisma.billingInvoice.findFirst({
            where: { organizationId: space.organizationId, status: "open", totalCents: { gt: 0 } },
          }),
        );
        await until("demande de validation bancaire en file", () =>
          prisma.emailOutbox.findFirst({
            where: { organizationId: space.organizationId, kind: "payment_action_required" },
          }),
        );
        const remote = await stripe.invoices.retrieve(unpaid.id);
        if (!remote.hosted_invoice_url || new URL(remote.hosted_invoice_url).hostname !== "invoice.stripe.com")
          throw new Error("sandbox_invoice_url_missing");
        await page.goto(remote.hosted_invoice_url);
        await page.getByRole("button", { name: "Confirmer le paiement", exact: true }).press("Enter");
        await authenticate(page, `${name}-invoice`);
      }
      const invoice = await until("première facture payée", () =>
        prisma.billingInvoice.findFirst({
          where: { organizationId: space.organizationId, status: "paid", amountPaidCents: { gt: 0 } },
        }),
      );
      expect(invoice).toMatchObject({ livemode: false, amountPaidCents: PLANS.coach.prices!.month, currency: "eur" });
      await until(
        "abonnement actif après règlement",
        async () =>
          (await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status === "active",
      );
      const portal = await createPortal(space.owner.userId, space.organizationId);
      expect(new URL(portal.url).hostname).toBe("billing.stripe.com");
      await page.goto(portal.url);
      await browserExpect(page.getByRole("link", { name: /19,00.*Payée.*Tartan Coach/i })).toBeVisible();
      await page
        .getByRole("link", { name: /annuler|résilier/i })
        .first()
        .click();
      await page.getByRole("button", { name: "Continuer vers l'annulation" }).click();
      const cancel = page.getByRole("button", { name: /^Annuler l.abonnement$/i });
      await browserExpect(cancel).toBeVisible();
      await page.screenshot({ path: path.join(evidence, `${name}-portal-confirmation.png`), fullPage: false });
      await cancel.click();
      await until(
        "résiliation au portail reçue",
        async () => (await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).cancelAt !== null,
      );
      const remote = await stripe.subscriptions.retrieve(subscription.providerRef!);
      const periodEnd = remote.items.data[0]!.current_period_end;
      // Le portail peut fixer cancel_at à l'échéance avec cancel_at_period_end=false.
      expect(remote.cancel_at_period_end || remote.cancel_at === periodEnd).toBe(true);
      const local = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
      expect(local.cancelAt?.getTime()).toBe(periodEnd * 1000);
      expect((await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan).toBe("coach");
      expect(deliveries.filter((row) => row.status !== 200)).toEqual([]);
      await browserExpect(page.getByRole("link", { name: "Ne pas annuler l’abonnement" })).toBeVisible();
      await page.screenshot({ path: path.join(evidence, `${name}-portal-canceled.png`), fullPage: false });
    } catch (error) {
      await page.screenshot({ path: path.join(evidence, `${name}-failure.png`), fullPage: false });
      await writeFile(path.join(evidence, `${name}-failure.txt`), await page.locator("body").innerText(), {
        mode: 0o600,
      });
      await writeFile(
        path.join(evidence, `${name}-frames.txt`),
        (
          await Promise.all(
            page.frames().map(
              async (frame) =>
                `${frame.name()}\n${(
                  await frame
                    .locator("body")
                    .ariaSnapshot()
                    .catch(() => "unavailable")
                ).replace(/^\s*- \/url:.*$/gm, "")}`,
            ),
          )
        ).join("\n\n"),
        { mode: 0o600 },
      );
      throw error;
    } finally {
      await page.close();
    }
  },
  180_000,
);
