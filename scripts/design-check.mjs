// Détecteur d'anti-patterns d'Impeccable sur le web : un travers bloquant fait échouer la vérification (§ 9.12).
// Il tourne depuis le paquet `impeccable` figé dans package.json, le même moteur que le skill.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGETS = ["apps/web/app", "apps/web/src"];

const detect = (...targets) => {
  const res = spawnSync("pnpm", ["exec", "impeccable", "detect", "--json", ...targets], { encoding: "utf8" });
  if (res.error) throw res.error;
  // 0 : rien à signaler ; 2 : des travers. Tout le reste est une panne, jamais un résultat propre.
  if (res.status !== 0 && res.status !== 2) {
    console.error(res.stderr);
    console.error(`Le détecteur n'a pas tourné (code ${res.status}).`);
    process.exit(1);
  }
  const out = res.stdout.trim();
  return out ? JSON.parse(out.slice(out.indexOf("["))) : [];
};

// Témoin : un fichier qui contient un travers connu doit être signalé, sinon le détecteur ne protège plus rien.
const dir = mkdtempSync(join(tmpdir(), "tartan-design-"));
writeFileSync(
  join(dir, "temoin.tsx"),
  `export const T = () => <div className="border-l-4 border-l-red-500 rounded-xl p-4" />;\n`,
);
const witness = detect(dir);
rmSync(dir, { recursive: true, force: true });
if (witness.length === 0) {
  console.error("Le détecteur n'a pas repéré le travers témoin : il ne vérifie plus rien.");
  process.exit(1);
}

const findings = detect(...TARGETS);
for (const f of findings)
  console.log(`${f.file ?? ""}:${f.line ?? ""} ${f.antipattern ?? f.name ?? ""} ${f.snippet ?? f.message ?? ""}`);

// Ce que le détecteur ne voit pas, et que le § 9.11 ou le registre interdisent quand même.
const walk = (path) =>
  statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => walk(join(path, name))) : [path];
const RULES = [
  { pattern: /text-transform:\s*uppercase|(^|[\s"'`])uppercase([\s"'`]|$)/, why: "capitales d'affichage (§ 9.11)" },
  { pattern: /window\.confirm\(/, why: "confirmation native : utiliser ConfirmDialog" },
];
let own = 0;
for (const file of TARGETS.flatMap(walk).filter((f) => /\.(tsx|ts|css)$/.test(f) && !f.includes("/generated/"))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) continue;
        own += 1;
        console.log(`${file}:${index + 1} ${rule.why}`);
      }
    });
}

const total = findings.length + own;
console.log(`${total} travers détecté(s).`);
process.exit(total > 0 ? 1 : 0);
