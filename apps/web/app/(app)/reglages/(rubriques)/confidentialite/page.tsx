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
import { listMyHistoryShares } from "@/server/history-share.service";
import { HistorySharesSettings } from "@/features/history-share/history-shares-settings";
import { athleteConsentState, consentForAthletes, getUserConsents } from "@/server/consent.service";

export const metadata: Metadata = { title: w.settings.rubrics.confidentialite.title };

// Les accords de l'athlète : ceux de sa fiche dans cet espace, et l'accord parental encore attendu.
const athleteConsents = async (userId: string, athleteId: string | null) => {
  if (!athleteId) return { ...(await getUserConsents(userId)), parentalPending: false };
  const [state, effective] = await Promise.all([athleteConsentState(athleteId), consentForAthletes([athleteId])]);
  return { ...state, parentalPending: effective.get(athleteId)?.parentalPending ?? false };
};

export default async function ConfidentialitePage() {
  const { actor, organizationId, space, spaces, access } = await requireRubric("confidentialite");
  const owner = access.role === "owner";
  const notebook = spaces.find(
    (s) => s.kind === "personal" && s.organizationId !== organizationId && access.role === "athlete",
  );
  const [consents, blockedUsers, shares, notebookConsents] = await Promise.all([
    access.role === "athlete" ? athleteConsents(actor.userId, access.athleteId) : null,
    listBlockedUsers(actor.userId),
    listMyHistoryShares(actor.userId),
    notebook?.athleteId ? athleteConsents(actor.userId, notebook.athleteId) : null,
  ]);
  const t = w.settings.confidentialite;
  return (
    <Sheet className="divide-y divide-card-line">
      {consents ? (
        <SheetSection id="confidentialite" title={t.consents}>
          <ConsentSwitches
            organizationId={organizationId}
            health={consents.health}
            video={consents.video}
            parentalPending={consents.parentalPending}
          />
        </SheetSection>
      ) : null}
      {notebook && notebookConsents && (
        <SheetSection id="accords-carnet" title={m.brand.notebook}>
          <ConsentSwitches organizationId={notebook.organizationId} {...notebookConsents} />
        </SheetSection>
      )}
      {/* Les partages de son historique personnel avec un coach : visibles d'où qu'il soit, retirés d'un geste. */}
      {shares.length > 0 || spaces.some((entry) => entry.kind === "personal") ? (
        <SheetSection id="historique-partage" title={w.personal.share.settingsTitle}>
          <HistorySharesSettings shares={shares} />
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
      {/* Son espace personnel ne se quitte pas : il part avec le compte. */}
      {owner || space.kind === "personal" ? null : (
        <SheetSection id="espaces" title={t.spaces}>
          <Rows>
            <SettingRow action={<LeaveSpace name={space.organizationName} />}>
              {t.leaveDetail(space.organizationName)}
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
