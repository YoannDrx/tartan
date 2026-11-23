"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOrganizationInput, profileInput } from "@tartan/contracts";
import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { updateProfile } from "@/server/me.service";
import { createOrganization } from "@/server/org.service";
import { SPACE_COOKIE } from "@/features/shell/space";

// L'offre choisie sur les tarifs suit jusqu'à l'abonnement, après le dernier temps.
const offerInput = z.object({ offre: z.enum(["coach", "club"]), rythme: z.enum(["month", "year"]) });

export const createSpaceAction = authAction
  .inputSchema(
    createOrganizationInput.extend({
      profile: profileInput,
      termsAccepted: z.literal(true),
      offer: offerInput.optional(),
    }),
  )
  .action(async ({ parsedInput: { profile, termsAccepted: _terms, offer, ...org }, ctx }) => {
    await updateProfile(ctx.actor.userId, profile);
    const jar = await cookies();
    const referralCode = jar.get("tartan_ref")?.value;
    const created = await createOrganization(ctx.actor.userId, {
      ...org,
      termsAccepted: true,
      referralCode: org.referralCode ?? referralCode,
    });
    jar.set(SPACE_COOKIE, created.id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
    // Le dernier temps, facultatif : inviter le premier groupe, sur sa propre page.
    redirect(`/bienvenue/inviter${offer ? `?offre=${offer.offre}&rythme=${offer.rythme}` : ""}`);
  });
