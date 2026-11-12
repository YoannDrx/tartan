import { poleVault } from "@tartan/game/events/pole-vault";
import { m } from "@tartan/i18n";
import { barUi } from "./bar-ui";
import { drawPoleVault } from "./pole-vault-scene";

export const poleVaultUi = barUi({
  id: "poleVault",
  sim: poleVault,
  recordKey: "tartan.jeu.perche.record",
  texts: m.game.events.poleVault,
  draw: drawPoleVault,
});
