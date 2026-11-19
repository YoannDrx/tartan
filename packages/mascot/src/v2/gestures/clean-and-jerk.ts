// L'épaulé-jeté : Malo. L'épaulé (clean.ts), puis le jeté en fente (jerk.ts), sans que la barre ne quitte les
// mains. Retour : le pied avant recule d'abord, puis le pied arrière avance, comme le dit le guide de la fiche.
import { gesture } from "../gesture";
import { CLEAN_RIG, cleanBase, cleanKeys, returnKeys, startKey } from "./clean";
import { backToShoulders, dipAndDrive, jerkAdjust, jerkSet, splitAndRecover } from "./jerk";

export const cleanAndJerk = gesture({
  key: "clean-and-jerk",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    startKey(0, 520),
    ...cleanKeys({ standing: 1 }, 500),
    { id: "adjust", set: jerkAdjust, air: ["R", "L"], move: { ms: 180, curve: "linear", phase: "adjust" } },
    { id: "set", set: jerkSet, hold: 500, guide: 2, move: { ms: 180, curve: "reception", phase: "adjust" } },
    ...dipAndDrive(),
    ...splitAndRecover({ split: 3 }),
    ...backToShoulders(),
    ...returnKeys(),
  ],
});
