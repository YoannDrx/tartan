"use server";

import { cookies } from "next/headers";
import { createOrganizationInput, profileInput } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import { updateProfile } from "@/server/me.service";
import { createOrganization } from "@/server/org.service";
import { SPACE_COOKIE } from "@/features/shell/space";

export const createSpaceAction = authAction
  .inputSchema(createOrganizationInput.extend({ profile: profileInput }))
  .action(async ({ parsedInput: { profile, ...org }, ctx }) => {
    await updateProfile(ctx.actor.userId, profile);
    const jar = await cookies();
    const referralCode = jar.get("tartan_ref")?.value;
    const created = await createOrganization(ctx.actor.userId, {
      ...org,
      referralCode: org.referralCode ?? referralCode,
    });
    jar.set(SPACE_COOKIE, created.id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return { organizationId: created.id };
  });
