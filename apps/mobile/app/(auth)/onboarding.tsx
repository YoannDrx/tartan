import { useMutation } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InviteLinkSheet } from "../../src/features/invite-link-sheet";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { currentReferral, usePendingReferral } from "../../src/lib/pending-referral";
import { useMe } from "../../src/lib/queries";
import { queryClient } from "../../src/lib/query-client";
import { useSession } from "../../src/lib/session-store";
import { useSpaceStore } from "../../src/lib/space-store";
import { Button, Card, Chip, Field, LaneLine, ScreenTitle, T } from "../../src/ui/primitives";
import { useSceneStatusBar } from "../../src/ui/screen";
import { LoadingState } from "../../src/ui/states";
import { scene, space, usePagePad } from "../../src/ui/theme";

type Errors = Partial<Record<"firstName" | "lastName" | "orgName" | "groupName", string>>;

export default function Onboarding() {
  useSceneStatusBar();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const me = useMe(status === "signed-in");
  const setActive = useSpaceStore((s) => s.setActive);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = usePagePad();
  const [step, setStep] = useState<"profile" | "org">("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<"club" | "independent">("club");
  const [groupName, setGroupName] = useState("");
  const [pasting, setPasting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data?.firstName) setFirstName((v) => v || (me.data?.firstName ?? ""));
    if (me.data?.lastName) setLastName((v) => v || (me.data?.lastName ?? ""));
  }, [me.data?.firstName, me.data?.lastName]);

  const create = useMutation({
    mutationFn: async () => {
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      return api.createOrganization({
        name: orgName.trim(),
        type: orgType,
        firstGroupName: groupName.trim(),
        disciplines: [],
        referralCode: currentReferral(),
      });
    },
    onSuccess: async (result) => {
      usePendingReferral.getState().clear();
      setActive(result.organizationId);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/tracking");
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (status === "signed-out") return <Redirect href="/sign-in" />;
  if (me.isPending) return <LoadingState />;
  if (me.data && me.data.spaces.length > 0 && !create.isPending) return <Redirect href="/" />;

  const nextStep = () => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = m.mobile.forms.firstNameRequired;
    if (!lastName.trim()) next.lastName = m.mobile.forms.lastNameRequired;
    setErrors(next);
    if (Object.keys(next).length === 0) setStep("org");
  };

  const submit = () => {
    const next: Errors = {};
    if (!orgName.trim()) next.orgName = m.mobile.forms.orgNameRequired;
    if (!groupName.trim()) next.groupName = m.mobile.forms.groupNameRequired;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length === 0) create.mutate();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: scene.page, paddingTop: insets.top }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: space.xxl,
          paddingHorizontal: pad,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        {step === "profile" ? (
          <>
            <ScreenTitle title={m.onboarding.profileTitle} />
            <LaneLine />
            <Card>
              <Field
                label={m.onboarding.firstName}
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                textContentType="givenName"
                error={errors.firstName}
              />
              <Field
                label={m.onboarding.lastName}
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                textContentType="familyName"
                error={errors.lastName}
              />
              <Button label={m.mobile.onboarding.next} onPress={nextStep} />
            </Card>
            <T variant="small">{m.onboarding.joinHint}</T>
            <Button
              testID="invite-link-open"
              label={m.mobile.inviteLink.open}
              variant="secondary"
              compact
              onPress={() => setPasting(true)}
            />
            <Button
              label={m.common.signOut}
              variant="ghost"
              compact
              onPress={() => void signOut()}
              style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
            />
          </>
        ) : (
          <>
            <ScreenTitle title={m.onboarding.orgTitle} />
            <LaneLine />
            <Card>
              <View style={{ gap: space.sm }}>
                <T variant="smallStrong">{m.onboarding.orgType}</T>
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Chip
                    tall
                    label={m.onboarding.orgTypeClub}
                    active={orgType === "club"}
                    onPress={() => setOrgType("club")}
                  />
                  <Chip
                    tall
                    label={m.onboarding.orgTypeIndependent}
                    active={orgType === "independent"}
                    onPress={() => setOrgType("independent")}
                  />
                </View>
              </View>
              <Field
                label={m.onboarding.orgName}
                value={orgName}
                onChangeText={setOrgName}
                hint={m.onboarding.orgNameHint(firstName.trim())}
                error={errors.orgName}
              />
              <Field
                label={m.onboarding.firstGroup}
                value={groupName}
                onChangeText={setGroupName}
                hint={m.onboarding.firstGroupHint}
                error={errors.groupName}
              />
              {formError ? (
                <T variant="small" tone="danger" accessibilityLiveRegion="assertive">
                  {formError}
                </T>
              ) : null}
              <Button label={m.onboarding.createSpace} loading={create.isPending} onPress={submit} />
            </Card>
            <Button label={m.mobile.onboarding.back} variant="secondary" compact onPress={() => setStep("profile")} />
          </>
        )}
      </ScrollView>
      {pasting ? <InviteLinkSheet onClose={() => setPasting(false)} /> : null}
    </KeyboardAvoidingView>
  );
}
