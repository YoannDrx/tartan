import { useMutation } from "@tanstack/react-query";
import type { SignInMethodsResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Alert, View } from "react-native";
import { ChangePasswordForm, ConfirmBeforePassword, DefinePasswordForm } from "../../src/features/password-forms";
import { useSignInMethods } from "../../src/lib/account-queries";
import { authClient } from "../../src/lib/auth-client";
import { useSession } from "../../src/lib/session-store";
import { useOpQueue } from "../../src/lib/sync/op-queue";
import { useOwnUploads } from "../../src/lib/upload/upload-queue";
import { Check } from "../../src/ui/icons";
import { Button, Card, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space, usePalette } from "../../src/ui/theme";

const c = m.account.connexion;

const MethodRow = ({ name, state, on, testID }: { name: string; state: string; on: boolean; testID: string }) => {
  const p = usePalette();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={c.method(name, state)}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 56 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="smallStrong">{name}</T>
        <T variant="caption" tone="muted">
          {state}
        </T>
      </View>
      {on ? <Check size={20} color={p.text} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </View>
  );
};

// Les moyens du compte : le lien marche toujours ; le mot de passe, Google et Apple selon le compte et le serveur.
const Methods = ({ methods }: { methods: SignInMethodsResponse }) => {
  const rows = [
    { key: "link", name: c.link, state: c.linkState, on: true },
    { key: "password", name: c.password, state: methods.password ? c.passwordOn : c.passwordOff, on: methods.password },
    ...(methods.google.available
      ? [
          {
            key: "google",
            name: c.google,
            state: methods.google.linked ? c.linked : c.notLinked,
            on: methods.google.linked,
          },
        ]
      : []),
    ...(methods.apple.available
      ? [
          {
            key: "apple",
            name: c.apple,
            state: methods.apple.linked ? c.linked : c.notLinked,
            on: methods.apple.linked,
          },
        ]
      : []),
  ];
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{c.methods}</SectionTitle>
      <ListSurface>
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <Divider /> : null}
            <MethodRow testID={`sign-in-method-${row.key}`} name={row.name} state={row.state} on={row.on} />
          </View>
        ))}
      </ListSurface>
    </View>
  );
};

const Devices = ({ email }: { email: string }) => {
  const signOut = useSession((s) => s.signOut);
  const pendingOps = useOpQueue((s) => s.items.length);
  const pendingUploads = useOwnUploads().length;
  const [done, setDone] = useState(false);
  const revoke = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error("revoke_failed");
    },
    onSuccess: () => setDone(true),
  });
  const confirmSignOut = () => {
    const pending = pendingOps + pendingUploads;
    if (pending === 0) {
      void signOut();
      return;
    }
    Alert.alert(m.common.signOut, m.mobile.settings.signOutPending(pending), [
      { text: m.common.cancel, style: "cancel" },
      { text: m.common.signOut, style: "destructive", onPress: () => void signOut() },
    ]);
  };
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{c.devices}</SectionTitle>
      <Card>
        <T variant="small">{c.devicesDetail}</T>
        <T variant="caption" tone="muted">
          {c.hereDetail(email)}
        </T>
        <Button
          testID="revoke-other-sessions"
          label={m.settings.revokeOtherSessions}
          variant="secondary"
          loading={revoke.isPending}
          onPress={() => revoke.mutate()}
        />
        <View accessibilityLiveRegion="polite">
          {done ? <T variant="small">{m.settings.revokeOtherSessionsDone}</T> : null}
          {revoke.isError ? (
            <T variant="small" tone="danger">
              {m.common.genericError}
            </T>
          ) : null}
        </View>
        <Button testID="connexion-sign-out" label={m.common.signOut} variant="secondary" onPress={confirmSignOut} />
      </Card>
    </View>
  );
};

export default function SignInSettings() {
  const methods = useSignInMethods();
  return (
    <StackScreen title={m.account.settings.rubrics.connexion.title}>
      {methods.data ? (
        <>
          <Methods methods={methods.data} />
          <View style={{ gap: space.sm }}>
            <SectionTitle>{methods.data.password ? c.change.title : c.define.title}</SectionTitle>
            <Card testID="password-card">
              {methods.data.password ? (
                <ChangePasswordForm />
              ) : (
                <>
                  <T variant="small">{c.define.detail}</T>
                  {methods.data.canSetPasswordNow ? (
                    <DefinePasswordForm methods={methods.data} />
                  ) : (
                    <ConfirmBeforePassword email={methods.data.email} />
                  )}
                </>
              )}
            </Card>
          </View>
          <Devices email={methods.data.email} />
        </>
      ) : methods.isPending ? (
        <LoadingState />
      ) : (
        <ErrorState error={methods.error} onRetry={() => void methods.refetch()} />
      )}
    </StackScreen>
  );
}
