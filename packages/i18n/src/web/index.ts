// Textes que seule la web app affiche : `import { w } from "@tartan/i18n/web"`.
// L'app native ne les embarque pas (son lint le refuse), donc une PR qui ne touche que ce dossier ne relance pas
// Maestro. Un texte que le mobile affiche aussi reste dans `../fr.ts`. Un fichier par domaine, assemblé ici.
import { analysis } from "./analysis";
import { auth } from "./auth";
import { comm } from "./comm";
import { legal } from "./legal";
import { planning } from "./planning";
import { profile } from "./profile";
import { sessions } from "./sessions";
import { settings } from "./settings";
import { shell } from "./shell";
import { tracking } from "./tracking";
import { video } from "./video";

export const w = { analysis, auth, comm, legal, planning, profile, sessions, settings, shell, tracking, video } as const;

export type WebMessages = typeof w;
