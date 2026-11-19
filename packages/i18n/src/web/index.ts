// Textes que seule la web app affiche : `import { w } from "@tartan/i18n/web"`.
// L'app native ne les embarque pas (son lint le refuse), donc une PR qui ne touche que ce dossier ne relance pas
// Maestro. Un texte que le mobile affiche aussi reste dans `../fr.ts`. Un fichier par domaine, assemblé ici.
import { admin } from "./admin";
import { auth } from "./auth";
import { comm } from "./comm";
import { exercises } from "./exercises";
import { legal } from "./legal";
import { planning } from "./planning";
import { profile } from "./profile";
import { settings } from "./settings";
import { shell } from "./shell";
import { tracking } from "./tracking";
import { video } from "./video";

export const w = { admin, auth, comm, exercises, legal, planning, profile, settings, shell, tracking, video } as const;

export type WebMessages = typeof w;
