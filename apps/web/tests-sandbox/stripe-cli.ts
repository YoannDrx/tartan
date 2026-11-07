import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Stripe from "stripe";

export const SANDBOX_ACCOUNT = "acct_1UXJsn7nmxxw9EFI";
const exec = promisify(execFile);

const encode = (value: unknown, prefix = ""): string[] => {
  if (value === undefined) return [];
  if (value === null) return [`${prefix}=`];
  if (typeof value !== "object") return [`${prefix}=${String(value)}`];
  return Object.entries(value).flatMap(([key, nested]) => encode(nested, prefix ? `${prefix}[${key}]` : key));
};

// Transport CLI, aucune réponse Stripe simulée. Les clés restent dans la session CLI.
// --live n'est jamais transmis ; le contexte est fixé à la sandbox dédiée et vérifié au setup.
export const stripeCli = async <T>(
  method: "get" | "post" | "delete",
  path: string,
  params: unknown = {},
  key?: string,
): Promise<T> => {
  if (process.env.RUN_STRIPE_SANDBOX !== "1") throw new Error("sandbox_opt_in_required");
  const args = [method, path, "--stripe-context", SANDBOX_ACCOUNT, "--stripe-version", Stripe.API_VERSION];
  if (method !== "get") args.push("--confirm");
  for (const field of encode(params)) args.push("-d", field);
  if (key) args.push("--idempotency", key);
  const childEnv = { ...process.env };
  delete childEnv.STRIPE_API_KEY;
  delete childEnv.STRIPE_SECRET_KEY;
  let stdout: string;
  try {
    ({ stdout } = await exec("stripe", args, { env: childEnv, timeout: 45_000, maxBuffer: 1024 * 1024 }));
  } catch (error) {
    const output = typeof error === "object" && error !== null && "stdout" in error ? String(error.stdout) : "";
    let code = "stripe_cli_request_failed";
    try {
      code = JSON.parse(output).error?.code ?? code;
    } catch {
      /* aucun contenu de réponse dans les logs */
    }
    throw new Error(code);
  }
  const result = JSON.parse(stdout) as T & { error?: { code?: string; type?: string }; livemode?: boolean };
  if (result.error) throw new Error(result.error.code ?? result.error.type ?? "stripe_cli_request_failed");
  if (result.livemode === true) throw new Error("live_resource_forbidden");
  return result;
};

export const transport = {
  customers: [] as string[],
  checkoutIds: [] as string[],
  loseCheckoutResponse: false,
  rejectCancellation: false,
  afterCheckout: undefined as (() => Promise<void>) | undefined,
};

export const cliStripe = {
  customers: {
    create: async (params: Stripe.CustomerCreateParams, options: { idempotencyKey: string }) => {
      const row = await stripeCli<Stripe.Customer>("post", "/v1/customers", params, options.idempotencyKey);
      transport.customers.push(row.id);
      return row;
    },
  },
  checkout: {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) => {
        const row = await stripeCli<Stripe.Checkout.Session>(
          "post",
          "/v1/checkout/sessions",
          params,
          options.idempotencyKey,
        );
        transport.checkoutIds.push(row.id);
        if (transport.afterCheckout) await transport.afterCheckout();
        if (transport.loseCheckoutResponse) {
          transport.loseCheckoutResponse = false;
          throw new Error("response_lost_after_stripe_success");
        }
        return row;
      },
      retrieve: (id: string) => stripeCli<Stripe.Checkout.Session>("get", `/v1/checkout/sessions/${id}`),
      expire: (id: string) => stripeCli<Stripe.Checkout.Session>("post", `/v1/checkout/sessions/${id}/expire`),
      list: (params: Stripe.Checkout.SessionListParams) =>
        stripeCli<Stripe.ApiList<Stripe.Checkout.Session>>("get", "/v1/checkout/sessions", params),
    },
  },
  subscriptions: {
    list: (params: Stripe.SubscriptionListParams) =>
      stripeCli<Stripe.ApiList<Stripe.Subscription>>("get", "/v1/subscriptions", params),
    retrieve: (id: string) => stripeCli<Stripe.Subscription>("get", `/v1/subscriptions/${id}`),
    update: (id: string, params: Stripe.SubscriptionUpdateParams) => {
      if (transport.rejectCancellation) throw new Error("simulated_network_unavailable");
      return stripeCli<Stripe.Subscription>("post", `/v1/subscriptions/${id}`, params);
    },
  },
  billingPortal: {
    sessions: {
      create: (params: Stripe.BillingPortal.SessionCreateParams) =>
        stripeCli<Stripe.BillingPortal.Session>("post", "/v1/billing_portal/sessions", params),
    },
  },
};
