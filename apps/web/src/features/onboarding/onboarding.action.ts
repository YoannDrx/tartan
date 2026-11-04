"use server";

import { cookies } from "next/headers";
import { createOrganizationInput, profileInput } from "@tartan/contracts";
import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { setConsent } from "@/server/consent.service";
import { updateProfile } from "@/server/me.service";
import { createOrganization } from "@/server/org.service";
import { SPACE_COOKIE } from "@/features/shell/space";

export const createSpaceAction = authAction
  .inputSchema(createOrganizationInput.extend({ profile: profileInput, termsAccepted: z.literal(true) }))
  .action(async ({ parsedInput: { profile, termsAccepted: _terms, ...org }, ctx }) => {
    await updateProfile(ctx.actor.userId, profile);
    await setConsent(ctx.actor.userId, "terms", true);
    const jar = await cookies();
    const referralCode = jar.get("tartan_ref")?.value;
    const created = await createOrganization(ctx.actor.userId, {
      ...org,
      referralCode: org.referralCode ?? referralCode,
    });
    jar.set(SPACE_COOKIE, created.id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return { organizationId: created.id };
  });
