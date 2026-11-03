const CODE = /^[A-Za-z0-9_-]{5,40}$/;
const PATHS = new Set(["reel", "reels", "p", "tv"]);

// Seul le code de la publication est gardé : les paramètres d'un lien partagé désignent celui qui l'a partagé.
export const parseInstagramUrl = (input: string): string | null => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.hostname.replace(/^(www|m)\./, "") !== "instagram.com") return null;
  const [kind, code] = url.pathname.split("/").filter(Boolean);
  return kind && code && PATHS.has(kind) && CODE.test(code) ? code : null;
};

export const instagramUrl = (code: string): string => `https://www.instagram.com/reel/${code}/`;
export const instagramEmbedUrl = (code: string): string => `${instagramUrl(code)}embed/`;
