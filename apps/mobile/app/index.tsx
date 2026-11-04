import { ageStatus } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect } from "expo-router";
import { View } from "react-native";
import { useMe } from "../src/lib/queries";
import { useSession } from "../src/lib/session-store";
import { homeFor, pickSpace, useSpaceStore } from "../src/lib/space-store";
import { usePendingInvite } from "../src/lib/pending-invite";
import { Button, T } from "../src/ui/primitives";
import { ErrorState, LoadingState } from "../src/ui/states";
import { GUTTER, scene, space } from "../src/ui/theme";

// Aiguillage unique : session, invitation en attente, espaces. Le rôle découle des espaces.
export default function Gate() {
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const me = useMe(status === "signed-in");
  const activeOrgId = useSpaceStore((s) => s.activeOrgId);
  const pendingToken = usePendingInvite((s) => s.token);

  if (status === "signed-out") return <Redirect href="/sign-in" />;
  if (pendingToken) return <Redirect href={`/i/${pendingToken}`} />;
  const shell = { flex: 1, backgroundColor: scene.page, justifyContent: "center" as const, padding: GUTTER };
  if (me.isPending) {
    return (
      <View style={shell}>
        <LoadingState />
      </View>
    );
  }
  if (!me.data) {
    return (
      <View style={shell}>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </View>
    );
  }
  const age = ageStatus(me.data.birthDate ?? null, new Date());
  if (age === "minor") return <Redirect href="/age" />;
  if (me.data.spaces.length === 0) return <Redirect href="/onboarding" />;
  // Le serveur refuse tout accès sans date : autant la demander tout de suite.
  if (age === "unknown") return <Redirect href="/age" />;
  const space_ = pickSpace(me.data.spaces, activeOrgId);
  const home = space_ ? homeFor(space_) : null;
  if (home) return <Redirect href={home} />;
  return (
    <View style={[shell, { gap: space.lg }]}>
      <T>{m.mobile.errors.noSpace}</T>
      <Button label={m.common.signOut} variant="secondary" onPress={() => void signOut()} />
    </View>
  );
}
