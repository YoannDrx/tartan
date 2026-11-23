// Le cookie arrive encodé une fois dans l'URL et contient lui-même des valeurs en %XX (signature).
// Expo Router décode ses paramètres une seconde fois, ce qui abîme la signature : on lit l'URL brute,
// comme le fait le client Better Auth pour une session de navigateur.
// Les écrans où un lien de connexion peut ramener, après avoir rouvert l'app : seulement ceux de cette liste,
// jamais une adresse prise telle quelle dans l'URL.
const RETURN_PATHS = ["/settings/connexion"] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

// Le lien de confirmation de la rubrique Connexion revient avec `next` : l'app y retourne, formulaire prêt.
export const CONFIRM_PASSWORD_CALLBACK = `/callback?next=${encodeURIComponent("/settings/connexion")}`;

export const returnPathOf = (value: string | null | undefined): ReturnPath | null =>
  RETURN_PATHS.find((path) => path === value) ?? null;

export const paramFromUrl = (url: string | null | undefined, name: string): string | null => {
  const query = url?.split("#")[0]?.split("?")[1];
  if (!query) return null;
  for (const pair of query.split("&")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator) !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, " "));
    } catch {
      return null;
    }
  }
  return null;
};
