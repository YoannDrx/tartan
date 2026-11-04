import type { Metadata } from "next";
import { can, requiresParentalConsent } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { env } from "@/lib/env";
import Link from "next/link";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { requireSpace } from "@/features/shell/space";
import {
  AvatarForm,
  ConsentSwitches,
  DeleteAccount,
  GroupRow,
  InvitationList,
  InviteForm,
  LogoForm,
  NewGroupForm,
  OrganizationForm,
  ProfileForm,
  ReferralLink,
  RevokeOtherSessionsButton,
  SignOutButton,
  WebPushToggle,
} from "@/features/settings/settings-forms";
import { LeaveSpace, MemberList } from "@/features/settings/members";
import { ReportList } from "@/features/settings/reports";
import { isAdmin } from "@/server/admin.service";
import { listReports } from "@/server/comm.service";
import { requireOrgMember } from "@/server/access";
import { icalLink } from "@/server/ical.service";
import { listMembers } from "@/server/members.service";
import { consentForAthletes, getUserConsents } from "@/server/consent.service";
import { listInvitations } from "@/server/invitation.service";
import { getMe } from "@/server/me.service";
import { ensureReferralCode, getOrganization, listGroups } from "@/server/org.service";
import { referralStats } from "@/server/referral.service";

export const metadata: Metadata = { title: m.settings.title };

