"use client";

const READY = "tartan.install-ready";
export const INSTALL_OPPORTUNITY = "tartan:install-opportunity";
let readyInThisTab = false;

// Un simple indicateur local : aucun identifiant, contenu de séance ou renseignement santé.
export const hasInstallOpportunity = () => {
  if (readyInThisTab) return true;
  try {
    return localStorage.getItem(READY) === "true";
  } catch {
    return false;
  }
};

export const markInstallOpportunity = () => {
  readyInThisTab = true;
  try {
    localStorage.setItem(READY, "true");
  } catch {
    // Stockage refusé : l’occasion reste valable dans cet onglet seulement.
  }
  window.dispatchEvent(new Event(INSTALL_OPPORTUNITY));
};
