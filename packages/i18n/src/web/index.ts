// Textes que seule la web app affiche : `import { w } from "@tartan/i18n/web"`.
// L'app native ne les embarque pas (son lint le refuse), donc une PR qui ne touche que ce dossier ne relance pas
// Maestro. Un texte que le mobile affiche aussi reste dans `../fr.ts`. Un fichier par domaine, assemblé ici.
import { admin } from "./admin";
import { analysis } from "./analysis";
import { athletes } from "./athletes";
import { auth } from "./auth";
import { comm } from "./comm";
import { common } from "./common";
import { demoSpace } from "./demo-space";
import { exercises } from "./exercises";
import { legal } from "./legal";
import { onboarding } from "./onboarding";
import { personal } from "./personal";
import { planner } from "./planner";
import { planning } from "./planning";
import { profile } from "./profile";
import { progress } from "./progress";
import { sessions } from "./sessions";
import { settings } from "./settings";
import { shell } from "./shell";
import { tracking } from "./tracking";
import { video } from "./video";
import { welcome } from "./welcome";

export const w = {
  admin,
  analysis,
  athletes,
  auth,
  comm,
  common,
  demoSpace,
  exercises,
  legal,
  onboarding,
  personal,
  planner,
  planning,
  profile,
  progress,
  sessions,
  settings,
  shell,
  tracking,
  video,
  welcome,
} as const;

export type WebMessages = typeof w;
