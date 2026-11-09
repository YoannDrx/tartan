#!/usr/bin/env node
// Prépare l'entrée de notes de version : pnpm release:new 1.2.0 [--store] [--ota]
// Sans notes rédigées dans cette entrée, aucune notification ne part.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [version, ...flags] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage : pnpm release:new 1.2.0 [--store] [--ota]");
  process.exit(1);
}

const file = join(dirname(fileURLToPath(import.meta.url)), "../packages/i18n/src/releases.ts");
const source = readFileSync(file, "utf8");
const marker = "export const releases: readonly ReleaseNote[] = [\n";
if (!source.includes(marker)) throw new Error("Manifeste introuvable");
if (source.includes(`id: "${version}"`)) {
  console.error(`La version ${version} existe déjà.`);
  process.exit(1);
}

const targets = ["web: true"];
if (flags.includes("--store")) targets.push(`ios: { version: "${version}" }`, `android: { version: "${version}" }`);
if (flags.includes("--ota")) targets.push(`ota: { version: "${version}" }`);

const entry = `  {
    id: "${version}",
    date: "${new Date().toISOString().slice(0, 10)}",
    title: "À rédiger",
    coach: ["À rédiger"],
    athlete: ["À rédiger"],
    targets: { ${targets.join(", ")} },
  },
`;
writeFileSync(file, source.replace(marker, marker + entry));
console.log(`Entrée ${version} ajoutée à packages/i18n/src/releases.ts : rédige le titre et les notes.`);
if (flags.includes("--store")) console.log("Pense à aligner la version de apps/mobile/app.config.ts.");
