// Le MP4 de Mux arrive quelques minutes après le flux HLS : juste après l'encodage, ou s'il échoue, le lecteur
// repart sur le HLS. Le MP4 reste préféré, car il garde chaque image d'un ralenti étiré à l'envoi.
export type PlaybackUrls = { mp4Url?: string | null; hlsUrl?: string | null };

export const playbackSource = (urls: PlaybackUrls, mp4Failed: boolean): string | null =>
  (mp4Failed ? urls.hlsUrl : (urls.mp4Url ?? urls.hlsUrl)) ?? null;

// Un échec du lecteur ne déclenche le repli qu'une fois, et seulement s'il reste une autre adresse à essayer.
export const shouldFallBackToHls = (urls: PlaybackUrls, mp4Failed: boolean): boolean =>
  !mp4Failed && Boolean(urls.mp4Url) && Boolean(urls.hlsUrl);
