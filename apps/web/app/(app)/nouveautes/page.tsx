import { formatDateLong, capitalize, m } from "@tartan/i18n";
import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { listReleases, markReleaseSeen } from "@/server/releases.service";

export const metadata: Metadata = { title: m.releases.title };

export default async function NouveautesPage() {
  const { actor, staff } = await requireSpace();
  const releases = listReleases(staff ? "coach" : "athlete");
  const latest = releases[0];
  if (latest) await markReleaseSeen(actor.userId, latest.id);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={m.releases.title} />
      {releases.length === 0 ? <p className="on-card rounded-card bg-card p-4 text-soft">{m.releases.empty}</p> : null}
      {releases.map((release) => (
        <section key={release.id} className="on-card flex flex-col gap-2 rounded-card bg-card p-4">
          <h2 className="t-h2">{release.title}</h2>
          <p className="t-caption font-normal text-soft">{capitalize(formatDateLong(release.date))}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {release.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