export default async function ReglagesPage() {
  const { actor, organizationId, space } = await requireSpace();
  const me = await getMe(actor.userId);
  const access = await requireOrgMember(actor.userId, organizationId);
  const canInvite = can(access.role, "inviteAthlete");
  const canManageMembers = can(access.role, "manageOrganization");
  // Les athlètes mineurs ne participent à aucune mécanique de parrainage (§ 17.4).
  const adultAthlete =
    access.role === "athlete" && Boolean(me.birthDate) && !requiresParentalConsent(me.birthDate, new Date());
  const shareableReferral = async (userId: string) => {
    await ensureReferralCode(userId);
    return referralStats(userId);
  };
  const [groups, invitations, consents, effective, referral, organization, members, ical, reports] = await Promise.all([
    canInvite ? listGroups(access) : Promise.resolve([]),
    canInvite ? listInvitations(actor.userId, organizationId) : Promise.resolve([]),
    getUserConsents(actor.userId),
    access.athleteId ? consentForAthletes([access.athleteId]) : Promise.resolve(null),
    canInvite || adultAthlete ? shareableReferral(actor.userId) : Promise.resolve(null),
    getOrganization(actor.userId, organizationId),
    canManageMembers ? listMembers(actor.userId, organizationId) : Promise.resolve([]),
    access.athleteId ? icalLink(actor.userId, organizationId) : Promise.resolve(null),
    canManageMembers ? listReports(actor.userId, organizationId) : Promise.resolve([]),
  ]);
  const parentalPending = access.athleteId ? (effective?.get(access.athleteId)?.parentalPending ?? false) : false;
  const isAthlete = access.role === "athlete";
  const referralLink = referral ? `${env().NEXT_PUBLIC_APP_URL}/r/${referral.code}` : null;
  const vapidKey = env().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const sections = [
    {
      id: "profil",
      title: m.settings.profile,
      content: (
        <div className="flex flex-col gap-4">
          <p>
            <span className="t-caption block text-soft">{m.auth.emailLabel}</span>
            <span className="break-all">{me.email}</span>
          </p>
          {env().BLOB_READ_WRITE_TOKEN ? (
            <AvatarForm
              avatarUrl={me.avatarUrl}
              name={`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.email}
            />
          ) : null}
          <ProfileForm
            firstName={me.firstName ?? ""}
            lastName={me.lastName ?? ""}
            birthDate={me.birthDate ?? ""}
            units={me.units}
          />
        </div>
      ),
    },
    can(access.role, "manageOrganization")
      ? {
          id: "espace",
          title: m.settings.organization,
          content: (
            <div className="flex flex-col gap-4">
              {env().BLOB_READ_WRITE_TOKEN ? (
                <LogoForm logoUrl={organization.logoUrl} name={organization.name} />
              ) : null}
              <OrganizationForm
                name={organization.name}
                overdueReminders={organization.overdueReminders}
                disciplines={organization.disciplines}
              />
            </div>
          ),
        }
      : null,
    canManageMembers
      ? { id: "signalements", title: m.settings.reports, content: <ReportList reports={reports} /> }
      : null,
    canManageMembers
      ? { id: "membres", title: m.settings.members, content: <MemberList members={members} groups={groups} /> }
      : null,
    // L'ancre #invitations reste sur les groupes : c'est là qu'est le lien à partager.
    canInvite
      ? {
          id: "invitations",
          title: m.settings.groups,
          content: (
            <div className="flex flex-col gap-3">
              {groups.length > 0 ? (
                <Rows>
                  {groups.map((g) => (
                    <GroupRow key={g.id} group={g} canDelete={can(access.role, "manageOrganization")} />
                  ))}
                </Rows>
              ) : null}
              <NewGroupForm />
            </div>
          ),
        }
      : null,
    canInvite
      ? {
          id: "inviter",
          title: m.settings.invitations,
          content: (
            <div className="flex flex-col gap-4">
              <InviteForm groups={groups} canInviteCoach={can(access.role, "inviteCoach")} />
              <InvitationList invitations={invitations} />
            </div>
          ),
        }
      : null,
    isAthlete
      ? {
          id: "confidentialite",
          title: m.settings.privacy,
          content: (
            <ConsentSwitches health={consents.health} video={consents.video} parentalPending={parentalPending} />
          ),
        }
      : null,
    can(access.role, "manageSubscription")
      ? {
          id: "offre",
          title: m.settings.plan,
          content: (
            <Button asChild size="sm" variant="secondary">
              <Link href="/abonnement">{m.settings.planOpen}</Link>
            </Button>
          ),
        }
      : null,
    referral && referralLink
      ? {
          id: "parrainage",
          title: m.settings.referral,
          content: (
            <div className="flex flex-col gap-2">
              <p>{isAthlete ? m.settings.referralAthleteDetail : m.settings.referralDetail}</p>
              <ReferralLink link={referralLink} />
              <p className="t-caption font-normal text-soft">
                {m.settings.referralCounts(referral.signups, referral.paying, referral.months)}
              </p>
            </div>
          ),
        }
      : null,
    ical
      ? {
          id: "agenda",
          title: m.settings.calendar,
          content: (
            <div className="flex flex-col gap-2">
              <p>{m.settings.calendarDetail}</p>
              <ReferralLink link={ical} />
            </div>
          ),
        }
      : null,
    vapidKey
      ? { id: "notifications", title: m.push.permissionTitle, content: <WebPushToggle vapidKey={vapidKey} /> }
      : null,
    isAdmin(actor.email)
      ? {
          id: "console",
          title: m.admin.title,
          content: (
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin">{m.admin.title}</Link>
            </Button>
          ),
        }
      : null,
    {
      id: "compte",
      title: m.settings.account,
      content: (
        <div className="flex flex-col gap-3">
          <div>
            <p>{m.settings.exportDetail}</p>
            <Button asChild size="sm" variant="secondary" className="mt-2">
              <a href="/api/v1/me/export" download>
                {m.settings.exportData}
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <RevokeOtherSessionsButton />
            <SignOutButton />
            {access.role === "owner" ? null : <LeaveSpace name={space.organizationName} />}
            <DeleteAccount detail={m.settings.deleteDetail} />
          </div>
        </div>
      ),
    },
  ].flatMap((section) => (section ? [section] : []));

  return (
    <div className="flex flex-col gap-4">
      <div className={isAthlete ? "mx-auto w-full max-w-2xl" : undefined}>
        <PageHeader
          title={m.settings.title}
          detail={`${space.organizationName}, ${m.roles[space.role].toLowerCase()}`}
        />
      </div>
      <div
        className={
          sections.length > 3
            ? "grid items-start gap-4 desktop:grid-cols-[208px_minmax(0,800px)] desktop:gap-6"
            : "mx-auto w-full max-w-2xl"
        }
      >
        {/* Barre latérale contextuelle (§ 10.2) ; une rangée de pastilles sur téléphone. */}
        {sections.length > 3 ? (
          <nav
            aria-label={m.settings.sectionsNav}
            className="flex gap-1.5 overflow-x-auto py-1 desktop:sticky desktop:top-20 desktop:flex-col desktop:gap-0 desktop:py-0"
          >
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-on-page px-3.5 font-medium no-underline hover:bg-raise desktop:-ml-3 desktop:border-0 desktop:text-[17px] desktop:font-semibold"
              >
                {section.title}
              </a>
            ))}
          </nav>
        ) : null}
        <Sheet className="divide-y divide-card-line">
          {sections.map((section) => (
            <SheetSection key={section.id} id={section.id} title={section.title}>
              {section.content}
            </SheetSection>
          ))}
        </Sheet>
      </div>
    </div>
  );
}
