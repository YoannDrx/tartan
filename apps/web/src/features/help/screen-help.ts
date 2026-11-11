import { m } from "@tartan/i18n";
import type { HelpThemeId } from "./content";

type ScreenKey = Exclude<keyof typeof m.help.screens, "fallback">;
type Rule = { path: RegExp; staff?: boolean; screen: ScreenKey; theme: HelpThemeId };

// Du plus précis au plus large. `staff` absent : la règle vaut pour le coach comme pour l'athlète.
const RULES: Rule[] = [
  { path: /^\/suivi(\/|$)/, screen: "suivi", theme: "seances" },
  { path: /^\/calendrier(\/|$)/, staff: true, screen: "calendrierCoach", theme: "seances" },
  { path: /^\/calendrier(\/|$)/, staff: false, screen: "calendrierAthlete", theme: "athlete" },
  { path: /^\/seances(\/|$)/, screen: "seances", theme: "seances" },
  { path: /^\/exercices(\/|$)/, screen: "exercices", theme: "seances" },
  { path: /^\/athletes(\/|$)/, screen: "athletes", theme: "groupe" },
  { path: /^\/videos(\/|$)/, screen: "videosCoach", theme: "videos" },
  { path: /^\/planificateur(\/|$)/, screen: "planificateur", theme: "seances" },
  { path: /^\/annonces(\/|$)/, staff: true, screen: "annoncesCoach", theme: "groupe" },
  { path: /^\/annonces(\/|$)/, staff: false, screen: "annoncesAthlete", theme: "athlete" },
  { path: /^\/reglages(\/|$)/, screen: "reglages", theme: "compte" },
  { path: /^\/abonnement(\/|$)/, screen: "abonnement", theme: "abonnement" },
  { path: /^\/aujourdhui(\/|$)/, screen: "aujourdhui", theme: "athlete" },
  { path: /^\/seance\//, staff: false, screen: "seance", theme: "athlete" },
  { path: /^\/progres(\/|$)/, staff: false, screen: "progres", theme: "athlete" },
  { path: /^\/mes-sauts(\/|$)/, screen: "mesVideos", theme: "videos" },
];

export type ScreenHelp = { tips: readonly string[]; theme: HelpThemeId };

// Un écran sans repère propre renvoie au centre d'aide, sur le thème de départ du rôle.
export const screenHelpFor = (pathname: string, staff: boolean): ScreenHelp => {
  const rule = RULES.find((entry) => entry.path.test(pathname) && (entry.staff === undefined || entry.staff === staff));
  return rule
    ? { tips: m.help.screens[rule.screen], theme: rule.theme }
    : { tips: m.help.screens.fallback, theme: staff ? "demarrer" : "athlete" };
};

export const SCREEN_HELP_KEYS = RULES.map((rule) => rule.screen);
