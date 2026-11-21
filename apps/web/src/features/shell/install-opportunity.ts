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

// Une carte qui propose elle-même l'installation (la carte facultative de l'athlète) l'héberge : le bandeau
// du bas de l'écran s'efface tant qu'elle est là, pour ne pas la proposer deux fois.
let hosts = 0;
export const installOfferHosted = () => hosts > 0;
export const hostInstallOffer = () => {
  hosts += 1;
  window.dispatchEvent(new Event(INSTALL_OPPORTUNITY));
  return () => {
    hosts -= 1;
    window.dispatchEvent(new Event(INSTALL_OPPORTUNITY));
  };
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
