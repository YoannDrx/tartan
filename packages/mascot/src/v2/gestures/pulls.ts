// Les tirages et le soulevé de terre d'haltérophilie : Malo. Le tirage reprend la tirée complète de l'arraché ou
// de l'épaulé jusqu'à l'extension, épaules haussées, bras longs, sans passer sous la barre ; puis la barre
// redescend sous contrôle. Le soulevé de terre prise d'arraché garde la même trajectoire, lentement, jusqu'à la
// station debout : épaules au-dessus de la barre jusqu'aux genoux, barre près des jambes. Réglé à l'œil d'après
// les fiches du catalogue et la tirée de l'arraché : aucune source ouverte pour ces trois gestes.
import { gesture, type KeyDraft } from "../gesture";
import type { ControlPatch } from "../pose";
import {
  CLEAN_RIG,
  cleanBase,
  cleanExtension,
  cleanFirstPull,
  cleanHips,
  cleanKnees,
  startKey as cleanStartKey,
} from "./clean";
import {
  SNATCH_RIG,
  snatchBase,
  snatchExtension,
  snatchFirstPull,
  snatchHips,
  snatchKnees,
  snatchStartKey,
} from "./snatch";

// L'extension tenue un instant, puis la barre redescend aux hanches, puis au sol par les genoux.
const pullEnd = (extension: ControlPatch, hips: ControlPatch, knees: ControlPatch, guide: number): KeyDraft[] => [
  {
    id: "extension",
    guide: 2,
    set: extension,
    hold: 250,
    face: "effort",
    move: { ms: 160, curve: "elan", phase: "second-pull" },
  },
  // Les talons et la barre redescendent ensemble : les bras restent longs.
  { id: "hips", set: hips, hold: 200, move: { ms: 420, curve: "impulsion", phase: "return" } },
  { id: "knees-return", guide, set: knees, still: true, move: { ms: 700, curve: "linear", phase: "return" } },
];

export const snatchPull = gesture({
  key: "snatch-pull",
  athlete: "poleVault",
  rig: SNATCH_RIG,
  base: snatchBase,
  keys: [
    snatchStartKey(0, 640),
    ...snatchFirstPull({ knees: 1 }),
    ...pullEnd(snatchExtension, snatchHips, snatchKnees, 3),
  ],
});

export const cleanPull = gesture({
  key: "clean-pull",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [cleanStartKey(0, 640), ...cleanFirstPull({ knees: 1 }), ...pullEnd(cleanExtension, cleanHips, cleanKnees, 3)],
});

// Le soulevé de terre : la même trajectoire, sans extension sur l'avant-pied ; la montée et la descente sont
// tenues, la descente un peu plus lente.
export const snatchDeadlift = gesture({
  key: "snatch-deadlift",
  athlete: "poleVault",
  rig: SNATCH_RIG,
  base: snatchBase,
  keys: [
    { ...snatchStartKey(0, 800), move: { ms: 900, curve: "reception", phase: "lower" } },
    {
      id: "knees",
      guide: 1,
      set: snatchKnees,
      face: "effort",
      still: true,
      move: { ms: 900, curve: "elan", phase: "lift" },
    },
    { id: "standing", guide: 2, set: snatchHips, hold: 700, move: { ms: 700, curve: "reception", phase: "lift" } },
    {
      id: "knees-down",
      guide: 3,
      set: snatchKnees,
      still: true,
      move: { ms: 1100, curve: "linear", phase: "lower" },
    },
  ],
});
