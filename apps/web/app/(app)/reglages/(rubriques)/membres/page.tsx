import { can } from "@tartan/domain";
import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { InvitationList, InviteForm } from "@/features/settings/membres/invitations";
import { MemberList } from "@/features/settings/membres/members";
import { requireRubric } from "@/features/settings/rubric-access";
import { listInvitations } from "@/server/invitation.service";
import { listMembers } from "@/server/members.service";
import { listGroups } from "@/server/org.service";

export const metadata: Metadata = { title: w.settings.rubrics.membres.title };

export default async function MembresPage() {
  const { actor, organizationId, access } = await requireRubric("membres");
  const canInvite = can(access.role, "inviteAthlete");
  const canManage = can(access.role, "manageOrganization");
  const [groups, members, invitations] = await Promise.all([
    canInvite ? listGroups(access) : [],
    canManage ? listMembers(actor.userId, organizationId) : [],
    canInvite ? listInvitations(actor.userId, organizationId) : [],
  ]);
  const t = w.settings.membres;
  return (
    <Sheet className="divide-y divide-card-line">
      {canManage ? (
        <SheetSection id="membres" title={m.settings.members}>
          <MemberList members={members} groups={groups} />
        </SheetSection>
      ) : null}
      {canInvite ? (
        <SheetSection id="inviter" title={t.invite}>
          <InviteForm groups={groups} canInviteCoach={can(access.role, "inviteCoach")} />
        </SheetSection>
      ) : null}
      {canInvite ? (
        <SheetSection id="invitations-envoyees" title={t.sent}>
          <InvitationList invitations={invitations} />
        </SheetSection>
      ) : null}
    </Sheet>
  );
}
