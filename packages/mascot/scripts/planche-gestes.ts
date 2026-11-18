// La planche des gestes écrits à la main : l'ancien moteur et le nouveau côte à côte, en mouvement, puis la frise
// des positions du nouveau, de profil et de face. Un seul fichier HTML, sans ressource externe, et quelques
// images fixes en PNG à côté.
//
//   corepack pnpm --filter @tartan/web exec tsx ../../packages/mascot/scripts/planche-gestes.ts <dossier de sortie>
//
// Le paquet n'a pas `tsx` : le script emprunte celui du web.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXERCISE_CLIPS } from "../src/exercises";
import { HEADS } from "../src/v2/body";
import { framing, sceneSvg } from "../src/v2/draw-svg";
import { GESTURES } from "../src/v2/gestures";
import type { GestureView } from "../src/v2/project";
import {
  athletePaint,
  boxOf,
  CARDS,
  controls,
  document,
  escape,
  frise,
  gearPaint,
  liveScene,
  pageData,
  pageScript,
  png,
  scenePaint,
  sheetOf,
  sized,
  VIEW_LABEL,
} from "./planche/outils";
import { v1SceneSvg } from "./planche/v1-scene";

const out = process.argv[2];
if (!out) throw new Error("Usage : planche-gestes.ts <dossier de sortie>");
mkdirSync(out, { recursive: true });

// --- Ce que la planche dit de chaque geste --------------------------------------------------------
// Les libellés des positions viennent du guide de la fiche. Ceux des phases n'existent que pour cette planche.

type Sheet = { key: string; file: string; who: string; look: string[]; sources: string };
const SHEETS: Sheet[] = [
  {
    key: "snatch",
    file: "arrache",
    who: "Malo, haltérophilie",
    look: [
      "L'ordre des phases : première tirée jusqu'aux genoux, transition, seconde tirée, passage sous la barre, réception, redressement.",
      "L'accélération : la première tirée est lente, la seconde explosive, le passage sous la barre très rapide, la réception amortie.",
      "La barre reste près du corps, les deux mains dessus ; de face, la prise large se voit.",
      "Les pieds ne glissent pas : ils décollent à l'extension et se reposent plus écartés.",
    ],
    sources:
      "Everett (Catalyst Athletics, 2014 et 2018) ; Harbili et Alptekin (J Sports Sci Med, 2014) ; Gourgoulis et al. (J Sports Sci, 2000, résumé).",
  },
  {
    key: "clean",
    file: "epaule",
    who: "Malo, haltérophilie",
    look: [
      "Le même tirage que l'arraché, mains un peu à l'extérieur des épaules.",
      "La barre ne saute pas sur les épaules : les coudes tournent autour d'elle, les épaules la rencontrent à mi-hauteur et l'accompagnent jusqu'en bas.",
      "En réception, coudes hauts vers l'avant, barre dans le creux des épaules.",
    ],
    sources:
      "Everett (Performance Menu, « The Clean: Part 2 », 2007 ; Catalyst Athletics, « The Clean and Jerk Rack Positions », 2014).",
  },
  {
    key: "clean-and-jerk",
    file: "epaule-jete",
    who: "Malo, haltérophilie",
    look: [
      "L'épaulé, puis les pieds se rapprochent avant le jeté.",
      "Le jeté : une flexion courte et verticale, une impulsion explosive, puis le passage en fente sous la barre.",
      "En fente : pied avant à plat, tibia à peu près vertical, pied arrière sur l'avant-pied, bras verrouillés, buste vertical.",
      "Retour : le pied avant recule d'abord, puis le pied arrière avance.",
    ],
    sources:
      "Everett (Performance Menu, « The Jerk: Part 1 », 2007 ; Catalyst Athletics, « Improving Your Footwork in the Split Jerk », 2016).",
  },
  {
    key: "back-squat",
    file: "squat-arriere",
    who: "Mehdi, musculation",
    look: [
      "La barre descend et remonte à l'aplomb du milieu du pied.",
      "En bas, les cuisses passent la parallèle, les talons restent au sol, les genoux suivent les pointes.",
      "La descente est lente, la remontée plus rapide.",
    ],
    sources: "Myer et al. (Strength Cond J, 2014).",
  },
  {
    key: "lateral-lunge",
    file: "fente-laterale",
    who: "Mehdi, musculation",
    look: [
      "De face : un grand pas de côté, le genou fléchi au-dessus du pied, l'autre jambe tendue, les deux pieds à plat.",
      "De profil : les hanches reculent, le buste s'incline, le dos reste droit.",
      "Le pied d'appui ne bouge pas ; l'autre pousse le sol avant de revenir.",
    ],
    sources: "American Council on Exercise, « Side Lunge ».",
  },
];

