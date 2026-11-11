import { readFileSync } from "node:fs";
import path from "node:path";
import { RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import plugin from "../eslint-rules/index.mjs";

// Les garde-fous de DESIGN.md : chaque règle doit refuser son travers, et laisser passer l'écriture attendue.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run("no-raw-color", plugin.rules["no-raw-color"], {
  valid: [
    `const a = <div className="bg-card text-fg" />;`,
    `const anchor = "/#tarifs";`,
    `const color = tokens.color.brand;`,
    `import x from "./rgb(a)";`,
  ],
  invalid: [
    { code: `const c = "#C4442B";`, errors: [{ messageId: "raw" }] },
    { code: `const c = "#fff";`, errors: [{ messageId: "raw" }] },
    { code: `const a = <div className="shadow-[0_8px_24px_rgba(21,22,26,0.16)]" />;`, errors: [{ messageId: "raw" }] },
    { code: "const c = `1px solid hsl(0 0% ${l}%)`;", errors: [{ messageId: "raw" }] },
  ],
});

tester.run("no-default-palette", plugin.rules["no-default-palette"], {
  valid: [
    `const a = <div className="bg-ink text-on-ink border-control-line" />;`,
    `const a = <div className="bg-film-lime text-accent hover:bg-accent-hover" />;`,
    `const label = "texte blanc sur fond white";`,
  ],
  invalid: [
    { code: `const a = <div className="bg-black" />;`, errors: [{ messageId: "palette" }] },
    { code: `const a = <div className="p-4 text-white" />;`, errors: [{ messageId: "palette" }] },
    { code: `const a = <div className="hover:bg-red-500/50" />;`, errors: [{ messageId: "palette" }] },
    { code: "const c = cn(`border-gray-200 ${x}`);", errors: [{ messageId: "palette" }] },
  ],
});

tester.run("no-hardcoded-text", plugin.rules["no-hardcoded-text"], {
  valid: [
    `const a = <h1>{m.landing.title}</h1>;`,
    `const a = <p>{count} / {total}</p>;`,
    `const a = <img alt="" src={src} />;`,
    `const a = <input placeholder={m.auth.email} type="email" />;`,
    `const a = <span>{done ? m.common.yes : m.common.no}</span>;`,
  ],
  invalid: [
    { code: `const a = <h1>Crée ton espace coach</h1>;`, errors: [{ messageId: "text" }] },
    { code: `const a = <Field label="Prénom" />;`, errors: [{ messageId: "text" }] },
    { code: `const a = <button aria-label={"Fermer"} />;`, errors: [{ messageId: "text" }] },
    { code: `const a = <span>{done ? "Oui" : "Non"}</span>;`, errors: [{ messageId: "text" }, { messageId: "text" }] },
    { code: "const a = <p>{`Bonjour ${name}`}</p>;", errors: [{ messageId: "text" }] },
  ],
});

// Les textes en dur d'avant la règle sont gelés ; cette base ne peut que rétrécir.
describe("base des textes en dur", () => {
  const suppressions = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "../eslint-suppressions.json"), "utf8"),
  ) as Record<string, Record<string, { count: number }>>;

  it("ne gèle que les textes, jamais une couleur", () => {
    const rules = new Set(Object.values(suppressions).flatMap((entry) => Object.keys(entry)));
    expect([...rules]).toEqual(["tartan/no-hardcoded-text"]);
  });

  it("ne dépasse pas le volume du 11 novembre 2026", () => {
    const total = Object.values(suppressions).reduce(
      (sum, entry) => sum + (entry["tartan/no-hardcoded-text"]?.count ?? 0),
      0,
    );
    expect(total).toBeLessThanOrEqual(274);
  });
});
