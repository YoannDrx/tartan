// Détecteur d'anti-patterns d'Impeccable sur le web : un travers bloquant fait échouer la vérification (§ 9.12).
import { spawnSync } from "node:child_process";

const res = spawnSync("pnpm", ["exec", "impeccable", "detect", "--json", "apps/web/app", "apps/web/src"], {
  encoding: "utf8",
});
if (res.error) throw res.error;
const out = res.stdout.trim();
const findings = out ? JSON.parse(out.slice(out.indexOf("["))) : [];
for (const f of findings)
  console.log(`${f.file ?? ""}:${f.line ?? ""} ${f.antipattern ?? f.name ?? ""} ${f.snippet ?? f.message ?? ""}`);
console.log(`${findings.length} travers détecté(s).`);
process.exit(findings.length > 0 ? 1 : 0);
