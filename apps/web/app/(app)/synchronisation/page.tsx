import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { LogQueueReview } from "@/features/offline/log-queue-review";

export default async function SynchronisationPage() {
  const { organizationId, actor } = await requireSpace();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={m.syncReview.title} detail={m.syncReview.lead} />
      <LogQueueReview key={`${actor.userId}:${organizationId}`} organizationId={organizationId} userId={actor.userId} />
    </div>
  );
}
