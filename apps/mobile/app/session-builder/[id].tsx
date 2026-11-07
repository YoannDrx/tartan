import { ApiError } from "@tartan/api-client";
import { builderDraftKey } from "../../src/features/builder/draft-storage";
import { builderDraftStore } from "../../src/features/builder/draft-store";
import { useIsOnline } from "../../src/lib/network";
import { useQuery } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { Redirect, useLocalSearchParams } from "expo-router";
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
  const online = useIsOnline();
  const storageKey = builderDraftKey(userId, orgId, id);
  // Une nouvelle visite doit relire le stockage avant de monter l'éditeur.
  // Le cache d'une visite précédente initialiserait sinon son formulaire une fois pour toutes.
  const [visitId] = useState(randomUUID);
  const [revision, setRevision] = useState(0);
  const data = useQuery({
    queryKey: ["native-session-builder", orgId, userId, id, visitId, revision],
    queryFn: async () => {
      const stored = await builderDraftStore.read(storageKey);
      if (!online && stored)
        return { stored, context: stored.value.context, initial: stored.value.base, verified: false };
      const editId = id === "new" ? stored?.value.form.id : id;
      try {
        const [context, initial] = await Promise.all([
          api.sessionBuilder(orgId),
          editId ? api.editSession(orgId, editId) : null,
        ]);
        return { context, initial, stored, verified: true };
      } catch (error) {
        if (stored && error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          await builderDraftStore.remove(storageKey, stored.revision);
        }
        if (!stored || (error instanceof ApiError && error.status < 500)) throw error;
        return { stored, context: stored.value.context, initial: stored.value.base, verified: false };
      }
    },
    networkMode: "always",
    retry: false,
    staleTime: 0,
    gcTime: 0,
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
      storageKey={storageKey}
      stored={data.data.stored}
      verified={data.data.verified}
      initial={data.data.initial}
      context={data.data.context}
      date={date ?? localIsoDate()}
      groupId={data.data.context.groups.some((g) => g.id === groupId) ? groupId : undefined}
      onReload={() => setRevision((r) => r + 1)}
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
