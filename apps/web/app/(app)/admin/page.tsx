import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminReports } from "@/features/admin/admin-reports";
import { BirthDateCorrection, DisableAiEverywhere, RetryEmail, SpaceFeaturesForm } from "@/features/admin/operations";
import { adminOverview, isAdmin } from "@/server/admin.service";
import { listAllReports } from "@/server/comm.service";

export const metadata: Metadata = { title: m.admin.title, robots: { index: false } };

const pct = (value: number | null) => (value === null ? "–" : `${value} %`);

// Chaque case s'étire : un total impair ne laisse pas de trou dans la feuille.
const Totals = ({ items }: { items: { label: string; value: number | string }[] }) => (
  <dl className="flex flex-wrap gap-px bg-card-line">
    {items.map((item) => (
      <div key={item.label} className="min-w-[calc(50%-1px)] flex-1 bg-card px-4 py-2 tablet:min-w-[calc(25%-1px)]">
        <dt className="t-caption font-normal text-soft">{item.label}</dt>
        <dd className="t-num text-[24px]">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export default async function AdminPage() {
  const { actor } = await requireSpace();
  if (!isAdmin(actor.email)) redirect("/accueil");
  const [data, reports] = await Promise.all([adminOverview(actor), listAllReports(actor)]);
  const totals = [
    { label: m.admin.spaces, value: data.spaces.length },
    { label: m.admin.users, value: data.users },
    ...Object.entries(data.plans).map(([plan, count]) => ({
      label: m.billing.plans[plan as keyof typeof m.billing.plans],
      value: count,
    })),
    { label: m.admin.recommend, value: `${data.satisfaction.yes} / ${data.satisfaction.yes + data.satisfaction.no}` },
  ];
  const operations = [
    { label: m.admin.notificationsPending, value: data.notificationDelivery.pending },
    { label: m.admin.notificationsLate, value: data.notificationDelivery.late },
    { label: m.admin.notificationsFailed, value: data.notificationDelivery.failedLast24h },
    { label: m.admin.notificationsUndelivered, value: data.notificationDelivery.undeliveredLast24h },
    { label: m.admin.deletionsFailed, value: data.externalDeletions.failed },
    { label: m.admin.deletionsLate, value: data.externalDeletions.overdue },
    { label: m.admin.billingCommands, value: data.billingCommands },
    { label: m.admin.checkoutReviews, value: data.checkoutReviews },
    { label: m.admin.failedEmails, value: data.failedEmailCount },
    { label: m.admin.retentionReviews, value: data.retentionReviews.length },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.title} detail={m.admin.lead} />
      <Sheet>
        <Totals items={totals} />
      </Sheet>
      <Sheet>
        <SheetSection title={m.admin.featuresTitle}>
          <p className="text-soft">{m.admin.featuresLead}</p>
          <p role="status">{data.aiServerEnabled ? m.admin.aiServerOn : m.admin.aiServerOff}</p>
          <div className="divide-y divide-card-line">
            {data.spaces.map((space) => (
              <SpaceFeaturesForm
                key={space.id}
                organizationId={space.id}
                name={space.name}
                discovery={space.plan === "discovery"}
                features={{
                  progressionEnabled: space.progressionEnabled,
                  phasesEnabled: space.phasesEnabled,
                  aiPlannerEnabled: space.aiPlannerEnabled,
                }}
              />
            ))}
          </div>
          <div className="mt-3">
            <DisableAiEverywhere />
          </div>
        </SheetSection>
      </Sheet>
      <Sheet>
        <div id="signalements" className="scroll-mt-20">
          <SheetSection title={m.admin.reportsTitle}>
            <AdminReports reports={reports} />
          </SheetSection>
        </div>
      </Sheet>
      <Sheet>
        <SheetSection title={m.admin.operations} flush>
          <Totals items={operations} />
        </SheetSection>
      </Sheet>
      <Sheet>
        <SheetSection title={m.admin.billingIssues}>
          <p className="text-soft">{m.admin.billingProcedure}</p>
          <ul className="divide-y divide-card-line">
            {data.billingIssues.map((issue) => (
              <li key={issue.id} className="py-2">
                {issue.name} · {issue.id} · {issue.billingIssue}
              </li>
            ))}
          </ul>
        </SheetSection>
        <SheetSection title={m.admin.failedEmails}>
          <ul className="divide-y divide-card-line">
            {data.failedEmails.map((email) => (
              <li key={email.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="break-all">
                  {email.kind} · {email.failureCode} · {email.id}
                </span>
                <RetryEmail id={email.id} />
              </li>
            ))}
          </ul>
        </SheetSection>
        <SheetSection title={m.admin.checkoutReviews}>
          <ul>
            {data.checkoutReviewItems.map((item) => (
              <li key={item.id} className="break-all py-2">
                {item.organizationId} · {item.id} · v{item.generation} · {item.sessionId ?? "–"}
              </li>
            ))}
          </ul>
        </SheetSection>
        <SheetSection title={m.admin.billingCommands}>
          <ul>
            {data.pendingBillingCommands.map((item) => (
              <li key={item.id} className="break-all py-2">
                {item.organizationId} · {item.kind} · {item.externalRef} · {item.attempts} · {item.lastErrorCode ?? "–"}
              </li>
            ))}
          </ul>
        </SheetSection>
        <SheetSection title={m.admin.correctionTitle}>
          <BirthDateCorrection />
        </SheetSection>
        <SheetSection title={m.admin.retentionReviews}>
          <p className="text-soft">{m.admin.retentionProcedure}</p>
          <ul>
            {data.retentionReviews.map((space) => (
              <li key={space.id} className="py-2">
                {space.name} · {space.id} · {space.retentionReviewAt?.toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
        </SheetSection>
      </Sheet>
      <Sheet>
        <SheetSection title={m.admin.spaces} flush>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={m.admin.spaces}>
            <table className="w-full min-w-[840px] text-left">
              <thead>
                <tr>
                  {[
                    m.admin.space,
                    m.admin.plan,
                    m.admin.athletes,
                    m.admin.sessionsWeek,
                    m.admin.validation,
                    m.admin.delay,
                    m.admin.active,
                    m.admin.activation,
                    m.admin.videos,
                    m.admin.reports,
                  ].map((label) => (
                    <th key={label} scope="col" className="t-col px-3 py-2 first:pl-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-line">
                {data.spaces.map((space) => (
                  <tr key={space.id}>
                    <th scope="row" className="px-3 py-2 pl-4 text-left font-semibold">
                      {space.name}
                      <span className="t-caption block font-normal text-soft">{space.ownerEmail}</span>
                    </th>
                    <td className="px-3 py-2">{m.billing.plans[space.plan]}</td>
                    <td className="t-num px-3 py-2">{space.athletes}</td>
                    <td className="t-num px-3 py-2">{space.sessionsThisWeek}</td>
                    <td className="t-num px-3 py-2">{pct(space.metrics.validationRatePct)}</td>
                    <td className="t-num px-3 py-2">
                      {space.metrics.medianValidationHours === null
                        ? "–"
                        : `${Math.round(space.metrics.medianValidationHours)} h`}
                    </td>
                    <td className="t-num px-3 py-2">{pct(space.metrics.activeAthletesPct)}</td>
                    <td className="t-num px-3 py-2">{pct(space.metrics.activationPct)}</td>
                    <td className="t-num px-3 py-2">{space.metrics.sharedVideosLast7Days}</td>
                    <td className="t-num px-3 py-2">{space.openReports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetSection>
      </Sheet>
      {data.satisfaction.comments.length > 0 ? (
        <Sheet>
          <SheetSection title={m.admin.comments}>
            <ul className="divide-y divide-card-line">
              {data.satisfaction.comments.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-semibold">{c.recommend ? m.satisfaction.yes : m.satisfaction.no} : </span>
                  {c.comment}
                </li>
              ))}
            </ul>
          </SheetSection>
        </Sheet>
      ) : null}
    </div>
  );
}
