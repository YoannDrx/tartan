// À lancer avec --project <id> --scope <équipe> : ne jamais dépendre du projet courant de la CLI.
// Compare chaque secret entre environnements par empreinte : aucune valeur n'est affichée ni conservée.
// Vercel ne renvoie jamais une variable « sensible » : elle apparaît illisible, et se contrôle dans le tableau de bord.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ENVIRONMENTS = ["production", "preview", "development"];
export const ISOLATED_VARIABLES = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "BETTER_AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_WEBHOOK_SECRET",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_PRIVATE_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "CRON_SECRET",
];

export const parseDotenv = (text) => {
  const values = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
};

export const fingerprint = (value) => createHash("sha256").update(value).digest("hex");
const readable = (value) => value && !/^\[?(sensitive|encrypted|redacted)\]?$/i.test(value) && !/^\*+$/.test(value);

// production comparée à chaque autre environnement.
export const compareEnvironments = (byEnvironment, variables = ISOLATED_VARIABLES) =>
  variables.map((name) => {
    const production = byEnvironment.production?.[name];
    const others = ENVIRONMENTS.filter((environment) => environment !== "production").map((environment) => {
      const value = byEnvironment[environment]?.[name];
      if (!readable(production)) return { environment, status: "illisible ou absent en production" };
      if (!readable(value)) return { environment, status: "illisible ou absent" };
      return { environment, status: fingerprint(value) === fingerprint(production) ? "identique" : "distinct" };
    });
    return { name, others };
  });

const pull = (environment, directory, project, scope) => {
  const file = path.join(directory, `${environment}.env`);
  execFileSync(
    "vercel",
    ["--scope", scope, "env", "pull", file, "--project", project, `--environment=${environment}`, "--yes"],
    { stdio: "ignore" },
  );
  return parseDotenv(readFileSync(file, "utf8"));
};

const main = () => {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes("--project") || !process.argv.includes("--scope")) {
    console.error("Préciser --project <id> --scope <équipe> pour contrôler le bon projet.");
    process.exitCode = 2;
    return;
  }
  const project = arg("--project");
  const scope = arg("--scope");
  const directory = mkdtempSync(path.join(tmpdir(), "tartan-isolation-"));
  try {
    const byEnvironment = Object.fromEntries(ENVIRONMENTS.map((name) => [name, pull(name, directory, project, scope)]));
    const results = compareEnvironments(byEnvironment);
    for (const { name, others } of results) {
      console.log(`${name.padEnd(32)} ${others.map((o) => `${o.environment} : ${o.status}`).join("  |  ")}`);
    }
    const shared = results.some(({ others }) => others.some((o) => o.status === "identique"));
    const unread = results.some(({ others }) => others.some((o) => o.status.startsWith("illisible")));
    if (shared)
      console.log("\nAu moins un secret est partagé avec la production : à séparer avant tout essai destructif.");
    if (unread)
      console.log(
        "\nVariable illisible : soit sensible, soit absente. Ce script ne prouve rien pour elle : contrôle-la dans Vercel.",
      );
    if (!shared && !unread) console.log("\nTout est distinct.");
    process.exitCode = shared ? 1 : unread ? 2 : 0;
  } catch {
    console.error(
      "Lecture Vercel impossible. Vérifier l’authentification CLI et le projet ; aucune isolation n’est certifiée.",
    );
    process.exitCode = 2;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
