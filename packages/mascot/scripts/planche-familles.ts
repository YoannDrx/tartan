// Les planches de relecture par famille : tous les gestes du registre du nouveau moteur, écrits à la main ou
// relevés de l'ancien. Pour chaque geste : deux vues en mouvement, la frise des positions du guide, son niveau et
// les contraintes qu'il ne respecte pas encore. Une page HTML autonome par famille, un sommaire, et une image de
// synthèse par famille (une vignette par geste, dans sa position la plus parlante).
//
//   corepack pnpm --filter @tartan/web exec tsx ../../packages/mascot/scripts/planche-familles.ts <dossier de sortie>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { A_REPRENDRE } from "../src/v2/a-reprendre";
import { inspect, type Report } from "../src/v2/constraints";
import { framing, sceneSvg } from "../src/v2/draw-svg";
import type { MotionClip } from "../src/v2/gesture";
import { GESTURE_KEYS, gestureEntry, type GestureEntry } from "../src/v2/registry";
import { distance } from "../src/v2/vec";
import {
  CARDS,
  color,
  CONSTRAINT_LABEL,
  controls,
  document,
  escape,
  FAMILIES,
  frise,
  LEVEL_LABEL,
  liveScene,
  pageData,
  pageScript,
  png,
  scenePaint,
  sheetOf,
  VIEW_LABEL,
  type Cell,
} from "./planche/outils";

const out = process.argv[2];
if (!out) throw new Error("Usage : planche-familles.ts <dossier de sortie>");
mkdirSync(out, { recursive: true });

const SCALE = { scene: 0.62, still: 0.34, thumb: 0.42 };
// Une vignette de l'image de synthèse : son titre, son état, puis ses deux vues posées sur le même sol.
const THUMB = { width: 330, height: 220 };

type Row = { entry: GestureEntry; name: string; lines: string[]; report: Report; broken: (keyof Report)[] };
const rows = new Map<string, Row[]>();
for (const key of GESTURE_KEYS) {
  const card = CARDS.get(key);
  if (!card) throw new Error(`Le geste ${key} n'a pas de fiche au catalogue.`);
  const entry = gestureEntry(key)!;
  const report = inspect(entry.clip, 120);
  const broken = (Object.keys(report) as (keyof Report)[]).filter((name) => report[name].length > 0);
  const family = rows.get(card.family) ?? [];
  family.push({ entry, name: card.name, lines: card.lines, report, broken });
  rows.set(card.family, family);
}

// La position la plus parlante d'un geste : celle qui s'éloigne le plus de la première.
const telling = (clip: MotionClip) => {
  const marks = (t: number) => {
    const body = clip.pose(t);
    return [
      body.pelvis,
      body.head,
      body.arms.R.hand,
      body.arms.L.hand,
      body.legs.R.knee,
      body.legs.L.knee,
      body.legs.R.ankle,
      body.legs.L.ankle,
    ];
  };
  const first = marks(clip.stills[0]!.t);
  return clip.stills.reduce(
    (best, still) => {
      const far = marks(still.t).reduce((sum, point, index) => sum + distance(point, first[index]!), 0);
      return far > best.far ? { t: still.t, far } : best;
    },
    { t: clip.stills[0]!.t, far: -1 },
  ).t;
};

const section = ({ entry, name, lines, report, broken }: Row) => {
  const { clip, views, level } = entry;
  const shown = views.slice(0, 2);
  return `
<section>
  <header>
    <h2>${escape(name)}</h2>
    <p class="who"><span class="badge ${level}">${LEVEL_LABEL[level]}</span> · ${escape(clip.key)} · boucle de ${(clip.duration / 1000).toFixed(1).replace(".", ",")} s</p>
  </header>
  ${
    broken.length > 0
      ? `<ul class="again">${broken
          .map(
            (name) =>
              `<li>À reprendre, ${CONSTRAINT_LABEL[name]} : ${escape(report[name][0]!)}${report[name].length > 1 ? ` (et ${report[name].length - 1} autres images)` : ""}</li>`,
          )
          .join("")}</ul>`
      : ""
  }
  <div class="scenes motion">
    ${shown.map((view) => `<figure>${liveScene(clip, view, SCALE.scene, `${name}, ${VIEW_LABEL[view]}`)}<figcaption>${VIEW_LABEL[view][0]!.toUpperCase()}${VIEW_LABEL[view].slice(1)}</figcaption></figure>`).join("")}
  </div>
  ${shown.map((view) => `<h3>Positions du guide, ${VIEW_LABEL[view]}</h3><ol class="frise">${frise(clip, view, SCALE.still, lines)}</ol>`).join("")}
</section>`;
};

