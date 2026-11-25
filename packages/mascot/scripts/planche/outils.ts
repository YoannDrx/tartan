// Ce que les scripts de planche partagent : les couleurs, les fiches du catalogue, l'assemblage du code de la page
// et la mise en image. Les planches sont des outils de relecture, écrites hors du dépôt.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";
// Les couleurs et les fiches viennent de leurs paquets. Ceux-ci dépendent du paquet mascotte (ou n'en sont pas une
// dépendance) : un import par chemin évite une dépendance en boucle, et ne sert qu'à ces scripts.
import { athletePaint, gearPaint } from "../../../design-tokens/src/athletes";
import { tokens } from "../../../design-tokens/src/index";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "../../../domain/src/exercise-catalog";
import type { AthleteId } from "../../src/athletes";
import { framing, sceneSvg, type Box, type ScenePaint } from "../../src/v2/draw-svg";
import type { MotionClip } from "../../src/v2/gesture";
import type { GestureView } from "../../src/v2/project";

export const here = dirname(fileURLToPath(import.meta.url));
export const { color } = tokens;
export { athletePaint, gearPaint };

export const scenePaint = (athlete: AthleteId): ScenePaint => ({ ...gearPaint, ...athletePaint(athlete, "ink") });
export const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// --- Les fiches : le nom, la famille et les lignes du guide de chaque geste -------------------------------

export const FAMILIES = [
  { id: "weightlifting", file: "halterophilie", name: "Haltérophilie" },
  { id: "strength", file: "musculation", name: "Musculation" },
  { id: "plyometrics", file: "pliometrie", name: "Pliométrie" },
  { id: "running", file: "course", name: "Course" },
  { id: "core", file: "gainage", name: "Gainage" },
  { id: "coordination", file: "coordination-et-plots", name: "Coordination et plots" },
  { id: "stairs", file: "escaliers", name: "Escaliers" },
  { id: "warmup", file: "echauffement", name: "Échauffement" },
  { id: "mobility", file: "mobilite", name: "Mobilité" },
] as const;

export type Card = { key: string; name: string; family: string; lines: string[] };
export const CARDS = new Map<string, Card>(
  [...EXERCISE_CATALOG, ...STADIUM_EDITION].map((exercise) => [
    exercise.catalogKey,
    {
      key: exercise.catalogKey,
      name: exercise.name,
      family: exercise.guide.family,
      // Les lignes que le geste illustre : l'installation, puis chaque étape.
      lines: [exercise.guide.setup[0] ?? "", ...exercise.guide.steps],
    },
  ]),
);

export const VIEW_LABEL: Record<GestureView, string> = { side: "de profil", front: "de face", top: "de dessus" };
export const LEVEL_LABEL = { ecrit: "Écrit à la main", releve: "Relevé de l'ancien moteur" } as const;
export const CONSTRAINT_LABEL: Record<string, string> = {
  limits: "amplitudes articulaires",
  ground: "sol",
  feet: "appuis des pieds",
  bar: "barre",
  holds: "tenues",
  loop: "boucle",
};

// --- L'assemblage du code de la page ----------------------------------------------------------------------
// Le paquet n'a pas d'outil d'assemblage : chaque module devient une fonction, comme le ferait un bundler.

export const bundle = (entry: string): string => {
  const ids = new Map<string, number>();
  const modules: string[] = [];
  const locate = (from: string, specifier: string) => {
    const base = resolve(dirname(from), specifier);
    for (const candidate of [`${base}.ts`, resolve(base, "index.ts")]) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        // Pas ce fichier : on essaie le suivant.
      }
    }
    throw new Error(`Module introuvable : ${specifier} depuis ${from}`);
  };
  const visit = (file: string): number => {
    const known = ids.get(file);
    if (known !== undefined) return known;
    const id = ids.size;
    ids.set(file, id);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    });
    const needs: Record<string, number> = {};
    for (const [, specifier] of outputText.matchAll(/require\("([^"]+)"\)/g)) {
      if (!specifier!.startsWith(".")) throw new Error(`La page ne peut pas charger ${specifier} (${file}).`);
      needs[specifier!] = visit(locate(file, specifier!));
    }
    modules[id] = `[${JSON.stringify(needs)},function(require,exports){${outputText}\n}]`;
    return id;
  };
  visit(entry);
  return (
    `(function(){var M=[${modules.join(",")}],C={};` +
    `function R(i){if(C[i])return C[i].exports;var m=C[i]={exports:{}};` +
    `M[i][1](function(s){return R(M[i][0][s])},m.exports);return m.exports}R(0)})();`
  ).replace(/<\/(script)/gi, "<\\/$1");
};
export const pageScript = () => bundle(resolve(here, "page.ts"));

