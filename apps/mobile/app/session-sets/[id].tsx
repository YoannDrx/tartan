import { m } from "@tartan/i18n";
import { useLocalSearchParams } from "expo-router";
import { PerformedSetsEditor } from "../../src/features/performed-sets-editor";
import { useActiveSpace, useSessionDetail } from "../../src/lib/queries";
import { T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { LoadingState, ErrorState } from "../../src/ui/states";

export default function SessionSets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, orgId } = useActiveSpace();
  const detail = useSessionDetail(orgId, id);
  return (
    <StackScreen dark title={m.progression.setsTitle} subtitle={detail.data?.title}>
      {detail.isPending || !me.data ? (
        <LoadingState />
      ) : !detail.data ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : detail.data.progressionEnabled ? (
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
