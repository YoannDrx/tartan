// La planche de validation du prototype des gestes : l'ancien moteur et le nouveau côte à côte, en mouvement,
// puis la frise des positions clés du nouveau, de profil et de face. Un seul fichier HTML, sans ressource externe,
// et quelques images fixes en PNG à côté.
//
//   corepack pnpm --filter @tartan/web exec tsx ../../packages/mascot/scripts/planche-gestes.ts <dossier de sortie>
//
// Le paquet n'a ni `tsx` ni outil d'assemblage : le script emprunte le `tsx` du web, et assemble lui-même le code
// de la page avec le compilateur TypeScript (chaque module devient une fonction, comme le ferait un bundler).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";
// Les couleurs viennent des jetons de design. Le paquet des jetons dépend de celui-ci : un import par chemin
// évite une dépendance en boucle, et ne sert qu'à ce script.
import { athletePaint, gearPaint } from "../../design-tokens/src/athletes";
import { tokens } from "../../design-tokens/src/index";
import type { AthleteId } from "../src/athletes";
import { EXERCISE_CLIPS } from "../src/exercises";
import { HEADS } from "../src/v2/body";
import { framing, sceneSvg, type Box, type ScenePaint } from "../src/v2/draw-svg";
import type { MotionClip } from "../src/v2/gesture";
import { GESTURES } from "../src/v2/gestures";
import type { GestureView } from "../src/v2/project";
import { v1SceneSvg } from "./planche/v1-scene";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error("Usage : planche-gestes.ts <dossier de sortie>");
mkdirSync(out, { recursive: true });

// --- Ce que la planche dit de chaque geste --------------------------------------------------------

type Sheet = { key: string; file: string; title: string; who: string; look: string[]; sources: string };
const SHEETS: Sheet[] = [
  {
    key: "snatch",
    file: "arrache",
    title: "Arraché",
    who: "Malo, haltérophilie",
    look: [
      "L'ordre des phases : première tirée jusqu'aux genoux, transition, seconde tirée, passage sous la barre, réception, redressement.",
      "L'accélération : la première tirée est lente, la seconde explosive, le passage sous la barre très rapide, la réception amortie.",
      "La barre reste près du corps, les deux mains dessus ; de face, la prise large se voit.",
      "Les pieds ne glissent pas : ils décollent à l'extension et se reposent plus écartés.",
    ],
    sources:
      "Everett (Catalyst Athletics, 2014 et 2018) ; Harbili et Alptekin (J Sports Sci Med, 2014) ; Gourgoulis et al. (J Sports Sci, 2000).",
  },
  {
    key: "back-squat",
    file: "squat-arriere",
    title: "Squat arrière",
    who: "Mehdi, musculation",
    look: [
      "La barre descend et remonte à l'aplomb du milieu du pied.",
      "En bas, les cuisses passent la parallèle, les talons restent au sol, les genoux suivent les pointes.",
      "La descente est lente, la remontée plus rapide.",
    ],
    sources: "Myer et al. (Strength Cond J, 2014) ; Schoenfeld (J Strength Cond Res, 2010).",
  },
  {
    key: "lateral-lunge",
    file: "fente-laterale",
    title: "Fente latérale",
    who: "Mehdi, musculation",
    look: [
      "De face : un grand pas de côté, le genou fléchi au-dessus du pied, l'autre jambe tendue, les deux pieds à plat.",
      "De profil : les hanches reculent, le buste s'incline, le dos reste droit.",
      "Le pied d'appui ne bouge pas ; l'autre pousse le sol avant de revenir.",
    ],
    sources: "American Council on Exercise, « Side Lunge ».",
  },
];

const scenePaint = (athlete: AthleteId): ScenePaint => ({
  ...athletePaint(athlete, "ink"),
  plate: gearPaint.plate,
  iron: gearPaint.iron,
  floor: gearPaint.floor,
});
const VIEWS: { view: GestureView; label: string }[] = [
  { view: "side", label: "de profil" },
  { view: "front", label: "de face" },
];
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// --- L'assemblage du code de la page ---------------------------------------------------------------

const bundle = (entry: string): string => {
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
  );
};

// --- Les images --------------------------------------------------------------------------------------

