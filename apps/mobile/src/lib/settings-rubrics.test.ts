import { describe, expect, it } from "vitest";
import { canOpenRubric, rubricHref, SETTINGS_RUBRICS, settingsGroups } from "./settings-rubrics";

const ids = (groups: ReturnType<typeof settingsGroups>) => groups.map((group) => [group.id, group.rubrics]);

describe("les rubriques des réglages de l'app native", () => {
  it("n'ont jamais de rubrique d'abonnement ni d'offre", () => {
    expect(SETTINGS_RUBRICS as readonly string[]).not.toContain("abonnement");
    for (const role of ["owner", "coach", "assistant", "athlete", null] as const) {
      expect(settingsGroups(role).flatMap((group) => group.rubrics) as string[]).not.toContain("abonnement");
    }
  });

  it("le propriétaire voit son compte, son espace et l'aide, dans l'ordre du web", () => {
    expect(ids(settingsGroups("owner"))).toEqual([
      ["compte", ["profil", "connexion", "notifications", "apparence", "confidentialite"]],
      ["espace", ["espace", "groupes", "membres"]],
      ["aide", ["aide"]],
    ]);
  });

  it("un athlète, ou un compte encore sans espace, ne voit que son compte et l'aide", () => {
    const own = [
      ["compte", ["profil", "connexion", "notifications", "apparence", "confidentialite"]],
      ["aide", ["aide"]],
    ];
    expect(ids(settingsGroups("athlete"))).toEqual(own);
    expect(ids(settingsGroups(null))).toEqual(own);
    expect(canOpenRubric("athlete", "groupes")).toBe(false);
  });

  it("un coach invite dans ses groupes sans régler l'espace", () => {
    expect(canOpenRubric("coach", "groupes")).toBe(true);
    expect(canOpenRubric("coach", "espace")).toBe(false);
    expect(canOpenRubric("coach", "membres")).toBe(false);
  });

  it("chaque rubrique a sa page sous /settings", () => {
    expect(rubricHref("connexion")).toBe("/settings/connexion");
  });
});