// --- Les images -------------------------------------------------------------------------------------------

export const sized = (svg: string, box: { width: number; height: number }, scale: number, attributes = "") =>
  svg.replace(
    "<svg ",
    `<svg width="${Math.round(box.width * scale)}" height="${Math.round(box.height * scale)}" ${attributes} `,
  );
export const boxOf = (view: string): Box => {
  const [x, y, width, height] = view.split(" ").map(Number) as [number, number, number, number];
  return { x, y, width, height };
};

// Une scène animée du nouveau moteur : le cadre et le sol, que le lecteur de la page remplit.
export const liveScene = (clip: MotionClip, view: GestureView, scale: number, label: string) => {
  const box = framing(clip, view);
  const floor =
    view === "top"
      ? ""
      : `<line x1="${box.x}" y1="2" x2="${box.x + box.width}" y2="2" stroke="${gearPaint.floor}" stroke-width="4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" data-engine="v2" data-key="${clip.key}" data-view="${view}">${floor}<g></g></svg>`;
  return sized(svg, box, scale, `role="img" aria-label="${escape(label)}"`);
};

// La frise d'un geste dans une vue : ses positions, chacune sous la ligne du guide qu'elle illustre.
export const frise = (clip: MotionClip, view: GestureView, scale: number, lines: readonly string[]) => {
  const box = framing(clip, view);
  const paint = scenePaint(clip.athlete);
  return clip.stills
    .map((still, index) => {
      const line = still.guide !== undefined ? (lines[still.guide] ?? "") : "";
      const label = line || `Position ${index + 1}`;
      return (
        `<li>${sized(sceneSvg(clip, still.t, view, paint, box), box, scale, `role="img" aria-label="${escape(label)}"`)}` +
        `<span><b>${index + 1}</b>${line ? ` ${escape(line)}` : ""}</span></li>`
      );
    })
    .join("");
};

export const png = async (file: string, svg: string, density = 96) => {
  await sharp(Buffer.from(svg), { density }).png().toFile(file);
};

