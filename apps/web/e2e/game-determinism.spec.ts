import { expect, test } from "@playwright/test";
import { SIM_VERSION, replay } from "@tartan/game";
import { hurdles } from "@tartan/game/events/hurdles";
import { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS, fuzzSummary } from "@tartan/game/reference";
import { build } from "esbuild";

// Preuve inter-navigateurs du jeu. Le classement repose sur une relecture côté serveur : le score
// calculé dans le navigateur du joueur doit être, au chiffre près, celui que Node recalcule.
// La simulation est empaquetée telle qu'elle le sera pour le site, injectée dans une page vide,
// puis rejouée dans le moteur du navigateur (V8 pour Chromium, JavaScriptCore pour WebKit).

interface BrowserReport {
  version: number;
  runs: { name: string; ok: boolean; score: number | null; ticks: number; digest: number; state: unknown }[];
  fuzz: number;
}

declare global {
  var TartanGameProof: { run: () => BrowserReport };
}

const ENTRY = `
  import { SIM_VERSION, replay } from "@tartan/game";
  import { hurdles } from "@tartan/game/events/hurdles";
  import { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS, fuzzSummary } from "@tartan/game/reference";

  export const run = () => ({
    version: SIM_VERSION,
    runs: HURDLES_REFERENCE_RUNS.map((reference) => {
      const result = replay(hurdles, reference.seed, reference.inputs);
      return result.ok
        ? { name: reference.name, ok: true, score: result.score, ticks: result.ticks, digest: result.digest, state: result.state }
        : { name: reference.name, ok: false, score: null, ticks: 0, digest: 0, state: result.error };
    }),
    fuzz: fuzzSummary(hurdles, HURDLES_FUZZ.from, HURDLES_FUZZ.count),
  });
`;

let bundle = "";

test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: import.meta.dirname, loader: "ts" },
    bundle: true,
    format: "iife",
    globalName: "TartanGameProof",
    platform: "browser",
    target: "es2020",
    write: false,
    logLevel: "silent",
  });
  bundle = result.outputFiles[0]?.text ?? "";
});

test("les parties de référence donnent le même score dans le navigateur que sous Node", async ({
  page,
  browserName,
}) => {
  expect(bundle.length).toBeGreaterThan(1_000);
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle });
  const report = await page.evaluate(() => globalThis.TartanGameProof.run());

  expect(report.version).toBe(SIM_VERSION);
  expect(report.runs).toHaveLength(HURDLES_REFERENCE_RUNS.length);
  for (const reference of HURDLES_REFERENCE_RUNS) {
    const underNode = replay(hurdles, reference.seed, reference.inputs);
    if (!underNode.ok) throw new Error(`${reference.name} : ${underNode.error}`);
    const inBrowser = report.runs.find((run) => run.name === reference.name);
    const label = `${reference.name} (${browserName})`;
    // Le navigateur, Node et la valeur figée dans le paquet : trois fois le même résultat.
    expect(inBrowser, label).toMatchObject({
      ok: true,
      score: reference.score,
      ticks: reference.ticks,
      digest: reference.digest,
    });
    expect(inBrowser?.score, label).toBe(underNode.score);
    expect(inBrowser?.digest, label).toBe(underNode.digest);
    expect(inBrowser?.state, label).toEqual(underNode.state);
  }
});

test("300 journaux pseudo-aléatoires se rejouent à l'identique dans le navigateur", async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle });
  const report = await page.evaluate(() => globalThis.TartanGameProof.run());

  expect(report.fuzz).toBe(HURDLES_FUZZ.summary);
  expect(report.fuzz).toBe(fuzzSummary(hurdles, HURDLES_FUZZ.from, HURDLES_FUZZ.count));
});
