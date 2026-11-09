import { m } from "@tartan/i18n";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/states";
import { PasskeyGate } from "@/features/admin/console-actions";
import { requireSpace } from "@/features/shell/space";
import { isAdmin } from "@/server/admin.service";
import { adminHasPasskey } from "@/server/admin-step-up.service";

export const metadata: Metadata = { title: m.admin.verifyTitle, robots: { index: false } };

export default async function AdminVerificationPage() {
  const { actor } = await requireSpace();
  if (!isAdmin(actor.email)) redirect("/accueil");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title={m.admin.verifyTitle} detail={m.admin.verifyLead} />
      <div className="on-card rounded-card bg-card p-4">
        <PasskeyGate hasPasskey={await adminHasPasskey(actor.userId)} next="/admin" />
      </div>
    </div>
  );
}
