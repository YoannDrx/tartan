import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
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
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
      <Logo height={40} />
      <h1 className="t-display">{title}</h1>
      {blocked ? (
        <p role="alert" className="rounded-card border border-border bg-surface p-4">
          {blocked}
        </p>
      ) : actor && me ? (
        <AcceptForm
          token={token}
          role={invitation.role}
          firstName={me.firstName ?? ""}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
        />
      ) : (
        <>
          <p className="text-muted">Connecte-toi pour rejoindre. Tu reviendras ici juste après.</p>
          <SignInForm
            callbackURL={`/i/${token}`}
            providers={enabledSocialProviders}
            defaultEmail={invitation.email ?? undefined}
          />
        </>
      )}
    </main>
  );
}
