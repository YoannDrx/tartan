import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import Stripe from "stripe";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/stripe-webhook-events";
import { SANDBOX_ACCOUNT } from "./stripe-cli";

const exec = promisify(execFile);

// La session CLI porte les clés : aucune variable de clé ne passe du test à la commande.
const cliEnv = () => {
  const env = { ...process.env };
  delete env.STRIPE_API_KEY;
  delete env.STRIPE_SECRET_KEY;
  return env;
};

const statusOf = (error: { type?: string; code?: string }): number => {
  if (error.code === "resource_missing") return 404;
  if (error.type === "card_error") return 402;
  if (error.type === "api_error") return 500;
  return 400;
};

// Le réseau du SDK Stripe passe par la CLI : le SDK construit ses requêtes, lit les vraies réponses
// de la sandbox et lève ses propres classes d'erreur, sans jamais détenir de clé.
export const cliFetch: typeof fetch = async (input, init) => {
  if (process.env.RUN_STRIPE_SANDBOX !== "1") throw new Error("sandbox_opt_in_required");
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method ?? "GET").toLowerCase();
  const pairs =
    method === "get"
      ? [...url.searchParams]
      : [...new URLSearchParams(typeof init?.body === "string" ? init.body : "")];
  const args = [method, url.pathname, "--stripe-context", SANDBOX_ACCOUNT, "--stripe-version", Stripe.API_VERSION];
  if (method !== "get") args.push("--confirm");
  for (const [key, value] of pairs) args.push("-d", `${key}=${value}`);
  const idempotencyKey = new Headers(init?.headers).get("idempotency-key");
  if (idempotencyKey) args.push("--idempotency", idempotencyKey);
  let stdout: string;
  try {
    ({ stdout } = await exec("stripe", args, { env: cliEnv(), timeout: 45_000, maxBuffer: 4 * 1024 * 1024 }));
  } catch (error) {
    const output = typeof error === "object" && error !== null && "stdout" in error ? String(error.stdout) : "";
    let parsed: { error?: { type?: string; code?: string } } = {};
    try {
      parsed = JSON.parse(output);
    } catch {
      /* la commande n'a rien rendu d'exploitable */
    }
    if (!parsed.error) throw new Error("stripe_cli_request_failed");
    return new Response(output, { status: statusOf(parsed.error), headers: { "content-type": "application/json" } });
  }
  const result = JSON.parse(stdout) as { livemode?: boolean };
  if (result.livemode === true) throw new Error("live_resource_forbidden");
  return new Response(stdout, { status: 200, headers: { "content-type": "application/json" } });
};

// La clé donnée au SDK est factice : elle ne quitte jamais le processus, `cliFetch` ne transmet aucun en-tête.
export const sdkOverCli = () =>
  new Stripe("sk_test_cle_factice_jamais_envoyee", {
    httpClient: Stripe.createFetchHttpClient(cliFetch),
    maxNetworkRetries: 0,
  });

export type Delivery = { type: string; status: number };

// Un serveur HTTP local devant le vrai handler, et `stripe listen` qui lui transmet les événements
// signés de la sandbox. Le secret de signature reste en mémoire : il n'est ni affiché ni écrit.
export const listenToSandbox = async (
  handler: (request: Request) => Promise<Response>,
  onSecret: (secret: string) => void,
) => {
  const account = JSON.parse((await exec("stripe", ["get", "/v1/account"], { env: cliEnv() })).stdout) as {
    id: string;
  };
  if (account.id !== SANDBOX_ACCOUNT) throw new Error("stripe_cli_default_account_is_not_the_sandbox");
  onSecret((await exec("stripe", ["listen", "--print-secret"], { env: cliEnv(), timeout: 30_000 })).stdout.trim());

  const deliveries: Delivery[] = [];
  const server: Server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }
      void handler(new Request(`http://127.0.0.1${incoming.url}`, { method: "POST", headers, body }))
        .then(async (response) => {
          let type = "inconnu";
          try {
            type = (JSON.parse(body) as { type: string }).type;
          } catch {
            /* corps illisible : le handler a déjà répondu 400 */
          }
          deliveries.push({ type, status: response.status });
          outgoing.writeHead(response.status, { "content-type": "application/json" });
          outgoing.end(await response.text());
        })
        .catch(() => {
          outgoing.writeHead(500);
          outgoing.end();
        });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  const child: ChildProcess = spawn(
    "stripe",
    [
      "listen",
      "--forward-to",
      `http://127.0.0.1:${port}/api/webhooks/stripe`,
      "--events",
      STRIPE_WEBHOOK_EVENTS.join(","),
    ],
    { env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] },
  );
  // La sortie de la commande contient le secret de signature : elle est lue, jamais recopiée.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("stripe_listen_not_ready")), 60_000);
    const watch = (chunk: Buffer) => {
      if (chunk.toString("utf8").includes("Ready!")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", watch);
    child.stderr?.on("data", watch);
    child.once("exit", () => reject(new Error("stripe_listen_exited")));
  });

  return {
    deliveries,
    stop: async () => {
      child.kill("SIGINT");
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

// Les webhooks arrivent après coup : on attend l'état voulu, sans dormir à l'aveugle.
export const until = async <T>(
  what: string,
  read: () => Promise<T | null | undefined | false>,
  timeoutMs = 90_000,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`attente dépassée : ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
};
