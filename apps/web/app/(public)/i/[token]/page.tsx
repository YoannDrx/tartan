import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { AppError } from "@/lib/errors";
import { enabledSocialProviders } from "@/lib/auth";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";
import { AcceptForm } from "@/features/invitations/accept-form";
import { previewInvitation } from "@/server/invitation.service";
import { getMe } from "@/server/me.service";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

const load = async (token: string) => {
  try {
    return await previewInvitation(token);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await load(token);
  const group = invitation.groupNames[0] ?? invitation.organizationName;
  const title =
    invitation.role === "athlete"
      ? m.invite.title(invitation.inviterName, group)
      : m.invite.titleCoach(invitation.inviterName, invitation.organizationName);
  const blocked =
    invitation.state === "expired"
      ? m.invite.expired
      : invitation.state === "revoked"
        ? m.invite.revoked
        : invitation.state === "used"
          ? m.invite.used
          : null;
  const actor = await getActor();
  const me = actor ? await getMe(actor.userId) : null;

  return (
    <PublicPage
      title={title}
      lead={!blocked && !(actor && me) ? "Connecte-toi pour rejoindre. Tu reviendras ici juste après." : undefined}
    >
      <div className="on-card rounded-card bg-card p-5">
        {blocked ? (
          <p role="alert">{blocked}</p>
        ) : actor && me ? (
          <AcceptForm
            token={token}
            role={invitation.role}
            firstName={me.firstName ?? ""}
            lastName={me.lastName ?? ""}
            birthDate={me.birthDate ?? ""}
          />
        ) : (
          <SignInForm
            callbackURL={`/i/${token}`}
            providers={enabledSocialProviders}
            defaultEmail={invitation.email ?? undefined}
          />
        )}
      </div>
    </PublicPage>
  );
}
