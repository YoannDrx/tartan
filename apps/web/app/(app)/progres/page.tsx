import type { Metadata } from "next";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Chip, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { InjuryDialog } from "@/features/athletes/athlete-forms";
import { requireAthleteSpace } from "@/features/shell/space";
import { getMyFile } from "@/server/athlete.service";

export const metadata: Metadata = { title: m.nav.progres };

const date = (iso: string) => `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;

// Vue simple en V1 : records et tests. Les courbes et les volumes arrivent en V2 (§ 7.7).
export default async function ProgresPage() {
  const { actor, organizationId } = await requireAthleteSpace();
  const file = await getMyFile(actor.userId, organizationId);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={m.nav.progres} />
      {file.goals ? (
        <section className="flex flex-col gap-1">
          <h2 className="t-section">{m.athletes.goals}</h2>
          <p className="whitespace-pre-line break-words">{file.goals}</p>
        </section>
      ) : null}
      <Sheet className="divide-y divide-card-line">
        <SheetSection title={m.athletes.records}>
          {file.performances.length === 0 ? (
            <p className="text-soft">Tes records apparaîtront ici dès que ton coach les aura notés.</p>
          ) : null}
          <Rows>
            {file.performances.map((p) => (
              <li key={`${p.discipline}-${p.date}-${p.mark}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                    {p.discipline}
                    {p.isPb ? <Chip tone="brand">{m.athletes.record}</Chip> : null}
                  </span>
                  <span className="t-caption block font-normal text-soft">{date(p.date)}</span>
                </span>
                <Mark>
                  {String(p.mark).replace(".", ",")} {p.unit}
                </Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
        <SheetSection title={m.athletes.tests}>
          {file.tests.length === 0 ? (
            <p className="text-soft">Tes tests de force apparaîtront ici dès que ton coach les aura notés.</p>
          ) : null}
          <Rows>
            {file.tests.map((t) => (
              <li key={`${t.exerciseKey}-${t.date}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 leading-snug">
                  <span className="block font-semibold">{strengthTestLabel(t.exerciseKey)}</span>
                  <span className="t-caption block font-normal text-soft">
                    {m.testKind[t.kind]}, {date(t.date)}
                  </span>
                </span>
                <Mark>{String(t.value).replace(".", ",")} kg</Mark>
              </li>
            ))}
          </Rows>
        </SheetSection>
        {file.healthVisible ? (
          <SheetSection
            title={m.athletes.injuries}
            action={
              <InjuryDialog
                athleteId={file.id}
                trigger={
                  <Button size="sm" variant="secondary">
                    {m.common.add}
                  </Button>
                }
              />
            }
          >
            {file.injuries.length === 0 ? <p className="text-soft">{m.athletes.noInjuries}</p> : null}
            <Rows>
              {file.injuries.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1 leading-snug">
                    <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                      {m.bodyArea[i.bodyArea as keyof typeof m.bodyArea]}
                      <Chip tone={i.status === "resolved" ? "neutral" : "warning"}>{m.injuryStatus[i.status]}</Chip>
                    </p>
                    {i.restrictions ? <p className="mt-1">{i.restrictions}</p> : null}
                  </div>
                  <InjuryDialog
                    athleteId={file.id}
                    trigger={
                      <Button size="sm" variant="quiet">
                        {m.common.edit}
                      </Button>
                    }
                    initial={{
                      id: i.id,
                      bodyArea: i.bodyArea as keyof typeof m.bodyArea,
                      side: i.side,
                      description: i.description ?? "",
                      startDate: i.startDate,
                      endDate: i.endDate ?? "",
                      status: i.status,
                      restrictions: i.restrictions ?? "",
                    }}
                  />
                </li>
              ))}
            </Rows>
          </SheetSection>
        ) : null}
      </Sheet>
    </div>
  );
}
