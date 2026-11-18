// Le registre des gestes du nouveau moteur : pour chaque clé du catalogue, le geste, d'où il vient et sous quels
// angles il se lit. Un geste écrit à la main a sa technique et sa dynamique ; un geste relevé reprend l'ancien
// tel quel (lift-v1.ts) en attendant d'être écrit. Le premier moteur et ses consommateurs ne changent pas.
import type { ExerciseClip } from "../exercise";
import { EXERCISE_CLIPS } from "../exercises";
import type { MotionClip } from "./gesture";
import { GESTURES } from "./gestures";
import { liftClip } from "./lift-v1";
import type { GestureView } from "./project";

export const LEVELS = ["ecrit", "releve"] as const;
export type Level = (typeof LEVELS)[number];

export type GestureEntry = {
  key: string;
  level: Level;
  clip: MotionClip;
  // La vue où le geste se lit d'abord, puis toutes celles où il se lit.
  native: GestureView;
  views: readonly GestureView[];
};

export const GESTURE_KEYS: readonly string[] = Object.keys(EXERCISE_CLIPS);

// Un geste au sol (couché, en planche, à quatre pattes) se lit aussi de dessus : le buste est couché et le bassin
// et la tête bas. Un buste penché debout (un soulevé de terre, un rowing) n'en fait pas un geste au sol.
const onTheGround = (clip: MotionClip) =>
  [0, 0.25, 0.5, 0.75].some((t) => {
    const body = clip.pose(t);
    return body.pelvis.y < 105 && body.head.y < 150 && Math.abs(body.frames.thorax.u.y) < 0.5;
  });

const viewsOf = (old: ExerciseClip, clip: MotionClip): { native: GestureView; views: GestureView[] } => {
  const floor: GestureView[] = onTheGround(clip) ? ["top"] : [];
  // Un corps couché vu de face n'est qu'une tache : il se lit de profil et de dessus.
  if (old.facing === "side") return { native: "side", views: floor.length > 0 ? ["side", "top"] : ["side", "front"] };
  // Un geste dessiné de face n'a pas de profil écrit : la projection en donne un, à plat dans le plan de face.
  if (old.facing === "front")
    return { native: "front", views: floor.length > 0 ? ["front", "top"] : ["front", "side"] };
  return { native: "top", views: ["top", "side"] };
};

const cache = new Map<string, GestureEntry>();

// Le geste d'une clé du catalogue. Relevé à la première demande, puis gardé.
export const gestureEntry = (key: string): GestureEntry | null => {
  const known = cache.get(key);
  if (known) return known;
  const old = EXERCISE_CLIPS[key];
  if (!old) return null;
  const written = GESTURES[key];
  // Un geste écrit se lit de profil ; au sol (des pompes), de dessus plutôt que de face.
  const entry: GestureEntry = written
    ? { key, level: "ecrit", clip: written, native: "side", views: ["side", onTheGround(written) ? "top" : "front"] }
    : (() => {
        const clip = liftClip(old);
        return { key, level: "releve" as const, clip, ...viewsOf(old, clip) };
      })();
  cache.set(key, entry);
  return entry;
};

export const gestureClip = (catalogKey: string | null | undefined): MotionClip | null =>
  (catalogKey && gestureEntry(catalogKey)?.clip) || null;
