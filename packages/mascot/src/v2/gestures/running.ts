// La course et ses éducatifs, tirés du générateur de foulée (stride.ts) : chaque geste n'est qu'un jeu de
// paramètres. Lucas (l'athlète des haies) pour la course, Ninon pour les foulées bondissantes.
// Ordres de grandeur retenus : course facile vers 165 pas par minute et un mètre par pas, tempo vers 175 pas et
// 1,35 m, sprint lancé vers 200 pas et 1,8 m, foulées bondissantes vers 120 pas et plus de deux mètres ; montées
// de genoux et talons-fesses à cadence haute, en avançant à peine. Réglés à l'œil : aucune source ouverte.
import { strideClip } from "./stride";

export const easyContinuousRun = strideClip({
  key: "easy-continuous-run",
  athlete: "hurdles",
  cadence: 165,
  step: 190,
  flight: 0.3,
  knee: 42,
  heel: 92,
  lean: 6,
  arms: 0.55,
  sink: 10,
  guides: [0, 1, 2, 3],
});

export const trackTempo = strideClip({
  key: "track-tempo",
  athlete: "hurdles",
  cadence: 175,
  step: 250,
  flight: 0.4,
  knee: 52,
  heel: 108,
  lean: 7,
  arms: 0.75,
  sink: 9,
  guides: [0, 1, 2, 3],
});

export const flyingSprint = strideClip({
  key: "flying-sprint",
  athlete: "hurdles",
  cadence: 200,
  step: 330,
  flight: 0.5,
  knee: 70,
  heel: 128,
  lean: 9,
  arms: 1,
  sink: 8,
  guides: [0, 1, 2, 3],
});

export const highKnees = strideClip({
  key: "high-knees",
  athlete: "hurdles",
  cadence: 210,
  step: 50,
  flight: 0.3,
  knee: 84,
  heel: 100,
  lean: 0,
  arms: 0.9,
  sink: 4,
  reach: 10,
  guides: [0, 1, 2, 3],
});

export const buttKicks = strideClip({
  key: "butt-kicks",
  athlete: "hurdles",
  cadence: 200,
  step: 56,
  flight: 0.3,
  knee: 16,
  heel: 138,
  lean: 3,
  arms: 0.6,
  sink: 4,
  reach: 10,
  guides: [0, 1, 2, 3],
});

export const alternatingBounds = strideClip({
  key: "alternating-bounds",
  athlete: "highJump",
  cadence: 120,
  step: 400,
  flight: 0.62,
  knee: 78,
  heel: 92,
  lean: 8,
  arms: 1,
  sink: 18,
  guides: [0, 1, 2, 3],
});
