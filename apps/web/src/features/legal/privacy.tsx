import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { LegalPage } from "@/features/shell/legal-page";

const t = w.legal.privacy;

export const PrivacyContent = ({ embedded = false }: { embedded?: boolean }) => (
  <LegalPage title={t.title} updated={t.updated} embedded={embedded}>
    <p>{t.controller}</p>
    <p>{t.adultsOnly}</p>
    <h2>{t.processing}</h2>
    <ul>
      {t.processingItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
      <li>{m.aiPlanner.privacyUse}</li>
    </ul>
    <h2>{t.coachRecord}</h2>
    <p>{t.coachRecordDetail}</p>
    <h2>{t.withdrawal}</h2>
    <p>{t.withdrawalDetail}</p>
    <h2>{t.location}</h2>
    <p>{t.locationDetail}</p>
    <h2>{t.retention}</h2>
    <p>{t.retentionDetail}</p>
    <ul>
      {t.retentionAccounts.map((item) => (
        <li key={item}>{item}</li>
      ))}
      <li>{m.aiPlanner.privacyRetention}</li>
      {t.retentionRecords.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
    <h2>{t.rights}</h2>
    <p>{t.rightsDetail}</p>
  </LegalPage>
);
