import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EXERCISE_CATALOG, EXERCISE_CATALOG_VERSION } from "@tartan/domain/exercise-catalog";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";

const root = path.resolve(import.meta.dirname, "../../..");
const output = path.join(root, ".local");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const labels = m.exerciseReview;
const guideLabels = m.exerciseGuide;
const equipmentLabels = { ...m.trainingProfile.equipment, ...m.exerciseClassification.extraEquipment };
const manifest = {
  schemaVersion: 1,
  catalogVersion: EXERCISE_CATALOG_VERSION,
  sourceHash: hash(EXERCISE_CATALOG),
  scope: "guide_text",
  entries: EXERCISE_CATALOG.map((entry) => ({ catalogKey: entry.catalogKey, name: entry.name, guideHash: hash(entry) })),
};
const options = (values: Record<string, string>) => Object.entries(values).map(([key, label]) => `<option value="${escape(key)}">${escape(label)}</option>`).join("");
const section = (title: string, value: string | string[] | null) => value ? `<h3>${escape(title)}</h3>${Array.isArray(value) ? `<ol>${value.map((line) => `<li>${escape(line)}</li>`).join("")}</ol>` : `<p>${escape(value)}</p>`}` : "";
const cards = EXERCISE_CATALOG.map((entry) => {
  const g = entry.guide;
  const key = entry.catalogKey;
  return `<details data-key="${key}" data-family="${g.family}" data-search="${escape([entry.name, ...(entry.aliases ?? [])].join(" "))}">
<summary><h2 style="display:inline;font-size:24px;margin:0">${escape(entry.name)}</h2><span data-state>${escape(labels.statuses.pending)}</span></summary>
<div class="content"><p>${escape(guideLabels.families[g.family])} · ${escape(guideLabels.levels[g.level])}</p>
${section(labels.aliases, (entry.aliases ?? []).join(", "))}
${section(labels.equipment, entry.classification?.equipment?.map((item) => equipmentLabels[item]).join(", ") ?? "")}
${section(guideLabels.objective, g.objective)}${section(guideLabels.setup, g.setup)}${section(guideLabels.steps, g.steps)}
${section(guideLabels.breathing, g.breathing)}${section(guideLabels.mistakes, g.mistakes)}${section(guideLabels.counting, g.counting.explanation)}
${section(guideLabels.load, g.loadExplanation)}${section(guideLabels.easier, g.easier)}${section(guideLabels.progression, g.progression)}
<p>${escape(guideLabels.illustrationNotReady)}</p><p data-stale hidden>${escape(labels.stale)}</p>
<label for="status-${key}">${escape(labels.status)}</label><select id="status-${key}" data-review-status>${options(labels.statuses)}</select>
<label for="notes-${key}">${escape(labels.notes)}</label><textarea id="notes-${key}" data-notes rows="4" maxlength="5000"></textarea></div></details>`;
}).join("\n");
const [client, bodyFont, titleFont] = await Promise.all([
  readFile(path.join(import.meta.dirname, "exercise-review-client.js"), "utf8"),
  readFile(path.join(root, "apps/web/assets/fonts/Barlow_600SemiBold.ttf")),
  readFile(path.join(root, "apps/web/assets/fonts/BarlowCondensed_700Bold.ttf")),
]);
const palette = (t: typeof tokens.work | typeof tokens.workDark | typeof tokens.workTartan) => `--page:${t.page};--surface:${t.surface};--text:${t.text};--muted:${t.muted};--line:${t.controlLine};--action:${t.action};--on-action:${t.onAction};`;
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(labels.title)}</title><style>
@font-face{font-family:Barlow;src:url(data:font/ttf;base64,${bodyFont.toString("base64")})}@font-face{font-family:BarlowCondensed;src:url(data:font/ttf;base64,${titleFont.toString("base64")})}
:root{${palette(tokens.workTartan)}}:root[data-theme=light]{${palette(tokens.work)}}:root[data-theme=dark]{${palette(tokens.workDark)}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--text);font:16px/1.55 Barlow,sans-serif}header{background:${tokens.band.background};color:${tokens.band.text};padding:24px 16px;border-bottom:6px double ${tokens.band.lane}}h1{font:700 clamp(40px,5vw,52px)/1.1 BarlowCondensed,sans-serif;margin:0}main{max-width:1000px;margin:auto;padding:24px 16px}section,details{background:var(--surface);padding:16px;margin-bottom:16px}h2,h3{font-family:BarlowCondensed,sans-serif}h3{font-size:22px;margin-bottom:4px}p,ol{margin-top:4px}label{display:block;margin-top:12px}input,select,textarea,button{font:inherit;max-width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)}input,select,textarea{width:100%}textarea{resize:vertical}button{cursor:pointer;background:var(--action);color:var(--on-action);margin-top:16px}:focus-visible{outline:3px solid var(--action);outline-offset:3px}summary{cursor:pointer;min-height:44px;overflow-wrap:anywhere}summary span{display:block;color:var(--muted);margin-left:20px}.filters{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.content{padding-top:16px}[hidden]{display:none!important}.counts{font-variant-numeric:tabular-nums}#save-state{margin-top:12px}li{margin-bottom:8px}
</style></head><body><header><h1>${escape(labels.title)}</h1></header><main><section aria-label="${escape(labels.title)}"><p>${escape(labels.scope)}</p><p>${escape(labels.instructions)}</p>
<label for="reviewer">${escape(labels.reviewer)}</label><input id="reviewer" maxlength="120" autocomplete="name">
<div class="filters"><div><label for="search">${escape(labels.search)}</label><input id="search" type="search"></div><div><label for="family">${escape(guideLabels.family)}</label><select id="family"><option value="">${escape(guideLabels.allFamilies)}</option>${options(guideLabels.families)}</select></div><div><label for="status">${escape(labels.status)}</label><select id="status"><option value="">${escape(labels.allStatuses)}</option>${options(labels.statuses)}</select></div></div>
<button id="export" type="button">${escape(labels.export)}</button><p id="save-state" role="status"></p><p class="counts" id="counts" aria-live="polite"></p></section>${cards}</main>
<script id="review-data" type="application/json">${JSON.stringify({ manifest, labels }).replace(/</g, "\\u003c")}</script><script>${client}</script></body></html>`;
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "exercise-catalog-review.html"), html, { mode: 0o600 });
await writeFile(path.join(output, "exercise-catalog-review.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.info(path.join(output, "exercise-catalog-review.html"));
