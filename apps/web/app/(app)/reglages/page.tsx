import type { Metadata } from "next";
import { can } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import {
  AvatarForm,
  ConsentSwitches,
  DeleteAccount,
  GroupRow,
  InvitationList,
  InviteForm,
  NewGroupForm,
  OrganizationForm,
  ProfileForm,
  SignOutButton,
  WebPushToggle,
} from "@/features/settings/settings-forms";
import { requireOrgMember } from "@/server/access";
import { consentForAthletes, getUserConsents } from "@/server/consent.service";
import { listInvitations } from "@/server/invitation.service";
import { getMe } from "@/server/me.service";
import { getOrganization, listGroups } from "@/server/org.service";
import { referralStats } from "@/server/referral.service";

export const metadata: Metadata = { title: m.settings.title };

const Section = ({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="flex scroll-mt-20 flex-col gap-3 rounded-block border border-border bg-surface p-4">
    <h2 className="t-h2">{title}</h2>
    {children}
  </section>
);

export default async function ReglagesPage() {
  const { actor, organizationId, space } = await requireSpace();
  const me = await getMe(actor.userId);
  const access = await requireOrgMember(actor.userId, organizationId);
  const canInvite = can(access.role, "inviteAthlete");
  const [groups, invitations, consents, effective, referral, organization] = await Promise.all([
    canInvite ? listGroups(access) : Promise.resolve([]),
    canInvite ? listInvitations(actor.userId, organizationId) : Promise.resolve([]),
    getUserConsents(actor.userId),
    access.athleteId ? consentForAthletes([access.athleteId]) : Promise.resolve(null),
    canInvite ? referralStats(actor.userId) : Promise.resolve(null),
    getOrganization(actor.userId, organizationId),
  ]);
  const parentalPending = access.athleteId ? (effective?.get(access.athleteId)?.parentalPending ?? false) : false;
  const isAthlete = access.role === "athlete";
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={m.settings.title} detail={`${space.organizationName}, ${m.roles[space.role].toLowerCase()}`} />
      <Section title={m.settings.profile}>
        <p className="text-muted">{me.email}</p>
        {env().BLOB_READ_WRITE_TOKEN ? (
          <AvatarForm avatarUrl={me.avatarUrl} name={`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.email} />
        ) : null}
        <ProfileForm
          firstName={me.firstName ?? ""}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
          units={me.units}
        />
      </Section>
      {can(access.role, "manageOrganization") ? (
        <Section title={m.settings.organization}>
          <OrganizationForm name={organization.name} overdueReminders={organization.overdueReminders} />
        </Section>
      ) : null}
      {canInvite ? (
        <>
          <Section id="invitations" title={m.settings.groups}>
            <ul className="divide-y divide-border">
              {groups.map((g) => (
                <GroupRow key={g.id} group={g} canDelete={can(access.role, "manageOrganization")} />
              ))}
            </ul>
            <NewGroupForm />
          </Section>
          <Section title={m.settings.invitations}>
            <InviteForm groups={groups} canInviteCoach={can(access.role, "inviteCoach")} />
            <InvitationList invitations={invitations} />
          </Section>
        </>
      ) : null}
      {isAthlete ? (
        <Section title={m.settings.privacy}>
          <ConsentSwitches health={consents.health} video={consents.video} parentalPending={parentalPending} />
        </Section>
      ) : null}
      {can(access.role, "manageSubscription") ? (
        <Section title={m.settings.plan}>
          <p>{m.settings.planPilot}</p>
        </Section>
      ) : null}
      {referral ? (
        <Section title={m.settings.referral}>
          <p>{m.settings.referralDetail}</p>
          <p className="break-all font-semibold">{`${env().NEXT_PUBLIC_APP_URL}/r/${referral.code}`}</p>
          <p className="t-caption font-normal text-muted">
            {referral.signups} inscrit{referral.signups > 1 ? "s" : ""} grâce à ton lien.
          </p>
        </Section>
      ) : null}
      {env().NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
        <Section title={m.push.permissionTitle}>
          <WebPushToggle vapidKey={env().NEXT_PUBLIC_VAPID_PUBLIC_KEY as string} />
        </Section>
      ) : null}
      <Section title="Compte">
        <div className="flex flex-wrap gap-2">
          <SignOutButton />
          <DeleteAccount detail={m.settings.deleteDetail} />
        </div>
      </Section>
    </div>
  );
}
