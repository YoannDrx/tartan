import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACTIVE_TAB, PageTransition, Stay, TRANSITION } from "@/components/ui/view-transition";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
// Ce que la feuille de styles déclare en mouvement réduit non demandé : là où vivent les animations.
const moving = css
  .split("@media (prefers-reduced-motion: no-preference)")
  .slice(1)
  .map((part) => part.slice(0, part.indexOf("\n}\n")))
  .join("\n");

describe("l'enveloppe des transitions de page", () => {
  it("laisse passer ses enfants tels quels là où React n'a pas de transitions de vue", () => {
    // Le React des tests n'est pas celui que Next embarque : pas de `<ViewTransition>`, donc aucun habillage.
    expect(
      renderToStaticMarkup(
        <PageTransition>
          <main>
            <Stay name="page-band">
              <h1>Suivi</h1>
            </Stay>
          </main>
        </PageTransition>,
      ),
    ).toBe("<main><h1>Suivi</h1></main>");
  });

  it("n'emploie que des classes que la feuille de styles anime", () => {
    expect(TRANSITION).toEqual({ page: "vt-page", stay: "vt-stay", glide: "vt-glide" });
    for (const name of Object.values(TRANSITION)) {
      expect(moving, name).toMatch(new RegExp(`::view-transition-(old|new|group)\\(\\.${name}\\)`));
    }
    // Le contenu d'une page a son fondu de sortie et son fondu d'entrée.
    expect(moving).toMatch(/::view-transition-old\(\.vt-page\) \{\s*animation: vt-out /);
    expect(moving).toMatch(/::view-transition-new\(\.vt-page\) \{\s*animation: vt-in /);
  });

  it("nomme l'onglet actif pour qu'il glisse", () => {
    const rule = css.slice(css.indexOf(`.${ACTIVE_TAB} {`), css.indexOf("}", css.indexOf(`.${ACTIVE_TAB} {`)));
    expect(rule).toContain("view-transition-name: active-tab;");
    expect(rule).toContain(`view-transition-class: ${TRANSITION.glide};`);
  });

  it("laisse la page cliquable pendant la transition", () => {
    expect(css).toMatch(/::view-transition \{[^}]*pointer-events: none;/);
  });
});
