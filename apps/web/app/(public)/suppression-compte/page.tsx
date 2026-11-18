import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { LegalPage } from "@/features/shell/legal-page";
import { rubricPath } from "@/features/settings/sections";

const t = w.legal.accountDeletion;
const CONTACT = "hello@tartan.coach";

export const metadata: Metadata = { title: t.title, description: t.description };

// Adresse à déclarer sur Google Play : la suppression doit être possible sans installer l'application.
export default function SuppressionComptePage() {
  return (
    <LegalPage title={t.title} updated={t.updated}>
      <h2>{t.fromApp}</h2>
      <p>
        {t.fromAppBefore}
        <a href={`https://app.tartan.coach${rubricPath("confidentialite")}#compte`}>{t.fromAppLink}</a>
        {t.fromAppAfter}
      </p>
      <h2>{t.withoutAccess}</h2>
      <p>
        {t.withoutAccessBefore}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        {t.withoutAccessAfter}
      </p>
      <h2>{t.deleted}</h2>
      <p>{t.deletedDetail}</p>
      <h2>{t.kept}</h2>
      <p>{t.keptDetail}</p>
    </LegalPage>
  );
}
