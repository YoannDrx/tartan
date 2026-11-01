// Le cookie arrive encodé une fois dans l'URL et contient lui-même des valeurs en %XX (signature).
// Expo Router décode ses paramètres une seconde fois, ce qui abîme la signature : on lit l'URL brute,
// comme le fait le client Better Auth pour une session de navigateur.
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
