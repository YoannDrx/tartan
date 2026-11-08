import { m } from "@tartan/i18n";
import { requireSpace } from "@/features/shell/space";
import { LogQueueReview } from "@/features/offline/log-queue-review";

export default async function SynchronisationPage() {
  const { organizationId, actor } = await requireSpace();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="t-h2">{m.syncReview.title}</h1>
      <p>{m.syncReview.lead}</p>
      <LogQueueReview key={`${actor.userId}:${organizationId}`} organizationId={organizationId} userId={actor.userId} />
    </div>
  );
}
