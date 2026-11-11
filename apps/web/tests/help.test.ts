import { describe, expect, it } from "vitest";
import { m } from "@tartan/i18n";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { HELP_OUTLINE, helpThemes } from "@/features/help/content";
import { SCREEN_HELP_KEYS, screenHelpFor } from "@/features/help/screen-help";

const themeIds = Object.keys(m.help.themes);

describe("centre d'aide", () => {
  it("classe chaque question écrite, et n'en classe aucune qui n'existe pas", () => {
    expect(HELP_OUTLINE.map((theme) => theme.id)).toEqual(themeIds);
    for (const theme of HELP_OUTLINE) {
      expect(
        theme.questions.map((question) => question.id),
        theme.id,
      ).toEqual(Object.keys(m.help.themes[theme.id].questions));
    }
  });

  it("tient sur les huit couloirs de la piste", () => {
    expect(helpThemes().length).toBeLessThanOrEqual(8);
  });

  it("ne mène ni à une offre ni à un prix depuis l'app native", () => {
    const themes = helpThemes(true);
    expect(themes.map((theme) => theme.id)).not.toContain("abonnement");
    for (const question of themes.flatMap((theme) => theme.questions)) {
      expect(`${question.q} ${question.a}`, question.id).not.toMatch(/€|offre|tarif|abonnement|facture|paiement/i);
      if (question.link) expect(question.link.href, question.id).toMatch(/^\/mobile\//);
    }
  });

  it("garde toutes les questions sur le site", () => {
    const count = (embedded: boolean) => helpThemes(embedded).flatMap((theme) => theme.questions).length;
    expect(count(false)).toBe(HELP_OUTLINE.flatMap((theme) => theme.questions).length);
    expect(count(true)).toBeLessThan(count(false));
  });

  it("est référencé par le plan du site et ouvert aux robots", () => {
    expect(sitemap().map((entry) => entry.url)).toContain("https://tartan.coach/aide");
    const rules = robots().rules;
    expect((Array.isArray(rules) ? rules[0] : rules)?.allow).toContain("/aide");
  });
});

describe("aide par écran", () => {
  it("donne au coach et à l'athlète les repères de leur écran", () => {
    expect(screenHelpFor("/calendrier", true)).toEqual({ tips: m.help.screens.calendrierCoach, theme: "seances" });
    expect(screenHelpFor("/calendrier", false)).toEqual({ tips: m.help.screens.calendrierAthlete, theme: "athlete" });
    expect(screenHelpFor("/seances/nouvelle", true).tips).toBe(m.help.screens.seances);
    expect(screenHelpFor("/seance/abc", false).tips).toBe(m.help.screens.seance);
    expect(screenHelpFor("/aujourdhui", false).theme).toBe("athlete");
  });

  it("renvoie au centre d'aide quand l'écran n'a pas de repère propre", () => {
    expect(screenHelpFor("/phases", true)).toEqual({ tips: m.help.screens.fallback, theme: "demarrer" });
    expect(screenHelpFor("/historique", false)).toEqual({ tips: m.help.screens.fallback, theme: "athlete" });
    // Un préfixe ne suffit pas : « /suivi-x » n'est pas l'écran de suivi.
    expect(screenHelpFor("/suivi-x", true).tips).toBe(m.help.screens.fallback);
  });

  it("utilise chaque repère écrit, en deux phrases au plus, vers un thème qui existe", () => {
    const written = Object.keys(m.help.screens).filter((key) => key !== "fallback");
    expect([...new Set(SCREEN_HELP_KEYS)].sort()).toEqual(written.sort());
    for (const tips of Object.values(m.help.screens)) expect(tips.length).toBeLessThanOrEqual(2);
    for (const path of ["/suivi", "/reglages", "/abonnement", "/videos", "/mes-sauts"]) {
      expect(themeIds).toContain(screenHelpFor(path, true).theme);
    }
  });
});
