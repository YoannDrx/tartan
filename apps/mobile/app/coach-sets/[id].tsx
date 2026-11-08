import { useQuery } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { useLocalSearchParams } from "expo-router";
import { PerformedSetsEditor } from "../../src/features/performed-sets-editor";
import { api } from "../../src/lib/api";
import { useActiveSpace } from "../../src/lib/queries";
import { T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { LoadingState, ErrorState } from "../../src/ui/states";
import { deniesCachedAccess } from "../../src/lib/errors";

export default function CoachSets() {
  const { id, athleteId } = useLocalSearchParams<{ id: string; athleteId: string }>();
  const { me, orgId, space: active } = useActiveSpace();
  const detail = useQuery({
    queryKey: ["coach-athlete-log", orgId, id, athleteId],
    queryFn: () => api.athleteSessionForCoach(orgId, id, athleteId),
    enabled: Boolean(orgId && id && athleteId),
  });
  const denied = deniesCachedAccess(detail.error) || deniesCachedAccess(me.error);
  return (
    <StackScreen
      world="work"
      title={m.progression.coachSetsTitle}
      subtitle={denied ? undefined : detail.data?.athlete?.name}
    >
      {denied ? (
        <ErrorState
          error={detail.error ?? me.error}
          onRetry={() => {
            void me.refetch();
            void detail.refetch();
          }}
        />
      ) : !id || !athleteId ? (
        <T>{m.common.notFound}</T>
      ) : detail.isPending || !me.data ? (
        <LoadingState />
      ) : !detail.data ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : !detail.data.progressionEnabled || !active?.progressionEnabled ? (
        <T>{m.progression.disabled}</T>
      ) : !detail.data.canRecordSets ? (
        <T>{m.syncReview.reason.access}</T>
      ) : (
        <>
          <T variant="title2">{detail.data.title}</T>
          <PerformedSetsEditor
            key={`${orgId}.${id}.${athleteId}.${me.data.id}`}
            session={detail.data}
            orgId={orgId}
            userId={me.data.id}
            athleteId={athleteId}
          />
        </>
      )}
    </StackScreen>
  );
}
