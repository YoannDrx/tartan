import { useQuery } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { NativeSessionBuilder } from "../../src/features/builder/editor";
import { api } from "../../src/lib/api";
import { localIsoDate } from "../../src/lib/dates";
import { useActiveSpace } from "../../src/lib/queries";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";

const BuilderLoader = ({
  orgId,
  userId,
  id,
  date,
  groupId,
}: {
  orgId: string;
  userId: string;
  id: string;
  date?: string;
  groupId?: string;
}) => {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const data = useQuery({
    queryKey: ["native-session-builder", orgId, userId, id, revision],
    queryFn: async () => {
      const [context, initial] = await Promise.all([
        api.sessionBuilder(orgId),
        id === "new" ? null : api.editSession(orgId, id),
      ]);
      return { context, initial };
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (!data.data)
    return (
      <StackScreen title={m.builder.title}>
        {data.isPending ? <LoadingState /> : <ErrorState error={data.error} onRetry={() => void data.refetch()} />}
      </StackScreen>
    );
  return (
    <NativeSessionBuilder
      key={revision}
      orgId={orgId}
      initial={data.data.initial}
      context={data.data.context}
      date={date ?? localIsoDate()}
      groupId={data.data.context.groups.some((g) => g.id === groupId) ? groupId : undefined}
      onReload={(savedId) => {
        if (savedId && savedId !== id) router.replace({ pathname: "/session-builder/[id]", params: { id: savedId } });
        else setRevision((r) => r + 1);
      }}
    />
  );
};

export default function SessionBuilderScreen() {
  const { id, date, groupId } = useLocalSearchParams<{ id: string; date?: string; groupId?: string }>();
  const { me, orgId, space } = useActiveSpace();
  if (!me.data)
    return (
      <StackScreen>
        <LoadingState />
      </StackScreen>
    );
  if (!orgId || !space || space.role === "athlete") return <Redirect href="/" />;
  return (
    <BuilderLoader
      key={`${me.data.id}:${orgId}:${id}`}
      userId={me.data.id}
      orgId={orgId}
      id={id}
      date={date}
      groupId={groupId}
    />
  );
}
