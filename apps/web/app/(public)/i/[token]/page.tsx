import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Avatar } from "@/components/avatar";
import { PublicPage } from "@/features/shell/public-page";
import { AppError } from "@/lib/errors";
import { enabledSocialProviders } from "@/lib/auth";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";
import { AcceptForm } from "@/features/invitations/accept-form";
import { parentalFlowEnabled } from "@/server/age.service";
import { invitationConflictMessage, previewInvitation } from "@/server/invitation.service";
import { getMe } from "@/server/me.service";

export const metadata: Metadata = { title: w.auth.inviteTitle, robots: { index: false } };

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
  // Le refus s'affiche avant le formulaire : inutile de le remplir pour l'apprendre ensuite.
  const conflict = actor && !blocked ? await invitationConflictMessage(token, actor.userId) : null;

  return (
    <PublicPage title={title} lead={!blocked && !(actor && me) ? w.auth.inviteLead : undefined}>
      <div className="on-card flex flex-col gap-4 rounded-card bg-card p-5">
        {/* Qui invite : sa photo ou son avatar, avec son nom, pour reconnaître l'invitation d'un coup d'œil. */}
        <p className="flex items-center gap-3">
          <Avatar
            person={{
              name: invitation.inviterName,
              avatarUrl: invitation.inviterAvatarUrl,
              avatarPreset: invitation.inviterAvatarPreset,
            }}
            size="lg"
          />
          <span className="flex flex-col leading-snug">
            <span className="font-semibold">{invitation.inviterName}</span>
            <span className="t-caption font-normal text-soft">{invitation.organizationName}</span>
          </span>
        </p>
        {blocked || conflict ? (
          <p role="alert">{blocked ?? conflict}</p>
        ) : actor && me ? (
          <AcceptForm
            token={token}
            role={invitation.role}
            firstName={me.firstName ?? ""}
            lastName={me.lastName ?? ""}
            birthDate={me.birthDate ?? ""}
            parentalFlow={parentalFlowEnabled()}
          />
        ) : (
          <SignInForm
            callbackURL={`/i/${token}`}
            providers={enabledSocialProviders}
            defaultEmail={invitation.email ?? undefined}
            // Un invité est le plus souvent nouveau : il crée son compte, et peut dire qu'il en a déjà un.
            intent="create"
            switchable
          />
        )}
      </div>
    </PublicPage>
  );
}
