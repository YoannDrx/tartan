import { highJump } from "@tartan/game/events/high-jump";
import { m } from "@tartan/i18n";
import { barUi } from "./bar-ui";
import { drawHighJump } from "./high-jump-scene";

export const highJumpUi = barUi({
  id: "highJump",
  sim: highJump,
  recordKey: "tartan.jeu.hauteur.record",
  texts: m.game.events.highJump,
  draw: drawHighJump,
});
