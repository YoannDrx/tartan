// Textes que seule la web app affiche : `import { w } from "@tartan/i18n/web"`.
// L'app native ne les embarque pas (son lint le refuse), donc une PR qui ne touche que ce dossier ne relance pas
// Maestro. Un texte que le mobile affiche aussi reste dans `../fr.ts`. Un fichier par domaine, assemblé ici.
import { legal } from "./legal";
import { planner } from "./planner";
import { planning } from "./planning";
import { settings } from "./settings";
import { tracking } from "./tracking";
import { video } from "./video";

export const w = { legal, planner, planning, settings, tracking, video } as const;

export type WebMessages = typeof w;
