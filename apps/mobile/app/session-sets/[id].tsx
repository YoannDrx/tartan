import { m } from "@tartan/i18n";
import { useLocalSearchParams } from "expo-router";
import { PerformedSetsEditor } from "../../src/features/performed-sets-editor";
import { useActiveSpace, useSessionDetail } from "../../src/lib/queries";
import { T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { LoadingState, ErrorState } from "../../src/ui/states";
import { deniesCachedAccess } from "../../src/lib/errors";

export default function SessionSets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, orgId, space: active } = useActiveSpace();
  const detail = useSessionDetail(orgId, id);
  const denied = deniesCachedAccess(detail.error) || deniesCachedAccess(me.error);
  return (
    <StackScreen world="work" title={m.progression.setsTitle} subtitle={denied ? undefined : detail.data?.title}>
      {denied ? (
        <ErrorState
          error={detail.error ?? me.error}
          onRetry={() => {
            void me.refetch();
            void detail.refetch();
          }}
        />
      ) : detail.isPending || !me.data ? (
        <LoadingState />
      ) : !detail.data ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : detail.data.progressionEnabled && active?.progressionEnabled ? (
        <PerformedSetsEditor
          key={`${orgId}.${id}.${me.data.id}`}
          session={detail.data}
          orgId={orgId}
          userId={me.data.id}
        />
      ) : (
        <T>{m.progression.disabled}</T>
      )}
    </StackScreen>
  );
}
