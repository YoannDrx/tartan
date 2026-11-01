const ID = /^[A-Za-z0-9_-]{11}$/;

export type ParsedYouTube = { youtubeId: string; startS: number | null };

const parseStart = (raw: string | null): number | null => {
  if (!raw) return null;
  const plain = raw.match(/^(\d+)s?$/);
  if (plain) return Number(plain[1]);
  const parts = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!parts) return null;
  const total = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return total > 0 ? total : null;
};

export const parseYouTubeUrl = (input: string): ParsedYouTube | null => {
  const raw = input.trim();
  if (ID.test(raw)) return { youtubeId: raw, startS: null };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      id = match?.[1] ?? null;
    }
  }
  if (!id || !ID.test(id)) return null;
  return { youtubeId: id, startS: parseStart(url.searchParams.get("t") ?? url.searchParams.get("start")) };
};

// Lecteur officiel uniquement (pas de téléchargement) ; début et fin sont des paramètres de lecture.
export const youtubeEmbedUrl = (media: { youtubeId: string; startS?: number | null; endS?: number | null }): string => {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (media.startS != null) params.set("start", String(media.startS));
  if (media.endS != null) params.set("end", String(media.endS));
  return `https://www.youtube-nocookie.com/embed/${media.youtubeId}?${params.toString()}`;
};

export const validateClipRange = (startS: number | null, endS: number | null): boolean =>
  startS === null || endS === null || endS > startS;
