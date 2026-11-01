// Le protocole d'envoi est partagé avec le web.
export {
  CHUNK_SIZE,
  classifyResponse,
  contentRange,
  nextChunk,
  offsetFromRangeHeader,
  planUpload,
  progressPct,
  retryDelayMs,
  settleProbe,
  statusProbeRange,
  type ChunkOutcome,
  type ChunkRange,
  type UploadStep,
} from "@tartan/domain";
