import { expect, test } from "@playwright/test";
import { type GameEvent, SIM_VERSION, type SimState, replay } from "@tartan/game";
import { REFERENCES, fuzzSummary } from "@tartan/game/reference";
import { build } from "esbuild";

// Preuve inter-navigateurs du jeu. Le classement repose sur une relecture côté serveur : le score
// calculé dans le navigateur du joueur doit être, au chiffre près, celui que Node recalcule.
// La simulation est empaquetée telle qu'elle le sera pour le site, injectée dans une page vide,
// puis rejouée dans le moteur du navigateur (V8 pour Chromium, JavaScriptCore pour WebKit).

interface BrowserReport {
  version: number;
  runs: { name: string; ok: boolean; score: number | null; ticks: number; digest: number; state: unknown }[];
  fuzz: Record<string, number>;
}

declare global {
  var TartanGameProof: { run: () => BrowserReport };
}

const ENTRY = `
  import { SIM_VERSION, replay } from "@tartan/game";
  import { REFERENCES, fuzzSummary } from "@tartan/game/reference";

  export const run = () => ({
    version: SIM_VERSION,
    runs: REFERENCES.flatMap(({ event, runs }) =>
      runs.map((reference) => {
        const name = event.id + "/" + reference.name;
        const result = replay(event, reference.seed, reference.inputs);
        return result.ok
          ? { name, ok: true, score: result.score, ticks: result.ticks, digest: result.digest, state: result.state }
          : { name, ok: false, score: null, ticks: 0, digest: 0, state: result.error };
      }),
    ),
    fuzz: Object.fromEntries(REFERENCES.map(({ event, fuzz }) => [event.id, fuzzSummary(event, fuzz.from, fuzz.count)])),
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
  const cases = REFERENCES.flatMap(({ event, runs }) =>
    runs.map((reference) => ({ event: event as GameEvent<SimState>, reference })),
  );
  expect(report.runs).toHaveLength(cases.length);
  for (const { event, reference } of cases) {
    const name = `${event.id}/${reference.name}`;
    const underNode = replay(event, reference.seed, reference.inputs);
    if (!underNode.ok) throw new Error(`${name} : ${underNode.error}`);
    const inBrowser = report.runs.find((run) => run.name === name);
    const label = `${name} (${browserName})`;
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

  for (const { event, fuzz } of REFERENCES) {
    expect(report.fuzz[event.id], event.id).toBe(fuzz.summary);
    expect(report.fuzz[event.id], event.id).toBe(fuzzSummary(event as GameEvent<SimState>, fuzz.from, fuzz.count));
  }
});
