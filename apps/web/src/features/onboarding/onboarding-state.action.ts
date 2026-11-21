"use server";

import { inviteEmailsInput, onboardingPatch } from "@tartan/contracts";
import { spaceAction } from "@/features/shell/space-action";
import { inviteByEmails } from "@/server/invitation.service";
import { updateOnboarding } from "@/server/onboarding.service";

// Les premiers pas du membre connecté, dans l'espace en cours : la même écriture que `PATCH …/onboarding`.
export const updateOnboardingAction = spaceAction
  .inputSchema(onboardingPatch)
  .action(({ parsedInput, ctx }) => updateOnboarding(ctx.userId, ctx.organizationId, parsedInput));

// Quelques adresses d'un coup, depuis la création de l'espace ou la carte des premiers pas.
export const inviteEmailsAction = spaceAction
  .inputSchema(inviteEmailsInput)
  .action(({ parsedInput, ctx }) =>
    inviteByEmails(ctx.userId, ctx.organizationId, parsedInput.groupId, parsedInput.emails),
  );
