"use client";

import { w } from "@tartan/i18n/web";

// Le lien d'évitement : premier arrêt de la tabulation sur chaque page, invisible tant qu'il n'a pas le focus.
// Il vise le contenu principal de la page affichée (`main`), quelle que soit la coquille qui l'entoure.
export const SkipLink = () => (
  <a
    href="#contenu"
    onClick={(event) => {
      const main = document.querySelector("main");
      if (!main) return;
      event.preventDefault();
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus();
    }}
    className="sr-only rounded-button bg-accent font-semibold text-on-accent no-underline focus:not-sr-only focus:px-4 focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center"
  >
    {w.common.skipToContent}
  </a>
);
