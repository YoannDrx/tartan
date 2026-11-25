// Départs sur plots ou avec pause, avec les prises et réceptions des deux levées du catalogue.
import { BARBELL } from "../body";
import { gesture, type KeyDraft } from "../gesture";
import type { Prop } from "../props";
import { CLEAN_RIG, cleanBase, startKey, cleanKeys, returnKeys } from "./clean";
import {
  SNATCH_RIG,
  snatchBase,
  snatchStartKey,
  snatchFirstPull,
  snatchSecondPull,
  snatchSquatCatch,
  snatchLowerToHips,
  snatchKneesReturn,
} from "./snatch";

function lift(movement: "clean" | "snatch", blocks: boolean) {
  const clean = movement === "clean";
  const pull = clean
    ? cleanKeys({ receive: 2 }, 800)
    : [...snatchFirstPull(), snatchSecondPull(), ...snatchSquatCatch({ receive: 2 })];
  const [knees, ...rest] = pull;
  if (!knees?.set || knees.set.barY === undefined || knees.set.barX === undefined) throw Error("Missing knee position");
  const level = knees.set.barY - BARBELL.plate;
  const barX = knees.set.barX;
  const supports: Prop[] = [-1, 1].map((side) => ({
    native: "side",
    paint: "box",
    at: side * (BARBELL.collar + BARBELL.thickness),
    half: 32,
    shape: { kind: "rect", x: barX - 36, y: -level, width: 72, height: level },
  }));
  const floorStart = clean ? startKey(0, 520) : snatchStartKey(0, 520);
  const start: KeyDraft[] = blocks
    ? [
        { ...knees, guide: 0, hold: 700 },
        { ...knees, id: "set-grip", guide: 1, hold: 480, move: { ms: 80, curve: "linear", phase: "setup" } },
      ]
    : [floorStart, { ...knees, guide: 1, hold: 950 }];
  return gesture({
    key: movement + (blocks ? "-blocks" : "-pause-knee"),
    athlete: "poleVault",
    rig: clean ? CLEAN_RIG : SNATCH_RIG,
    base: clean ? cleanBase : snatchBase,
    keys: [...start, ...rest, ...(clean ? returnKeys() : [...snatchLowerToHips(), snatchKneesReturn()])],
    ...(blocks ? { props: () => supports } : {}),
  });
}
export const stadiumLifts = [lift("clean", true), lift("snatch", true), lift("clean", false), lift("snatch", false)];