// L'échelle des scènes animées et des frises, en pixels par unité du corps.
const SCALE = { scene: 0.8, still: 0.5 };
const sized = (svg: string, box: { width: number; height: number }, scale: number, attributes = "") =>
  svg.replace(
    "<svg ",
    `<svg width="${Math.round(box.width * scale)}" height="${Math.round(box.height * scale)}" ${attributes} `,
  );
const boxOf = (view: string): Box => {
  const [x, y, width, height] = view.split(" ").map(Number) as [number, number, number, number];
  return { x, y, width, height };
};

const frise = (clip: MotionClip, view: GestureView, paint: ScenePaint) => {
  const box = framing(clip, view);
  return clip.stills
    .map(
      (still, index) =>
        `<li>${sized(sceneSvg(clip, still.t, view, paint, box), box, SCALE.still, `role="img" aria-label="${escape(still.name)}"`)}` +
        `<span><b>${index + 1}</b> ${escape(still.name)}</span></li>`,
    )
    .join("");
};

const section = (sheet: Sheet) => {
  const clip = GESTURES[sheet.key]!;
  const old = EXERCISE_CLIPS[sheet.key]!;
  const paint = scenePaint(clip.athlete);
  const oldBox = boxOf(old.view);
  const oldLabel = old.facing === "side" ? "de profil" : "de face (il n'existe pas de profil)";
  const scenes = VIEWS.map(({ view, label }) => {
    const box = framing(clip, view);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" data-engine="v2" data-key="${clip.key}" data-view="${view}">` +
      `<line x1="${box.x}" y1="2" x2="${box.x + box.width}" y2="2" stroke="${paint.floor}" stroke-width="4"/><g></g></svg>`;
    return `<figure>${sized(svg, box, SCALE.scene, `role="img" aria-label="${escape(sheet.title)}, nouveau moteur, ${label}"`)}<figcaption>Nouveau moteur, ${label}</figcaption></figure>`;
  }).join("");
  const oldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${old.view}" data-engine="v1" data-key="${old.key}"></svg>`;
  return `
<section>
  <header>
    <h2>${escape(sheet.title)}</h2>
    <p class="who">${escape(sheet.who)} · boucle de ${(clip.duration / 1000).toFixed(1).replace(".", ",")} s</p>
  </header>
  <ul class="look">${sheet.look.map((line) => `<li>${escape(line)}</li>`).join("")}</ul>
  <div class="scenes motion">
    <figure class="old">${sized(oldSvg, oldBox, SCALE.scene, `role="img" aria-label="${escape(sheet.title)}, ancien moteur"`)}<figcaption>Ancien moteur, ${oldLabel}</figcaption></figure>
    ${scenes}
  </div>
  <p class="phase motion">Phase en cours : <b data-phase></b></p>
  ${VIEWS.map(
    ({ view, label }) =>
      `<h3>Positions clés du nouveau moteur, ${label}</h3><ol class="frise">${frise(clip, view, paint)}</ol>`,
  ).join("")}
  <p class="sources">Repères techniques : ${escape(sheet.sources)}</p>
</section>`;
};

