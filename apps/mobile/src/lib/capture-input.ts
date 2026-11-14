import type { CreateVideoInput } from "@tartan/contracts";

/** Le choix explicite de la hauteur est requis : des champs repliés ne deviennent pas une performance. */
export const captureVideoInput = (input: CreateVideoInput, highJump: boolean, ownVideo = false): CreateVideoInput => {
  const { athleteId, ...rest } = input;
  return { ...rest, ...(ownVideo ? {} : { athleteId }), attempt: highJump ? input.attempt : null };
};

// The durable queue identifier survives retries and upgrades from clients without clientId.
export const queuedVideoInput = (id: string, input: CreateVideoInput): CreateVideoInput => ({
  ...input,
  clientId: input.clientId ?? id,
});
