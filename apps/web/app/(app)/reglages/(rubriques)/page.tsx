import { can } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { cookies } from "next/headers";
import { AnchorRedirect } from "@/features/settings/anchor-redirect";
import { ProfileSheet } from "@/features/settings/profil/profile-sheet";
import { requireRubric } from "@/features/settings/rubric-access";
import { SettingsIndex } from "@/features/settings/settings-index";
import { THEME_COOKIE, themePreference } from "@/features/shell/theme";
import { listReports } from "@/server/comm.service";
import { listInvitations } from "@/server/invitation.service";
import { getMe } from "@/server/me.service";
import { listMembers } from "@/server/members.service";
import { getOrganization, listGroups } from "@/server/org.service";

// Le sommaire des réglages. Sur téléphone, la liste des rubriques et ce que chacune contient ; sur ordinateur,
// la première rubrique (le profil) à côté de la barre latérale. Les anciennes ancres y sont redirigées.
export default async function ReglagesPage() {
  const { actor, organizationId, space, access } = await requireRubric("profil");
  const role = access.role;
  const canInvite = can(role, "inviteAthlete");
  const canManage = can(role, "manageOrganization");
  const [me, groups, invitations, members, reports, organization] = await Promise.all([
    getMe(actor.userId),
    canInvite ? listGroups(access) : [],
    canInvite ? listInvitations(actor.userId, organizationId) : [],
    canManage ? listMembers(actor.userId, organizationId) : null,
    canManage ? listReports(actor.userId, organizationId) : [],
    can(role, "manageSubscription") ? getOrganization(actor.userId, organizationId) : null,
  ]);
  const theme = themePreference((await cookies()).get(THEME_COOKIE)?.value);
  // Une invitation nominative qui attend sa réponse ; un lien de groupe, lui, reste ouvert.
  const pending = invitations.filter(
    (invitation) => (invitation.email || invitation.phone) && ["sent", "opened"].includes(invitation.status),
  ).length;
  const t = w.settings.rubrics;
  const athlete = role === "athlete";
  return (
    <>
      <AnchorRedirect role={role} />
      <SettingsIndex
        role={role}
        spaceName={space.organizationName}
        summaries={{
          profil: `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.email,
          connexion: t.connexion.summary,
          notifications: access.athleteId ? t.notifications.summaryAthlete : t.notifications.summary,
          apparence: t.apparence.summary(m.appearance[theme]),
          confidentialite: athlete ? t.confidentialite.summaryAthlete : t.confidentialite.summary,
          espace: reports.length > 0 ? t.espace.summaryReports(reports.length) : t.espace.summary,
          groupes: t.groupes.summary(groups.length),
          membres: t.membres.summary(members ? members.length : null, pending),
          abonnement: organization ? t.abonnement.summary(m.billing.plans[organization.plan]) : "",
          aide: t.aide.summary,
        }}
      />
      <div className="max-desktop:hidden">
        <ProfileSheet me={me} />
      </div>
    </>
  );
}
