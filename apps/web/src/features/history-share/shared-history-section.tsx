import type { SharedHistory } from "@tartan/contracts";
import { formatDayMonth, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Chip } from "@/components/states";

const t = w.personal.share;
const day = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;
const mark = (value: number) => String(value).replace(".", ",");

// Sur la fiche de l'athlète, côté coach : ce qu'il a fait seul, dans son espace personnel, s'il le partage. Lecture
// seule, cases choisies par l'athlète ; ni effort ressenti, ni douleur, ni blessure.
export const SharedHistorySection = ({ history }: { history: NonNullable<SharedHistory> }) => (
  <section id="historique-partage" aria-labelledby="historique-partage-titre" className="flex scroll-mt-24 flex-col gap-2">
    <h2 id="historique-partage-titre" className="t-section">
      {t.coachTitle}
    </h2>
    <p className="max-w-prose">{t.coachLead(day(history.grantedAt.slice(0, 10)))}</p>
    <Sheet className="divide-y divide-card-line">
      {history.records ? (
        <SheetSection title={t.coachScopes.records}>
          {history.records.length === 0 ? <p className="text-soft">{t.coachEmpty}</p> : null}
          <Rows>
            {history.records.map((record, index) => (
              <li key={`${record.discipline}-${record.date}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {record.discipline}
                    {record.isPb ? <Chip tone="brand">{m.athletes.record}</Chip> : null}
                  </span>
                  <span className="t-caption block font-normal text-soft">{day(record.date)}</span>
                </span>
                <Mark>
                  {mark(record.mark)} {record.unit}
                </Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
      ) : null}
      {history.strength ? (
        <SheetSection title={t.coachScopes.strength}>
          {history.strength.length === 0 ? <p className="text-soft">{t.coachEmpty}</p> : null}
          <Rows>
            {history.strength.map((test, index) => (
              <li key={`${test.exercise}-${test.date}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="block font-semibold">{test.exercise}</span>
                  <span className="t-caption block font-normal text-soft">
                    {(m.testKind as Record<string, string>)[test.kind] ?? test.kind}, {day(test.date)}
                  </span>
                </span>
                <Mark>
                  {mark(test.value)} {test.unit}
                </Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
      ) : null}
      {history.sessions ? (
        <SheetSection title={t.coachScopes.sessions}>
          {history.sessions.length === 0 ? <p className="text-soft">{t.coachEmpty}</p> : null}
          <Rows>
            {history.sessions.map((session, index) => (
              <li key={`${session.date}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="block break-words font-semibold">{session.title}</span>
                  <span className="t-caption block font-normal text-soft">{day(session.date)}</span>
                </span>
                <span className="t-caption shrink-0">{t.status[session.status] ?? session.status}</span>
              </li>
            ))}
          </Rows>
        </SheetSection>
      ) : null}
    </Sheet>
  </section>
);
