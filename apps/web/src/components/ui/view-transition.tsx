/// <reference types="react/canary" />
import * as React from "react";
import type { ReactNode } from "react";

// Les transitions de page (DESIGN.md, « Mouvement ») passent toutes par ici : une seule enveloppe autour des
// View Transitions de React, et leurs animations dans `globals.css`, sous « Transitions de page ».

// Les classes que les animations ciblent.
export const TRANSITION = {
  // Le contenu d'une page : l'ancien s'efface pendant que le nouveau apparaît.
  page: "vt-page",
  // Ce qui se retrouve d'une page à l'autre et reste à sa place : le bandeau piste, l'en-tête du site.
  stay: "vt-stay",
  // Ce qui glisse d'un point à un autre : l'onglet actif.
  glide: "vt-glide",
} as const;

// L'onglet actif : la classe qui le nomme pour le navigateur. Un seul élément visible la porte à la fois.
export const ACTIVE_TAB = "vt-active-tab";

// `<ViewTransition>` n'existe que dans le React embarqué par Next. Ailleurs (les tests), et dans un navigateur
// qui ne connaît pas les transitions de vue, la page change simplement d'un coup.
const Native = (React as { ViewTransition?: React.ExoticComponent<React.ViewTransitionProps> }).ViewTransition;

// Le contenu d'une page. Sa clé change avec la page : c'est le remplacement qui déclenche le fondu, jamais
// une simple mise à jour (une validation, un rafraîchissement).
export const PageTransition = ({ children }: { children: ReactNode }) =>
  Native ? (
    <Native enter={TRANSITION.page} exit={TRANSITION.page} default="none">
      {children}
    </Native>
  ) : (
    children
  );

// Un élément que deux pages partagent : il garde sa place, seul son contenu change. Sur une page qui ne
// l'a pas, il part et arrive avec le reste du contenu.
export const Stay = ({ name, children }: { name: string; children: ReactNode }) =>
  Native ? (
    <Native name={name} share={TRANSITION.stay} default="none">
      {children}
    </Native>
  ) : (
    children
  );
