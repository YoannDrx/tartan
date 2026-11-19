import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";

// Une valeur absente : un tiret à l'œil, « Non renseigné » à l'oreille. Le détail des manques est regroupé dans
// « À compléter », en tête de l'analyse, au lieu d'être répété sous chaque chiffre (audit G9).
export const Missing = () => (
  <span data-missing="">
    <span aria-hidden="true">{w.analysis.dash}</span>
    <span className="sr-only">{m.analysis.missing}</span>
  </span>
);
