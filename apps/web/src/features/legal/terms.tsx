import { m } from "@tartan/i18n";
import { LegalPage } from "@/features/shell/legal-page";

const t = m.legal.termsPage;

export const TermsContent = ({ embedded = false }: { embedded?: boolean }) => (
  <LegalPage title={t.title} updated={t.updated} embedded={embedded}>
    <p>{t.publisher}</p>
    {t.sections.map((section) => (
      <section key={section.title} className="flex flex-col gap-4">
        <h2>{section.title}</h2>
        <p>{section.body}</p>
      </section>
    ))}
  </LegalPage>
);
