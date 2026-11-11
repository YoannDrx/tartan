// Les six épreuves du groupe, chacune avec son geste complet.
import { DISCUS_CLIP } from "./discus";
import type { EventClip, EventId } from "./event";
import { HIGH_JUMP_CLIP } from "./high-jump-event";
import { HURDLES_CLIP } from "./hurdles";
import { LONG_JUMP_CLIP } from "./long-jump";
import { POLE_VAULT_CLIP } from "./pole-vault";
import { TRIPLE_JUMP_CLIP } from "./triple-jump";

export const CLIPS: Record<EventId, EventClip> = {
  hurdles: HURDLES_CLIP,
  poleVault: POLE_VAULT_CLIP,
  tripleJump: TRIPLE_JUMP_CLIP,
  discus: DISCUS_CLIP,
  longJump: LONG_JUMP_CLIP,
  highJump: HIGH_JUMP_CLIP,
};