// Des images rangées en lignes sur le fond encre.
export type Cell = { svg: string; box: { width: number; height: number }; label?: string; note?: string };
export const sheetOf = (rows: Cell[][], gap = 12, scale = 1) => {
  let y = gap;
  let width = 0;
  const cells: string[] = [];
  for (const row of rows) {
    let x = gap;
    // Une ligne titrée garde la place de ses titres ; les images s'alignent sur le sol.
    const head = row.some((cell) => cell.label) ? 34 : 0;
    const high = Math.max(...row.map(({ box }) => box.height * scale));
    for (const { svg, box, label, note } of row) {
      const [w, h] = [box.width * scale, box.height * scale];
      cells.push(svg.replace("<svg ", `<svg x="${x}" y="${y + head + high - h}" width="${w}" height="${h}" `));
      if (label)
        cells.push(
          `<text x="${x}" y="${y + 14}" fill="${color.white}" font-family="Helvetica, Arial, sans-serif" font-size="13">${escape(label)}</text>` +
            (note
              ? `<text x="${x}" y="${y + 29}" fill="${color.brandOnInk}" font-family="Helvetica, Arial, sans-serif" font-size="11">${escape(note)}</text>`
              : ""),
        );
      x += w + gap;
    }
    width = Math.max(width, x);
    y += head + high + gap;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><rect width="100%" height="100%" fill="${color.ink}"/>${cells.join("")}</svg>`;
};

// --- La feuille de styles et l'enveloppe d'une planche ------------------------------------------------------

export const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: ${color.ink}; color: ${color.white}; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 64px; }
a { color: ${color.film.lime}; }
h1 { font-size: 28px; line-height: 1.15; margin: 0 0 8px; }
h2 { font-size: 22px; margin: 0; }
h3 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; color: ${color.mutedOnInk}; }
p { margin: 0 0 12px; max-width: 72ch; }
.lead, .who, .sources, figcaption, .frise span, .note { color: ${color.mutedOnInk}; }
.who, .sources, figcaption, .frise span, .note { font-size: 14px; }
.bar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 0; background: ${color.ink}; border-bottom: 1px solid ${color.ink3}; }
button { min-height: 44px; padding: 0 16px; border-radius: 8px; border: 1px solid ${color.ink3}; background: ${color.ink2}; color: ${color.white}; font: inherit; cursor: pointer; }
button[data-toggle] { min-width: 96px; margin-right: 8px; background: ${color.film.lime}; border-color: ${color.film.lime}; color: ${color.ink}; font-weight: 600; }
button[data-rate][aria-pressed="true"] { background: ${color.ink3}; border-color: ${color.white}; font-weight: 600; }
button:focus-visible { outline: 2px solid ${color.white}; outline-offset: 2px; }
section { margin-top: 40px; padding-top: 24px; border-top: 4px solid ${color.ink3}; }
.look { margin: 12px 0 20px; padding-left: 20px; max-width: 80ch; }
.scenes { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; margin-top: 16px; }
figure { margin: 0; min-width: 0; }
svg { display: block; max-width: 100%; height: auto; }
figure svg { border-radius: 8px; }
figcaption { margin-top: 6px; }
.phase { margin-top: 12px; min-height: 24px; }
.frise { list-style: none; margin: 0; padding: 0 0 8px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.frise li { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.frise span { max-width: 26ch; min-height: 3em; }
.frise b { color: ${color.white}; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid ${color.ink3}; }
.badge.ecrit { background: ${color.film.lime}; border-color: ${color.film.lime}; color: ${color.ink}; }
.again { margin: 8px 0 0; padding-left: 20px; color: ${color.brandOnInk}; font-size: 14px; max-width: 90ch; }
.wide { overflow-x: auto; }
table { border-collapse: collapse; margin: 16px 0; }
th, td { text-align: left; padding: 6px 16px 6px 0; border-bottom: 1px solid ${color.ink3}; font-size: 15px; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.reduced { display: none; }
@media (prefers-reduced-motion: reduce) {
  .motion, .bar { display: none; }
  .reduced { display: block; }
}
`;

export const controls = `
  <p class="note reduced">Le mouvement réduit est activé sur cet appareil : la planche ne montre que les frises.</p>
  <div class="bar">
    <button type="button" data-toggle aria-pressed="true">Pause</button>
    <button type="button" data-rate="1" aria-pressed="true">Vitesse réelle</button>
    <button type="button" data-rate="0.5" aria-pressed="false">Demi-vitesse</button>
    <button type="button" data-rate="0.25" aria-pressed="false">Quart de vitesse</button>
  </div>`;

export const document = (title: string, body: string, data: unknown, script: string) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${css}</style>
</head>
<body>
<main>
${body}
</main>
<script>window.__PLANCHE__=${JSON.stringify(data)};</script>
<script>${script}</script>
</body>
</html>
`;

// Les couleurs que la page reçoit : celles de chaque athlète sur l'encre, matériel compris.
export const pageData = (clips: readonly MotionClip[], phases: Record<string, string> = {}) => {
  const athletes = [...new Set(clips.map((clip) => clip.athlete))];
  return {
    athletes: Object.fromEntries(athletes.map((id) => [id, athletePaint(id, "ink")])),
    gear: gearPaint,
    scene: Object.fromEntries(athletes.map((id) => [id, scenePaint(id)])),
    phases,
  };
};