const summary: string[] = [];
const totals = { all: 0, written: 0, lifted: 0, clean: 0 };
for (const family of FAMILIES) {
  const list = rows.get(family.id) ?? [];
  const again = list.filter((row) => row.broken.length > 0);
  const written = list.filter((row) => row.entry.level === "ecrit").length;
  const why: Record<string, number> = {};
  for (const row of again) for (const name of row.broken) why[name] = (why[name] ?? 0) + 1;
  const reasons = Object.entries(why)
    .map(([name, count]) => `${CONSTRAINT_LABEL[name]} ${count}`)
    .join(", ");
  totals.all += list.length;
  totals.written += written;
  totals.lifted += list.length - written;
  totals.clean += list.length - again.length;
  summary.push(
    `<tr><td><a href="${family.file}.html">${escape(family.name)}</a></td><td class="n">${list.length}</td><td class="n">${written}</td><td class="n">${list.length - written}</td><td class="n">${list.length - again.length}</td><td class="n">${again.length}</td><td>${escape(reasons)}</td></tr>`,
  );
  console.log(
    `${family.name.padEnd(22)} ${String(list.length).padStart(3)} gestes, ${written} écrits, ${list.length - written} relevés, ${list.length - again.length} passent tout, ${again.length} à reprendre${reasons ? ` (${reasons})` : ""}`,
  );

  const body = `
  <p class="note"><a href="index.html">Toutes les familles</a></p>
  <h1>${escape(family.name)} : ${list.length} gestes</h1>
  <p class="lead">${written} écrits à la main, ${list.length - written} relevés de l'ancien moteur. ${list.length - again.length} respectent toutes les contraintes, ${again.length} sont à reprendre${reasons ? ` (${escape(reasons)})` : ""}.</p>
  <p class="note">Un geste relevé reprend les angles et le rythme de l'ancien moteur avec le nouveau corps : ses appuis sont déduits, sa seconde vue vient de la projection. Il n'a pas encore la technique ni la dynamique d'un geste écrit à la main. De profil, les disques passent derrière l'athlète et la tête passe devant le bras qui la croise.</p>
  ${controls}
  ${list.map(section).join("")}`;
  const clips = list.map((row) => row.entry.clip);
  writeFileSync(
    resolve(out, `${family.file}.html`),
    document(`${family.name} : planche de relecture`, body, pageData(clips), pageScript()),
  );

  // L'image de synthèse : quatre gestes par ligne, chacun dans une vignette de taille fixe avec ses deux vues.
  const cells: Cell[][] = [];
  list.forEach((row, index) => {
    const { clip, views, level } = row.entry;
    const t = telling(clip);
    const paint = scenePaint(clip.athlete);
    let x = 0;
    const images = views.slice(0, 2).map((view) => {
      const box = framing(clip, view);
      const scale = Math.min(SCALE.thumb, (THUMB.height - 44) / box.height, (THUMB.width - 10) / 2 / box.width);
      const [width, height] = [box.width * scale, box.height * scale];
      const image = sceneSvg(clip, t, view, paint, box).replace(
        "<svg ",
        `<svg x="${x}" y="${THUMB.height - height}" width="${width}" height="${height}" `,
      );
      x += width + 10;
      return image;
    });
    const text = (y: number, fill: string, size: number, content: string) =>
      `<text x="0" y="${y}" fill="${fill}" font-family="Helvetica, Arial, sans-serif" font-size="${size}">${escape(content)}</text>`;
    const title = row.name.length > 40 ? `${row.name.slice(0, 39)}…` : row.name;
    const state = `${level === "ecrit" ? "écrit à la main" : "relevé"}${row.broken.length > 0 ? ` · à reprendre : ${row.broken.map((name) => CONSTRAINT_LABEL[name]).join(", ")}` : ""}`;
    (cells[Math.floor(index / 4)] ??= []).push({
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${THUMB.width} ${THUMB.height}">` +
        text(14, color.white, 13, title) +
        text(
          30,
          row.broken.length > 0 ? color.brandOnInk : level === "ecrit" ? color.film.lime : color.mutedOnInk,
          11,
          state,
        ) +
        images.join("") +
        `</svg>`,
      box: THUMB,
    });
  });
  await png(resolve(out, `synthese-${family.file}.png`), sheetOf(cells, 16));
}

// Le registre et la table des gestes à reprendre disent la même chose : le test du paquet le vérifie aussi.
const listed = Object.keys(A_REPRENDRE).length;
const found = [...rows.values()].flat().filter((row) => row.broken.length > 0).length;
if (listed !== found) console.warn(`Attention : ${found} gestes à reprendre ici, ${listed} dans la table A_REPRENDRE.`);

const index = `
  <h1>Gestes du nouveau moteur : planches par famille</h1>
  <p class="lead">${totals.all} gestes : ${totals.written} écrits à la main, ${totals.lifted} relevés de l'ancien moteur. ${totals.clean} respectent toutes les contraintes, ${totals.all - totals.clean} sont à reprendre.</p>
  <div class="wide"><table>
    <thead><tr><th>Famille</th><th class="n">Gestes</th><th class="n">Écrits</th><th class="n">Relevés</th><th class="n">Passent tout</th><th class="n">À reprendre</th><th>Contraintes en cause</th></tr></thead>
    <tbody>${summary.join("")}</tbody>
  </table></div>
  <p class="note">Une image de synthèse par famille accompagne ces pages : <code>synthese-…png</code>, une vignette par geste dans sa position la plus parlante.</p>`;
writeFileSync(resolve(out, "index.html"), document("Gestes du nouveau moteur : planches par famille", index, {}, ""));
console.log(
  `Total : ${totals.all} gestes, ${totals.written} écrits, ${totals.lifted} relevés, ${totals.clean} passent tout, ${totals.all - totals.clean} à reprendre.`,
);
