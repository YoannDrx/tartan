import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/states";
import {
  AdminsPanel,
  BackupPasskey,
  ReconcileVideos,
  SettingsForm,
  TestEmails,
} from "@/features/admin/configuration";
import { AdminNav, DataTable } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { platformSettings } from "@/server/platform-settings.service";
import { emailSampleKeys, listPlatformAdmins, productionStatus } from "@/server/production-status.service";

const t = m.admin.config;

const Panel = ({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) => (
  <section className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
    <div>
      <h2 className="t-section">{title}</h2>
      {lead ? <p className="mt-1 text-soft">{lead}</p> : null}
    </div>
    {children}
  </section>
);

export default async function AdminConfigurationPage() {
  const { actor } = await requireSpace();
  const [status, settings, admins] = await Promise.all([
    productionStatus(actor),
    platformSettings(),
    listPlatformAdmins(actor),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.configuration} detail={t.lead} />
      <AdminNav current="/admin/configuration" />
      <DataTable
        caption={t.servicesTitle}
        columns={[t.service, t.state, t.detail]}
        rows={status.checks.map((check) => [
          t.checks[check.key as keyof typeof t.checks],
          t.states[check.state],
          check.detail ?? "–",
        ])}
      />
      <Panel title={t.linksTitle} lead={t.linksLead}>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {t.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={t.settingsTitle} lead={t.settingsLead}>
        <SettingsForm settings={settings} />
      </Panel>
      <Panel title={t.adminsTitle}>
        <AdminsPanel {...admins} />
      </Panel>
      <Panel title={t.backupTitle} lead={t.backupLead}>
        <div>
          <BackupPasskey />
        </div>
      </Panel>
      <Panel title={t.testTitle} lead={t.testLead}>
        <TestEmails keys={emailSampleKeys()} defaultTo={actor.email} />
      </Panel>
      <Panel title={t.reconcileTitle} lead={t.reconcileLead}>
        <div>
          <ReconcileVideos />
        </div>
      </Panel>
    </div>
  );
}
