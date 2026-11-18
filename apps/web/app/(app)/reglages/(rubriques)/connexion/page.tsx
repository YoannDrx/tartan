import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { RevokeOtherSessionsButton, SignOutButton } from "@/features/settings/connexion/sessions";
import { requireRubric } from "@/features/settings/rubric-access";

export const metadata: Metadata = { title: w.settings.rubrics.connexion.title };

export default async function ConnexionPage() {
  const { actor } = await requireRubric("connexion");
  const t = w.settings.connexion;
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection id="appareils" title={t.devices}>
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose">{t.devicesDetail}</p>
          <RevokeOtherSessionsButton />
        </div>
      </SheetSection>
      <SheetSection id="deconnexion" title={t.here}>
        <div className="flex flex-col items-start gap-3">
          <p className="break-words">{t.hereDetail(actor.email)}</p>
          <SignOutButton />
        </div>
      </SheetSection>
    </Sheet>
  );
}
