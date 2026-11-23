import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { HistoryShareForm } from "@/features/history-share/history-share-form";
import { requireSpace } from "@/features/shell/space";
import { historyShareScreen } from "@/server/history-share.service";

export const metadata: Metadata = { title: w.personal.share.metaTitle };

// Juste après l'arrivée dans le groupe d'un coach, pour un athlète qui a son espace personnel : facultatif. Il revient
// ici tant qu'il ne partage rien ; ses partages se règlent ensuite dans Réglages, Confidentialité.
export default async function ShareHistoryPage() {
  const { actor, organizationId, personal } = await requireSpace();
  const screen = personal ? null : await historyShareScreen(actor.userId, organizationId);
  if (!screen) redirect("/accueil");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={w.personal.share.title(screen.coach)} detail={w.personal.share.lead} />
      <section className="on-card rounded-card bg-card p-5">
        <HistoryShareForm organizationId={organizationId} />
      </section>
    </div>
  );
}
