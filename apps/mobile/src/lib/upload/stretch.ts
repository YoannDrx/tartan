import { MAX_FILE_SECONDS, planStretch, type ReadBytes } from "@tartan/domain";

export type StretchedFile = {
  size: number;
  read: ReadBytes;
  write: (offset: number, bytes: Uint8Array) => void;
};

export type StretchOutcome =
  // `fps` nul : fichier illisible ainsi (autre format, MP4 fragmenté), il part tel quel.
  | { kind: "ready"; fps: number | null; timeScale: number }
  | { kind: "too-long"; maxSeconds: number };

// Garde chaque image d'un ralenti (voir video-stretch, côté domaine) : l'en-tête est réécrit sur la copie de l'app,
// jamais sur le fichier d'origine. Seul l'en-tête passe en mémoire, le reste du fichier n'est pas lu.
export const stretchInPlace = async (file: StretchedFile): Promise<StretchOutcome> => {
  const plan = await planStretch(file.read, file.size);
  if (!plan) return { kind: "ready", fps: null, timeScale: 1 };
  if (plan.durationSeconds * plan.timeScale > MAX_FILE_SECONDS) {
    return { kind: "too-long", maxSeconds: Math.floor(MAX_FILE_SECONDS / plan.timeScale) };
  }
  if (plan.patch) file.write(plan.patch.offset, plan.patch.bytes);
  return { kind: "ready", fps: plan.fps, timeScale: plan.timeScale };
};
