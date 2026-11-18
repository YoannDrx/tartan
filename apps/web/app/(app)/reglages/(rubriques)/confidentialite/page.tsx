import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { BlockedUsers } from "@/features/settings/confidentialite/blocked-users";
import { ConsentSwitches, DeleteAccount, LeaveSpace } from "@/features/settings/confidentialite/privacy-forms";
import { requireRubric } from "@/features/settings/rubric-access";
import { SettingRow } from "@/features/settings/setting-rows";
import { listBlockedUsers } from "@/server/comm.service";
import { athleteConsentState, consentForAthletes, getUserConsents } from "@/server/consent.service";

export const metadata: Metadata = { title: w.settings.rubrics.confidentialite.title };

// Les accords de l'athlète : ceux de sa fiche dans cet espace, et l'accord parental encore attendu.
const athleteConsents = async (userId: string, athleteId: string | null) => {
  if (!athleteId) return { ...(await getUserConsents(userId)), parentalPending: false };
  const [state, effective] = await Promise.all([athleteConsentState(athleteId), consentForAthletes([athleteId])]);
  return { ...state, parentalPending: effective.get(athleteId)?.parentalPending ?? false };
};

export default async function ConfidentialitePage() {
  const { actor, organizationId, space, access } = await requireRubric("confidentialite");
  const owner = access.role === "owner";
  const [consents, blockedUsers] = await Promise.all([
    access.role === "athlete" ? athleteConsents(actor.userId, access.athleteId) : null,
    listBlockedUsers(actor.userId),
  ]);
  const t = w.settings.confidentialite;
  return (
    <Sheet className="divide-y divide-card-line">
      {consents ? (
        <SheetSection id="confidentialite" title={t.consents}>
          <ConsentSwitches health={consents.health} video={consents.video} parentalPending={consents.parentalPending} />
        </SheetSection>
      ) : null}
      <SheetSection id="bloques" title={m.settings.blocked}>
        <BlockedUsers users={blockedUsers} />
      </SheetSection>
      <SheetSection id="donnees" title={t.data}>
        <Rows>
          <SettingRow
            action={
              <Button asChild size="sm" variant="secondary">
                <a href="/api/v1/me/export" download>
                  {m.settings.exportData}
                </a>
              </Button>
            }
          >
            {m.settings.exportDetail}
          </SettingRow>
          {owner ? (
            <SettingRow
              action={
                <Button asChild size="sm" variant="secondary">
                  <a href={`/api/v1/orgs/${organizationId}/export`} download="tartan-espace.json">
                    {m.settings.exportSpace}
                  </a>
                </Button>
              }
            >
              {t.exportSpaceDetail}
            </SettingRow>
          ) : null}
        </Rows>
      </SheetSection>
      {owner ? null : (
        <SheetSection id="espaces" title={t.spaces}>
          <Rows>
            <SettingRow action={<LeaveSpace name={space.organizationName} />}>
              {t.leaveDetail(space.organizationName)}
            </SettingRow>
            <SettingRow
              action={
                <Button asChild size="sm" variant="secondary">
                  <a href="/bienvenue">{m.onboarding.createOwnSpace}</a>
                </Button>
              }
            >
              {t.ownSpaceDetail}
            </SettingRow>
          </Rows>
        </SheetSection>
      )}
      <SheetSection id="compte" title={t.account}>
        <Rows>
          <SettingRow action={<DeleteAccount detail={m.settings.deleteDetail} />}>{t.deleteDetail}</SettingRow>
        </Rows>
      </SheetSection>
    </Sheet>
  );
}
