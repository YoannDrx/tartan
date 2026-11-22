import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { LegalPage } from "@/features/shell/legal-page";

const t = w.legal.notice;

export const metadata: Metadata = { title: t.title };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title={t.title} updated={t.updated}>
      <h2>{t.publisher}</h2>
      <p>{t.publisherIdentity}</p>
      <p>{t.publisherContact}</p>
      <h2>{t.hosting}</h2>
      <p>{t.hostingApp}</p>
      <p>{t.hostingDatabase}</p>
      <p>{t.hostingVideos}</p>
      <p>{t.hostingPlanner}</p>
      <h2>{t.property}</h2>
      <p>{t.propertyDetail}</p>
    </LegalPage>
  );
}
