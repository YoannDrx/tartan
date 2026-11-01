import type { Metadata } from "next";
import { formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { Chip, EmptyState, PageHeader } from "@/components/states";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.nav.progres} />
      {file.goals ? (
        <section className="flex flex-col gap-1">
          <h2 className="t-section">{m.athletes.goals}</h2>
          <p className="whitespace-pre-line">{file.goals}</p>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="t-h2">{m.athletes.records}</h2>
        {file.performances.length === 0 ? (
          <EmptyState>Tes records apparaîtront ici dès que ton coach les aura notés.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-block border border-border bg-surface px-3">
            {file.performances.map((p) => (
              <li
                key={`${p.discipline}-${p.date}-${p.mark}`}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span>
                  {p.discipline} <span className="t-caption font-normal text-muted">{date(p.date)}</span>{" "}
                  {p.isPb ? <Chip tone="brand">Record</Chip> : null}
                </span>
                <span className="t-num text-[22px]">
                  {String(p.mark).replace(".", ",")} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {file.tests.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-h2">{m.athletes.tests}</h2>
          <ul className="divide-y divide-border rounded-block border border-border bg-surface px-3">
            {file.tests.map((t) => (
              <li key={`${t.exerciseKey}-${t.date}`} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {strengthTestLabel(t.exerciseKey)}{" "}
                  <span className="t-caption font-normal text-muted">
                    {m.testKind[t.kind]}, {date(t.date)}
                  </span>
                </span>
                <span className="t-num text-[22px]">{String(t.value).replace(".", ",")} kg</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {file.healthVisible ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="t-h2">{m.athletes.injuries}</h2>
            <InjuryDialog
              athleteId={file.id}
              trigger={
                <Button size="sm" variant="secondary">
                  {m.common.add}
                </Button>
              }
            />
          </div>
          {file.injuries.length === 0 ? <p className="text-muted">Aucune blessure enregistrée.</p> : null}
          {file.injuries.length > 0 ? (
            <ul className="divide-y divide-border rounded-block border border-border bg-surface px-3">
              {file.injuries.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {m.bodyArea[i.bodyArea as keyof typeof m.bodyArea]}{" "}
                      <Chip tone={i.status === "resolved" ? "neutral" : "warning"}>{m.injuryStatus[i.status]}</Chip>
                    </p>
                    {i.restrictions ? <p>{i.restrictions}</p> : null}
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
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