const PHASES: Record<string, string> = {
  start: "Départ",
  "first-pull": "Première tirée",
  transition: "Transition",
  "second-pull": "Seconde tirée",
  turnover: "Passage sous la barre",
  catch: "Réception",
  receive: "Réception tenue",
  recovery: "Redressement",
  overhead: "Debout, barre au-dessus de la tête",
  racked: "Debout, barre sur les épaules",
  return: "Retour au départ",
  adjust: "Placement des pieds",
  set: "Prêt pour le jeté",
  dip: "Flexion",
  drive: "Impulsion",
  split: "Fente",
  "feet-together": "Retour des pieds",
  standing: "Debout",
  down: "Descente",
  bottom: "Position basse",
  up: "Remontée",
  step: "Pas de côté",
  lunge: "Fente",
  push: "Poussée",
};

const VIEWS: GestureView[] = ["side", "front"];
// L'échelle des scènes animées et des frises, en pixels par unité du corps.
const SCALE = { scene: 0.8, still: 0.5 };

const section = (sheet: Sheet) => {
  const clip = GESTURES[sheet.key]!;
  const old = EXERCISE_CLIPS[sheet.key]!;
  const card = CARDS.get(sheet.key)!;
  const oldBox = boxOf(old.view);
  const oldLabel = old.facing === "side" ? "de profil" : "de face (il n'existe pas de profil)";
  const oldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${old.view}" data-engine="v1" data-key="${old.key}"></svg>`;
  return `
<section>
  <header>
    <h2>${escape(card.name)}</h2>
    <p class="who">${escape(sheet.who)} · boucle de ${(clip.duration / 1000).toFixed(1).replace(".", ",")} s</p>
  </header>
  <ul class="look">${sheet.look.map((line) => `<li>${escape(line)}</li>`).join("")}</ul>
  <div class="scenes motion">
    <figure class="old">${sized(oldSvg, oldBox, SCALE.scene, `role="img" aria-label="${escape(card.name)}, ancien moteur"`)}<figcaption>Ancien moteur, ${oldLabel}</figcaption></figure>
    ${VIEWS.map(
      (view) =>
        `<figure>${liveScene(clip, view, SCALE.scene, `${card.name}, nouveau moteur, ${VIEW_LABEL[view]}`)}<figcaption>Nouveau moteur, ${VIEW_LABEL[view]}</figcaption></figure>`,
    ).join("")}
  </div>
  <p class="phase motion">Phase en cours : <b data-phase></b></p>
  ${VIEWS.map(
    (view) =>
      `<h3>Positions du nouveau moteur, ${VIEW_LABEL[view]}</h3><ol class="frise">${frise(clip, view, SCALE.still, card.lines)}</ol>`,
  ).join("")}
  <p class="sources">Repères techniques : ${escape(sheet.sources)}</p>
</section>`;
};

const body = `
  <h1>Gestes écrits à la main : haltérophilie, squat arrière, fente latérale</h1>
  <p class="lead">À gauche, le geste tel qu'il est aujourd'hui dans l'application. À droite, le même geste avec le nouveau moteur : une seule description, vue de profil et de face, et un personnage plus fin (${HEADS.toFixed(1).replace(".", ",")} têtes au lieu de 3,6). Sous chaque geste, la frise de ses positions ; celles que le guide de la fiche décrit portent sa ligne.</p>
  <p class="note">Deux conventions de dessin : de profil, les disques passent derrière l'athlète pour laisser voir les jambes et les mains, et la tête passe devant le bras qui la croise. Le retour de la barre au sol, après un geste d'haltérophilie, ne fait pas partie de la technique : il referme seulement la boucle.</p>
  ${controls}
  ${SHEETS.map(section).join("")}`;

const clips = SHEETS.map((sheet) => GESTURES[sheet.key]!);
const page = document("Gestes écrits à la main : planche de validation", body, pageData(clips, PHASES), pageScript());
writeFileSync(resolve(out, "planche.html"), page);

// --- Les images fixes : une planche de positions par geste, puis l'ancien et le nouveau à un même instant ----

for (const sheet of SHEETS) {
  const clip = GESTURES[sheet.key]!;
  const paint = scenePaint(clip.athlete);
  const rows = VIEWS.map((view) => {
    const box = framing(clip, view);
    return clip.stills.map((still) => ({ svg: sceneSvg(clip, still.t, view, paint, box), box }));
  });
  await png(resolve(out, `positions-${sheet.file}.png`), sheetOf(rows));
}
await png(
  resolve(out, "ancien-et-nouveau.png"),
  sheetOf(
    SHEETS.map((sheet) => {
      const clip = GESTURES[sheet.key]!;
      const old = EXERCISE_CLIPS[sheet.key]!;
      // L'instant le plus parlant de chaque geste : la position basse.
      const low = clip.stills.reduce((a, b) => (clip.pose(a.t).pelvis.y < clip.pose(b.t).pelvis.y ? a : b));
      const oldLow = old.stills.reduce((a, b) => (old.frame(a).root.y > old.frame(b).root.y ? a : b));
      return [
        { svg: v1SceneSvg(old, oldLow, athletePaint(old.athlete, "ink"), gearPaint), box: boxOf(old.view) },
        ...VIEWS.map((view) => {
          const box = framing(clip, view);
          return { svg: sceneSvg(clip, low.t, view, scenePaint(clip.athlete), box), box };
        }),
      ];
    }),
    24,
  ),
);

console.log(`Planche écrite dans ${out} (${Math.round(page.length / 1024)} Ko).`);
