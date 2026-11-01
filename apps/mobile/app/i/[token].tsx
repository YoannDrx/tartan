import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { requiresParentalConsent } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { api } from "../../src/lib/api";
import { config } from "../../src/lib/config";
import { errorMessage } from "../../src/lib/errors";
import { registerPush } from "../../src/lib/notifications";
import { usePendingInvite } from "../../src/lib/pending-invite";
import { useMe } from "../../src/lib/queries";
import { queryClient } from "../../src/lib/query-client";
import { useSession } from "../../src/lib/session-store";
import { useSpaceStore } from "../../src/lib/space-store";
import { LaneArcs } from "../../src/ui/glyphs";
import { Button, Field, T } from "../../src/ui/primitives";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { color, GUTTER, radius, space, usePalette } from "../../src/ui/theme";

const emailSchema = z.email();

const toIsoBirthDate = (day: string, month: string, year: string): string | null => {
  const d = Number(day);
  const mo = Number(month);
  const y = Number(year);
  if (!d || !mo || year.length !== 4) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    date.getTime() < Date.now();
  if (!valid) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const ConsentRow = ({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{
        flexDirection: "row",
        gap: space.md,
        alignItems: "center",
        padding: space.md,
        backgroundColor: p.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: p.border,
        minHeight: 64,
      }}
    >
      <T variant="small" style={{ flex: 1 }}>
        {label}
      </T>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color.ink, false: color.surfaceSunk }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: space.xl,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Après l'acceptation : pourquoi les notifications, puis arrivée sur Aujourd'hui.
const PushStep = ({ coach, onDone }: { coach: boolean; onDone: () => void }) => {
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <T variant="display" heading>
        {coach ? m.mobile.push.coachTitle : m.push.permissionTitle}
      </T>
      <T>{coach ? m.mobile.push.coachBody : m.push.permissionBody}</T>
      {denied ? (
        <T variant="small" tone="muted" accessibilityLiveRegion="polite">
          {m.mobile.push.denied}
        </T>
      ) : null}
      <Button
        testID="push-enable"
        label={m.push.enable}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void registerPush({ prompt: true })
            .then((permission) => {
              if (permission === "granted") onDone();
              else setDenied(true);
            })
            .catch(() => setDenied(true))
            .finally(() => setBusy(false));
        }}
      />
      <Button testID="push-later" label={m.push.later} variant="secondary" onPress={onDone} />
    </Shell>
  );
};

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
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [video, setVideo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Le jeton est gardé jusqu'à l'acceptation : se connecter ne perd pas l'invitation.
  useEffect(() => {
    if (token) keep(token);
  }, [token, keep]);

  useEffect(() => {
    if (me.data?.firstName) setFirstName((v) => v || (me.data?.firstName ?? ""));
    if (me.data?.lastName) setLastName((v) => v || (me.data?.lastName ?? ""));
    if (me.data?.birthDate) {
      const [y, mo, d] = me.data.birthDate.split("-");
      setYear((v) => v || (y ?? ""));
      setMonth((v) => v || (mo ?? ""));
      setDay((v) => v || (d ?? ""));
    }
  }, [me.data?.firstName, me.data?.lastName, me.data?.birthDate]);

  const isAthlete = preview.data?.role === "athlete";
  const birthDate = toIsoBirthDate(day, month, year);
  const minor = isAthlete && requiresParentalConsent(birthDate, new Date());

  const accept = useMutation({
    mutationFn: () =>
      api.acceptInvitation(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: isAthlete ? birthDate : null,
        guardianEmail: minor ? guardianEmail.trim().toLowerCase() : undefined,
        consents: { terms, health: isAthlete && health, video: isAthlete && video },
      }),
    onSuccess: async (result) => {
      clear();
      setActive(result.organizationId);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setAccepted(true);
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
    if (isAthlete) {
      if (!day && !month && !year) next.birthDate = m.mobile.invite.birthRequired;
      else if (!birthDate) next.birthDate = m.mobile.invite.birthInvalid;
      if (minor && !emailSchema.safeParse(guardianEmail.trim()).success)
        next.guardianEmail = m.mobile.invite.guardianRequired;
    }
    if (!terms) next.terms = m.invite.termsRequired;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length === 0) accept.mutate();
  };

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
      <View
        style={{
          backgroundColor: color.brand,
          borderRadius: radius.hero,
          padding: space.xl,
          gap: space.sm,
          overflow: "hidden",
        }}
      >
        <View
          style={{ position: "absolute", right: -70, bottom: -90 }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LaneArcs color={color.white} />
        </View>
        <T variant="display" tone="white" heading testID="invite-title">
          {title}
        </T>
        <T variant="small" tone="white">
          {invitation.organizationName}
        </T>
      </View>

      {blocked ? (
        <>
          <T>{blocked}</T>
          <Button label={m.mobile.invite.backToApp} variant="secondary" onPress={leave} />
        </>
      ) : status !== "signed-in" ? (
        <>
          <T>{m.mobile.invite.signInLead}</T>
          <Button testID="invite-sign-in" label={m.mobile.invite.signIn} onPress={() => router.replace("/sign-in")} />
        </>
      ) : (
        <>
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
          {isAthlete ? (
            <View style={{ gap: space.xs + 2 }}>
              <T variant="smallStrong">{m.invite.birthDate}</T>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Field
                  label={m.mobile.invite.day}
                  hideLabel
                  placeholder={m.mobile.invite.day}
                  value={day}
                  onChangeText={(v) => setDay(v.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={2}
                  containerStyle={{ flex: 1 }}
                />
                <Field
                  label={m.mobile.invite.month}
                  hideLabel
                  placeholder={m.mobile.invite.month}
                  value={month}
                  onChangeText={(v) => setMonth(v.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={2}
                  containerStyle={{ flex: 1 }}
                />
                <Field
                  label={m.mobile.invite.year}
                  hideLabel
                  placeholder={m.mobile.invite.year}
                  value={year}
                  onChangeText={(v) => setYear(v.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={4}
                  containerStyle={{ flex: 1.3 }}
                />
              </View>
              {errors.birthDate ? (
                <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
                  {errors.birthDate}
                </T>
              ) : null}
            </View>
          ) : null}
          {minor ? (
            <Field
              label={m.invite.guardianEmail}
              hint={m.invite.guardianHint}
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={errors.guardianEmail}
            />
          ) : null}

          <T variant="title2" heading>
            {m.mobile.invite.consentsTitle}
          </T>
          <ConsentRow testID="consent-terms" label={m.invite.consentTerms} value={terms} onChange={setTerms} />
          {errors.terms ? (
            <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {errors.terms}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Button
              label={m.mobile.invite.termsLink}
              variant="ghost"
              compact
              style={{ paddingHorizontal: 0 }}
              onPress={() => void WebBrowser.openBrowserAsync(`${config.webUrl}/conditions`)}
            />
            <Button
              label={m.mobile.invite.privacyLink}
              variant="ghost"
              compact
              style={{ paddingHorizontal: 0 }}
              onPress={() => void WebBrowser.openBrowserAsync(`${config.webUrl}/confidentialite`)}
            />
          </View>
          {isAthlete ? (
            <>
              <ConsentRow testID="consent-health" label={m.invite.consentHealth} value={health} onChange={setHealth} />
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
          <Button label={m.mobile.invite.ignore} variant="secondary" compact onPress={leave} />
        </>
      )}
    </Shell>
  );
}
