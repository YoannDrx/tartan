// Protocole d'envoi direct Mux (session reprenable Google Cloud Storage), en fonctions pures.
// Morceaux multiples de 256 Kio, sauf le dernier ; 308 = continuer, 200/201 = terminé.

const KIB_256 = 256 * 1024;
export const CHUNK_SIZE = 16 * KIB_256; // 4 Mio : tient sur un réseau de stade.

export type ChunkRange = { start: number; end: number; length: number };

export const nextChunk = (offset: number, total: number, chunkSize: number = CHUNK_SIZE): ChunkRange | null => {
  if (offset >= total) return null;
  const end = Math.min(offset + chunkSize, total) - 1;
  return { start: offset, end, length: end - offset + 1 };
};

export const contentRange = (range: ChunkRange, total: number): string => `bytes ${range.start}-${range.end}/${total}`;

export const statusProbeRange = (total: number): string => `bytes */${total}`;

// « bytes=0-4194303 » → octet suivant à envoyer. Sans en-tête : rien n'a été reçu.
export const offsetFromRangeHeader = (header: string | null | undefined): number => {
  const match = header?.match(/(\d+)\s*-\s*(\d+)/);
  return match ? Number(match[2]) + 1 : 0;
};

export type ChunkOutcome = "complete" | "continue" | "retry" | "expired" | "failed";

export const classifyResponse = (status: number): ChunkOutcome => {
  if (status === 200 || status === 201) return "complete";
  if (status === 308) return "continue";
  // Adresse d'envoi périmée : le serveur en délivre une nouvelle (api.renewVideoUpload).
  if (status === 404 || status === 410) return "expired";
  if (status === 408 || status === 429 || status >= 500) return "retry";
  return "failed";
};

// Un seul PUT survit à la mise en veille : c'est le mode normal. Si l'app a repris après une coupure,
// on interroge Mux : rien reçu = on relance le PUT ; une partie reçue = on envoie le reste en morceaux.
export type UploadStep = { kind: "single-put" } | { kind: "chunks"; from: number } | { kind: "done" };

export const planUpload = (probe: number | "complete" | null): UploadStep => {
  if (probe === "complete") return { kind: "done" };
  if (probe === null || probe === 0) return { kind: "single-put" };
  return { kind: "chunks", from: probe };
};

// iOS poursuit un PUT d'arrière-plan même si l'app a été tuée. Un second envoi en parallèle ferait échouer la session :
// on attend que le compteur du serveur ne bouge plus (ou que l'envoi soit terminé) avant de décider.
export const settleProbe = async (
  probe: () => Promise<number | "complete">,
  wait: () => Promise<void>,
): Promise<number | "complete"> => {
  let previous = await probe();
  for (;;) {
    if (previous === "complete") return previous;
    // eslint-disable-next-line no-await-in-loop -- deux relevés espacés, dans l'ordre
    await wait();
    // eslint-disable-next-line no-await-in-loop -- deux relevés espacés, dans l'ordre
    const current = await probe();
    if (current === previous) return current;
    previous = current;
  }
};

export const progressPct = (offset: number, total: number): number =>
  total <= 0 ? 0 : Math.min(100, Math.round((offset / total) * 100));

// Attente entre deux tentatives : 5 s, 10 s, 20 s… plafonnée à 5 min.
export const retryDelayMs = (attempt: number): number => Math.min(5000 * 2 ** Math.max(0, attempt), 300_000);
