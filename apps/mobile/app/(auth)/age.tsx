import { useMutation } from "@tanstack/react-query";
import { ageStatus } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BirthDateField, toIsoBirthDate, type BirthParts } from "../../src/features/birth-date-field";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useMe } from "../../src/lib/queries";
import { queryClient } from "../../src/lib/query-client";
import { useSession } from "../../src/lib/session-store";
import { Button, Card, LaneLine, ScreenTitle, T } from "../../src/ui/primitives";
import { useSceneStatusBar } from "../../src/ui/screen";
import { LoadingState } from "../../src/ui/states";
import { scene, space, usePagePad } from "../../src/ui/theme";

export default function Age() {
  useSceneStatusBar();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const expire = useSession((s) => s.expire);
  const me = useMe(status === "signed-in");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = usePagePad();
  const [parts, setParts] = useState<BirthParts>({ day: "", month: "", year: "" });
  const [error, setError] = useState<string | undefined>();

  const confirm = useMutation({
    mutationFn: (birthDate: string) => api.confirmAge(birthDate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/");
    },
    // Une date refusée est enregistrée : la relecture du profil ouvre l'écran qui explique la suite.
    onError: async (failure) => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setError(errorMessage(failure));
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => expire(),
  });

  if (status === "signed-out") return <Redirect href="/sign-in" />;
  if (!me.data) return <LoadingState />;
  const age = ageStatus(me.data.birthDate ?? null, new Date());
  if (age === "adult") return <Redirect href="/" />;

  const body =
    age === "minor" ? (
      <>
        <ScreenTitle title={m.age.restrictedTitle} />
        <LaneLine />
        <Card>
          <T>{m.age.restricted}</T>
          <T variant="small">{m.age.restrictedNext}</T>
          <Button
            testID="age-delete"
            label={m.settings.deleteAccount}
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert(m.settings.deleteAccount, m.settings.deleteDetail, [
                { text: m.common.cancel, style: "cancel" },
                { text: m.common.delete, style: "destructive", onPress: () => remove.mutate() },
              ])
            }
          />
          <Button testID="age-sign-out" label={m.common.signOut} variant="secondary" onPress={() => void signOut()} />
        </Card>
      </>
    ) : (
      <>
        <ScreenTitle title={m.age.title} />
        <LaneLine />
        <Card>
          <T>{m.age.lead}</T>
          <BirthDateField value={parts} onChange={setParts} error={error} />
          <Button
            testID="age-confirm"
            label={m.age.confirm}
            loading={confirm.isPending}
            onPress={() => {
              const birthDate = toIsoBirthDate(parts);
              if (!birthDate) {
                setError(m.mobile.invite.birthInvalid);
                return;
              }
              setError(undefined);
              confirm.mutate(birthDate);
            }}
          />
          <Button label={m.common.signOut} variant="ghost" onPress={() => void signOut()} />
        </Card>
      </>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: scene.page, paddingTop: insets.top }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: space.xxl,
          paddingHorizontal: pad,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