const { color } = tokens;
const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: ${color.ink}; color: ${color.white}; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 28px; line-height: 1.15; margin: 0 0 8px; }
h2 { font-size: 24px; margin: 0; }
h3 { font-size: 15px; font-weight: 600; margin: 28px 0 8px; color: ${color.mutedOnInk}; }
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
.scenes { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; }
figure { margin: 0; min-width: 0; }
svg { display: block; max-width: 100%; height: auto; }
figure svg { border-radius: 8px; }
figure.old { opacity: 0.92; }
figcaption { margin-top: 6px; }
.phase { margin-top: 12px; min-height: 24px; }
.frise { list-style: none; margin: 0; padding: 0 0 8px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.frise li { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.frise span { max-width: 20ch; min-height: 3em; }
.frise b { color: ${color.white}; }
.reduced { display: none; }
@media (prefers-reduced-motion: reduce) {
  .motion, .bar { display: none; }
  .reduced { display: block; }
}
`;

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prototype des gestes : planche de validation</title>
<style>${css}</style>
</head>
<body>
<main>
  <h1>Prototype des gestes : arraché, squat arrière, fente latérale</h1>
  <p class="lead">À gauche, le geste tel qu'il est aujourd'hui dans l'application. À droite, le même geste avec le nouveau moteur : une seule description, vue de profil et de face, et un personnage plus fin (${HEADS.toFixed(1).replace(".", ",")} têtes au lieu de 3,6). Sous chaque geste, la frise de ses positions clés.</p>
  <p class="note">Deux conventions de dessin : de profil, les disques passent derrière l'athlète pour laisser voir les jambes et les mains, et la tête passe devant le bras qui la croise. Le retour de la barre au sol, après l'arraché, ne fait pas partie de la technique : il referme seulement la boucle.</p>
  <p class="note reduced">Le mouvement réduit est activé sur cet appareil : la planche ne montre que les frises.</p>
  <div class="bar">
    <button type="button" data-toggle aria-pressed="true">Pause</button>
    <button type="button" data-rate="1" aria-pressed="true">Vitesse réelle</button>
    <button type="button" data-rate="0.5" aria-pressed="false">Demi-vitesse</button>
    <button type="button" data-rate="0.25" aria-pressed="false">Quart de vitesse</button>
  </div>
  ${SHEETS.map(section).join("")}
</main>
<script>window.__PLANCHE__=${JSON.stringify({
  athletes: Object.fromEntries(
    SHEETS.map((sheet) => [GESTURES[sheet.key]!.athlete, athletePaint(GESTURES[sheet.key]!.athlete, "ink")]),
  ),
  gear: gearPaint,
  scene: Object.fromEntries(
    SHEETS.map((sheet) => [GESTURES[sheet.key]!.athlete, scenePaint(GESTURES[sheet.key]!.athlete)]),
  ),
})};</script>
<script>${bundle(resolve(here, "planche/page.ts")).replace(/<\/(script)/gi, "<\\/$1")}</script>
</body>
</html>
`;
writeFileSync(resolve(out, "planche.html"), page);

// --- Les images fixes : une planche de positions par geste, puis l'ancien et le nouveau à un même instant ----

const png = async (name: string, svg: string) => {
  await sharp(Buffer.from(svg), { density: 96 }).png().toFile(resolve(out, name));
};
const sheetOf = (rows: { svg: string; box: { width: number; height: number } }[][], gap = 12) => {
  let y = gap;
  let width = 0;
  const cells: string[] = [];
  for (const row of rows) {
    let x = gap;
    for (const { svg, box } of row) {
      cells.push(svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${box.width}" height="${box.height}" `));
      x += box.width + gap;
    }
    width = Math.max(width, x);
    y += Math.max(...row.map(({ box }) => box.height)) + gap;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><rect width="100%" height="100%" fill="${color.ink}"/>${cells.join("")}</svg>`;
};

for (const sheet of SHEETS) {
  const clip = GESTURES[sheet.key]!;
  const paint = scenePaint(clip.athlete);
  const rows = VIEWS.map(({ view }) => {
    const box = framing(clip, view);
    return clip.stills.map((still) => ({ svg: sceneSvg(clip, still.t, view, paint, box), box }));
  });
  await png(`positions-${sheet.file}.png`, sheetOf(rows));
}
await png(
  "ancien-et-nouveau.png",
  sheetOf(
    SHEETS.map((sheet) => {
      const clip = GESTURES[sheet.key]!;
      const old = EXERCISE_CLIPS[sheet.key]!;
      // L'instant le plus parlant de chaque geste : la position basse.
      const low = clip.stills.reduce((a, b) => (clip.pose(a.t).pelvis.y < clip.pose(b.t).pelvis.y ? a : b));
      const oldLow = old.stills.reduce((a, b) => (old.frame(a).root.y > old.frame(b).root.y ? a : b));
      return [
        { svg: v1SceneSvg(old, oldLow, athletePaint(old.athlete, "ink"), gearPaint), box: boxOf(old.view) },
        ...VIEWS.map(({ view }) => {
          const box = framing(clip, view);
          return { svg: sceneSvg(clip, low.t, view, scenePaint(clip.athlete), box), box };
        }),
      ];
    }),
    24,
  ),
);

console.log(`Planche écrite dans ${out} (${Math.round(page.length / 1024)} Ko).`);
