import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { AvatarEditor } from "../../src/features/avatar-editor";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useMe } from "../../src/lib/queries";
import { Button, Card, Field, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const ProfileForm = ({ me }: { me: MeResponse }) => {
  const client = useQueryClient();
  const [firstName, setFirstName] = useState(me.firstName ?? "");
  const [lastName, setLastName] = useState(me.lastName ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: (data) => {
      client.setQueryData(["me"], data);
      setSaved(true);
      setError(null);
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const unchanged = firstName.trim() === (me.firstName ?? "") && lastName.trim() === (me.lastName ?? "");
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{m.settings.profile}</SectionTitle>
      <Card>
        <Field
          label={m.onboarding.firstName}
          value={firstName}
          onChangeText={(v) => {
            setFirstName(v);
            setSaved(false);
          }}
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Field
          label={m.onboarding.lastName}
          value={lastName}
          onChangeText={(v) => {
            setLastName(v);
            setSaved(false);
          }}
          autoComplete="family-name"
          textContentType="familyName"
        />
        <View style={{ gap: 2 }}>
          <T variant="smallStrong">{m.mobile.settings.email}</T>
          <T variant="small" tone="muted">
            {me.email}
          </T>
        </View>
        <Button
          testID="profile-save"
          label={m.common.save}
          variant="secondary"
          loading={save.isPending}
          disabled={!firstName.trim() || !lastName.trim() || unchanged}
          onPress={() => save.mutate()}
        />
        <View accessibilityLiveRegion="polite">
          {saved ? (
            <T variant="caption" tone="muted">
              {m.mobile.settings.saved}
            </T>
          ) : null}
          {error ? (
            <T variant="caption" tone="danger">
              {error}
            </T>
          ) : null}
        </View>
      </Card>
    </View>
  );
};

export default function ProfileSettings() {
  const me = useMe();
  return (
    <StackScreen title={m.account.settings.rubrics.profil.title}>
      {me.data ? (
        <>
          <AvatarEditor me={me.data} />
          <ProfileForm key={me.data.id} me={me.data} />
        </>
      ) : me.isPending ? (
        <LoadingState />
      ) : (
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      )}
    </StackScreen>
  );
}
