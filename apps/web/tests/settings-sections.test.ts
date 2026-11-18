import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { w } from "@tartan/i18n/web";
import { screenHelpFor } from "@/features/help/screen-help";
import {
  SETTINGS_ANCHORS,
  SETTINGS_RUBRICS,
  rubricOfPath,
  rubricPath,
  settingsAnchorHref,
  settingsGroups,
  visibleRubrics,
  type SettingsAnchorTarget,
  type SettingsRubric,
} from "@/features/settings/sections";
import { SCREENS } from "../e2e/screens";

const ROOT = join(__dirname, "..");
const PAGES = join(ROOT, "app/(app)/reglages/(rubriques)");

// Les dix-huit sections de l'ancienne page unique `/reglages` : des e-mails déjà partis, des notifications et des
// favoris les visent encore.
const LEGACY_ANCHORS = [
  "apparence",
  "profil",
  "espace",
  "signalements",
  "membres",
  "invitations",
  "inviter",
  "confidentialite",
  "offre",
  "parrainage",
  "agenda",
  "bloques",
  "emails",
  "notifications",
  "categories",
  "console",
  "aide",
  "compte",
];

// Tout ce qu'une rubrique affiche : sa page, et les composants de son dossier et du dossier commun.
const sourceOf = (rubric: SettingsRubric): string => {
  const files = [join(PAGES, rubric, "page.tsx")];
  for (const dir of [join(ROOT, "src/features/settings", rubric), join(ROOT, "src/features/settings")]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) if (name.endsWith(".tsx")) files.push(join(dir, name));
  }
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
};

describe("rubriques des réglages", () => {
  it("donne à chaque rubrique sa page, son titre et sa ligne dans la matrice des écrans", () => {
    for (const rubric of SETTINGS_RUBRICS) {
      expect(existsSync(join(PAGES, rubric, "page.tsx")), rubric).toBe(true);
      expect(w.settings.rubrics[rubric].title, rubric).toMatch(/\S/);
      expect(
        SCREENS.some((screen) => screen.path === rubricPath(rubric)),
        rubric,
      ).toBe(true);
    }
  });

  it("mène les dix-huit anciennes ancres à une rubrique qui existe, et à une section qui s'y trouve", () => {
    expect(Object.keys(SETTINGS_ANCHORS).sort()).toEqual([...LEGACY_ANCHORS].sort());
    for (const [anchor, target] of Object.entries(SETTINGS_ANCHORS) as [string, SettingsAnchorTarget][]) {
      for (const rubric of [target.rubric, target.fallback]) {
        if (!rubric) continue;
        expect(SETTINGS_RUBRICS, anchor).toContain(rubric);
        if (target.hash) expect(sourceOf(rubric), `${anchor} : #${target.hash}`).toContain(`id="${target.hash}"`);
      }
      // Le propriétaire ouvre toutes les rubriques : chaque ancre le mène quelque part.
      expect(settingsAnchorHref(`#${anchor}`, "", "owner"), anchor).toBe(
        `${rubricPath(target.rubric)}${target.hash ? `#${target.hash}` : ""}`,
      );
    }
  });

  it("garde la requête, et laisse sur le sommaire ce qui ne mène nulle part", () => {
    expect(settingsAnchorHref("#inviter", "?espace=abc", "owner")).toBe("/reglages/membres?espace=abc#inviter");
    expect(settingsAnchorHref("#invitations", "?espace=abc", "coach")).toBe("/reglages/groupes?espace=abc");
    expect(settingsAnchorHref("#confidentialite", "", "athlete")).toBe("/reglages/confidentialite");
    // Une rubrique fermée au rôle : pas de redirection vers une page qu'il ne peut pas ouvrir.
    expect(settingsAnchorHref("#invitations", "", "athlete")).toBeNull();
    expect(settingsAnchorHref("#offre", "", "coach")).toBeNull();
    // Le parrainage du coach non propriétaire et de l'athlète est dans l'aide.
    expect(settingsAnchorHref("#parrainage", "", "owner")).toBe("/reglages/abonnement#parrainage");
    expect(settingsAnchorHref("#parrainage", "", "coach")).toBe("/reglages/aide#parrainage");
    expect(settingsAnchorHref("#parrainage", "", "athlete")).toBe("/reglages/aide#parrainage");
    for (const hash of ["", "#", "#inconnu", "#constructor", "#toString"]) {
      expect(settingsAnchorHref(hash, "", "owner"), hash).toBeNull();
    }
  });

  it("ouvre à chaque rôle les rubriques de ses droits, ni plus ni moins", () => {
    expect(visibleRubrics("owner")).toEqual([...SETTINGS_RUBRICS]);
    expect(visibleRubrics("coach")).toEqual([
      "profil",
      "connexion",
      "notifications",
      "apparence",
      "confidentialite",
      "groupes",
      "membres",
      "aide",
    ]);
    const personal = ["profil", "connexion", "notifications", "apparence", "confidentialite", "aide"];
    expect(visibleRubrics("assistant")).toEqual(personal);
    expect(visibleRubrics("athlete")).toEqual(personal);
    // Sans réglage d'espace, une seule liste ; sinon le compte, l'espace, puis l'aide.
    expect(settingsGroups("athlete")).toEqual([{ id: null, rubrics: personal }]);
    expect(settingsGroups("owner").map((group) => group.id)).toEqual(["compte", "espace", "aide"]);
    expect(
      settingsGroups("owner")
        .flatMap((group) => group.rubrics)
        .sort(),
    ).toEqual([...SETTINGS_RUBRICS].sort());
  });

  it("reconnaît la rubrique d'une adresse, pas un simple préfixe", () => {
    expect(rubricOfPath("/reglages")).toBeNull();
    expect(rubricOfPath("/reglages/groupes")).toBe("groupes");
    expect(rubricOfPath("/reglages/references-force")).toBeNull();
    expect(rubricOfPath("/reglages/profil-x")).toBeNull();
  });

  it("décrit les réglages tels qu'ils sont rangés : l'export et la suppression sont dans Confidentialité", () => {
    for (const path of ["/reglages", "/reglages/confidentialite"]) {
      for (const staff of [true, false]) {
        const { tips, theme } = screenHelpFor(path, staff);
        expect(tips).toBe(w.settings.screenHelp);
        expect(tips.length).toBeLessThanOrEqual(2);
        expect(tips.join(" ")).not.toMatch(/en bas de l'écran/);
        expect(theme).toBe("compte");
      }
    }
  });
});
