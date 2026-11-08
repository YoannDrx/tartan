import type { CreateVideoInput } from "@tartan/contracts";

/** Le choix explicite de la hauteur est requis : des champs repliés ne deviennent pas une performance. */
export const captureVideoInput = (input: CreateVideoInput, highJump: boolean): CreateVideoInput => ({
  ...input,
  attempt: highJump ? input.attempt : null,
});
