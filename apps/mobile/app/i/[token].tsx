import { ConsentRow, LegalLinks } from "../../src/features/consent-row";
import { HistoryShareStep } from "../../src/features/history-share";
import { PushStep, Shell } from "../../src/features/push-step";
import { offersHistoryShare, hasPersonalSpace } from "../../src/lib/personal-space";
import { BirthDateField, toIsoBirthDate, type BirthParts } from "../../src/features/birth-date-field";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { ageAt } from "@tartan/domain";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { registerPush } from "../../src/lib/notifications";
import { currentReferral, usePendingReferral } from "../../src/lib/pending-referral";
import { usePendingInvite } from "../../src/lib/pending-invite";
import { useMe } from "../../src/lib/queries";
import { queryClient } from "../../src/lib/query-client";
import { useSession } from "../../src/lib/session-store";
import { useSpaceStore } from "../../src/lib/space-store";
import { Avatar } from "../../src/ui/avatar";
import { Button, Card, Field, LaneLine, ScreenTitle, T } from "../../src/ui/primitives";
import { useSceneStatusBar } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const status = useSession((s) => s.status);
  const me = useMe(status === "signed-in");
  const keep = usePendingInvite((s) => s.keep);
  const clear = usePendingInvite((s) => s.clear);
  const setActive = useSpaceStore((s) => s.setActive);
  const router = useRouter();

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.invitation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birth, setBirth] = useState<BirthParts>({ day: "", month: "", year: "" });
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [video, setVideo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Après l'acceptation : le partage de l'historique (s'il avait son espace personnel), puis les notifications.
  const [accepted, setAccepted] = useState<{ organizationId: string; share: boolean } | null>(null);

  // Le jeton est gardé jusqu'à l'acceptation : se connecter ne perd pas l'invitation.
  useEffect(() => {
    if (token) keep(token);
  }, [token, keep]);

  useEffect(() => {
    if (me.data?.firstName) setFirstName((v) => v || (me.data?.firstName ?? ""));
    if (me.data?.lastName) setLastName((v) => v || (me.data?.lastName ?? ""));
    if (me.data?.birthDate) {
      const [y, mo, d] = me.data.birthDate.split("-");
      setBirth((v) => (v.year ? v : { year: y ?? "", month: mo ?? "", day: d ?? "" }));
    }
  }, [me.data?.firstName, me.data?.lastName, me.data?.birthDate]);

  const isAthlete = preview.data?.role === "athlete";
  const birthDate = toIsoBirthDate(birth);

  const accept = useMutation({
    mutationFn: () =>
      api.acceptInvitation(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate,
        consents: { terms, health: isAthlete && health, video: isAthlete && video },
        referralCode: currentReferral(),
      }),
    onSuccess: async (result) => {
      clear();
      usePendingReferral.getState().clear();
      setActive(result.organizationId);
      // Lu avant l'invalidation : l'espace personnel existait avant d'arriver dans ce groupe.
      const share = offersHistoryShare({ hadPersonal: hasPersonalSpace(me.data), role: preview.data?.role });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setAccepted({ organizationId: result.organizationId, share });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const leave = () => {
    clear();
    router.replace("/");
  };

  const submit = () => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = m.mobile.forms.firstNameRequired;
    if (!lastName.trim()) next.lastName = m.mobile.forms.lastNameRequired;
    if (!birth.day && !birth.month && !birth.year) next.birthDate = m.mobile.invite.birthRequired;
    else if (!birthDate) next.birthDate = m.mobile.invite.birthInvalid;
    if (!terms) next.terms = m.invite.termsRequired;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length || !birthDate) return;
    if (me.data?.birthDate) {
      accept.mutate();
      return;
    }
    Alert.alert(
      m.age.checkTitle,
      m.age.check(
        new Date(`${birthDate}T12:00:00Z`).toLocaleDateString("fr-FR"),
        ageAt(birthDate, new Date(), "Europe/Paris"),
      ),
      [
        { text: m.age.correct, style: "cancel" },
        { text: m.age.saveConfirmed, onPress: () => accept.mutate() },
      ],
    );
  };

  if (accepted?.share)
    return (
      <HistoryShareStep
        orgId={accepted.organizationId}
        coach={preview.data?.inviterName ?? ""}
        onDone={() => setAccepted({ ...accepted, share: false })}
      />
    );
  if (accepted) return <PushStep coach={!isAthlete} onDone={() => router.replace("/")} />;

  if (preview.isPending) {
    return (
      <Shell>
        <LoadingState label={m.mobile.invite.loading} />
      </Shell>
    );
  }

  if (preview.isError || !preview.data) {
    const notFound = preview.error instanceof ApiError && preview.error.status === 404;
    return (
      <Shell>
        {notFound ? (
          <T>{m.mobile.invite.invalid}</T>
        ) : (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        )}
        <Button label={m.mobile.invite.backToApp} variant="secondary" onPress={leave} />
      </Shell>
    );
  }

  const invitation = preview.data;
  const blocked = { expired: m.invite.expired, revoked: m.invite.revoked, used: m.invite.used, valid: null }[
    invitation.state
  ];

  const title = isAthlete
    ? m.invite.title(invitation.inviterName, invitation.groupNames.join(", ") || m.mobile.invite.groupFallback)
    : m.invite.titleCoach(invitation.inviterName, invitation.organizationName);

  return (
    <Shell>
      <View style={{ gap: space.sm }}>
        <Avatar
          person={{
            name: invitation.inviterName,
            avatarUrl: invitation.inviterAvatarUrl,
            avatarPreset: invitation.inviterAvatarPreset,
          }}
          size="lg"
        />
        <ScreenTitle title={title} variant="display" testID="invite-title" />
        <T variant="small">{invitation.organizationName}</T>
      </View>
      <LaneLine />

      {blocked ? (
        <>
          <T>{blocked}</T>
          <Button label={m.mobile.invite.backToApp} variant="secondary" onPress={leave} />
        </>
      ) : status !== "signed-in" ? (
        <>
          <T>{m.mobile.invite.signInLead}</T>
          <Button
            testID="invite-sign-in"
            label={m.mobile.invite.signIn}
            onPress={() => router.replace({ pathname: "/sign-in", params: { intent: "create" } })}
          />
        </>
      ) : (
        <>
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
            {me.data?.birthDate ? (
              <T variant="small">
                {m.invite.birthDate} : {new Date(`${me.data.birthDate}T12:00:00Z`).toLocaleDateString("fr-FR")}
              </T>
            ) : (
              <BirthDateField value={birth} onChange={setBirth} error={errors.birthDate} />
            )}

            <T variant="title2" heading>
              {m.mobile.invite.consentsTitle}
            </T>
            <ConsentRow testID="consent-terms" label={m.invite.consentTerms} value={terms} onChange={setTerms} />
            {errors.terms ? (
              <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {errors.terms}
              </T>
            ) : null}
            <LegalLinks />
            {isAthlete ? (
              <>
                <ConsentRow
                  testID="consent-health"
                  label={m.invite.consentHealth}
                  value={health}
                  onChange={setHealth}
                />
                <ConsentRow testID="consent-video" label={m.invite.consentVideo} value={video} onChange={setVideo} />
                <T variant="caption" tone="muted">
                  {m.invite.consentOptional}
                </T>
              </>
            ) : null}
            {formError ? (
              <T variant="small" tone="danger" accessibilityLiveRegion="assertive">
                {formError}
              </T>
            ) : null}
            <Button testID="invite-accept" label={m.invite.accept} loading={accept.isPending} onPress={submit} />
          </Card>
          <Button label={m.mobile.invite.ignore} variant="secondary" compact onPress={leave} />
        </>
      )}
    </Shell>
  );
}
