import { legalLinks } from "../src/lib/legal-links";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Switch, View } from "react-native";
import { api } from "../src/lib/api";
import { config } from "../src/lib/config";
import { errorMessage } from "../src/lib/errors";
import { getPushPermission, registerPush } from "../src/lib/notifications";
import { useActiveSpace } from "../src/lib/queries";
import { useSession } from "../src/lib/session-store";
import { homeFor, useSpaceStore } from "../src/lib/space-store";
import { useOpQueue } from "../src/lib/sync/op-queue";
import { useUploads } from "../src/lib/upload/upload-queue";
import { Check, ChevronRight } from "../src/ui/icons";
import { Button, Card, Divider, Field, ListSurface, SectionTitle, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { Sheet } from "../src/ui/sheet";
import { ErrorState, LoadingState } from "../src/ui/states";
import { scene, space } from "../src/ui/theme";

// Toute la ligne bascule le réglage : cible large, et un seul élément pour le lecteur d'écran.
const ConsentRow = ({
  title,
  detail,
  value,
  disabled,
  testID,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  disabled: boolean;
  testID: string;
  onChange: (v: boolean) => void;
}) => (
  <Pressable
    testID={testID}
    disabled={disabled}
    onPress={() => onChange(!value)}
    accessibilityRole="switch"
    accessibilityLabel={`${title}. ${detail}`}
    accessibilityState={{ checked: value, disabled }}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      minHeight: 64,
      opacity: pressed ? 0.75 : 1,
    })}
  >
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="smallStrong">{title}</T>
      <T variant="caption" tone="muted">
        {detail}
      </T>
    </View>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Switch
        value={value}
        disabled={disabled}
        trackColor={{ true: scene.actionOnCard, false: scene.controlLine }}
        thumbColor={value ? scene.onActionOnCard : scene.text}
      />
    </View>
  </Pressable>
);

const LinkRow = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="link"
    accessibilityLabel={label}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      minHeight: 52,
      opacity: pressed ? 0.7 : 1,
    })}
  >
    <T variant="small" style={{ flex: 1 }}>
      {label}
    </T>
    <ChevronRight size={18} color={scene.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
  </Pressable>
);

export default function Settings() {
  const { me, space: active } = useActiveSpace();
  const client = useQueryClient();
  const router = useRouter();
  const signOut = useSession((s) => s.signOut);
  const expire = useSession((s) => s.expire);
  const activeSpaceId = useSpaceStore((s) => s.activeOrgId);
  const setActive = useSpaceStore((s) => s.setActive);
  const pendingOps = useOpQueue((s) => s.items.length);
  const pendingUploads = useUploads((s) => s.items.length);
  const hasAthleteSpace = me.data?.spaces.some((s) => s.role === "athlete") ?? false;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [push, setPush] = useState<"granted" | "denied" | "undetermined" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setFirstName(me.data.firstName ?? "");
      setLastName(me.data.lastName ?? "");
    }
  }, [me.data]);

  useEffect(() => {
    void getPushPermission()
      .then(setPush)
      .catch(() => setPush("undetermined"));
  }, []);

  const consents = useQuery({ queryKey: ["consents"], queryFn: api.consents, enabled: hasAthleteSpace });

  const saveProfile = useMutation({
    mutationFn: () => api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: (data) => {
      client.setQueryData(["me"], data);
      setSaved(true);
      setProfileError(null);
    },
    onError: (error) => setProfileError(errorMessage(error)),
  });

  const setConsent = useMutation({
    mutationFn: ({ kind, granted }: { kind: "health" | "video"; granted: boolean }) =>
      activeSpaceId ? api.setSpaceConsent(activeSpaceId, kind, granted) : api.setConsent(kind, granted),
    onSuccess: (data) => {
      client.setQueryData(["consents"], data);
      void client.invalidateQueries({ queryKey: ["today"] });
    },
  });

  const toggleConsent = (kind: "health" | "video", granted: boolean) => {
    if (granted) {
      setConsent.mutate({ kind, granted });
      return;
    }
    Alert.alert(
      m.mobile.settings.revokeTitle,
      kind === "health" ? m.mobile.settings.revokeHealth : m.mobile.settings.revokeVideo,
      [
        { text: m.common.cancel, style: "cancel" },
        { text: m.mobile.settings.revoke, style: "destructive", onPress: () => setConsent.mutate({ kind, granted }) },
      ],
    );
  };

  const deleteAccount = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: async () => {
      setDeleting(false);
      await expire();
    },
    onError: (error) => {
      setDeleteError(error instanceof ApiError && error.status < 500 ? error.message : m.mobile.settings.deleteFailed);
    },
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

  if (me.isPending) {
    return (
      <StackScreen world="craie" title={m.settings.title}>
        <LoadingState />
      </StackScreen>
    );
  }
  if (!me.data) {
    return (
      <StackScreen world="craie" title={m.settings.title}>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </StackScreen>
    );
  }

  return (
    <StackScreen world="craie" title={m.settings.title}>
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
          />
          <Field
            label={m.onboarding.lastName}
            value={lastName}
            onChangeText={(v) => {
              setLastName(v);
              setSaved(false);
            }}
            autoComplete="family-name"
          />
          <View style={{ gap: 2 }}>
            <T variant="smallStrong">{m.mobile.settings.email}</T>
            <T variant="small" tone="muted">
              {me.data.email}
            </T>
          </View>
          <Button
            testID="profile-save"
            label={m.common.save}
            variant="secondary"
            loading={saveProfile.isPending}
            disabled={
              !firstName.trim() ||
              !lastName.trim() ||
              (firstName.trim() === (me.data.firstName ?? "") && lastName.trim() === (me.data.lastName ?? ""))
            }
            onPress={() => saveProfile.mutate()}
          />
          {saved ? (
            <T variant="caption" tone="muted" accessibilityLiveRegion="polite">
              {m.mobile.settings.saved}
            </T>
          ) : null}
          {profileError ? (
            <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {profileError}
            </T>
          ) : null}
        </Card>
      </View>

      {me.data.spaces.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.mobile.settings.spaces}</SectionTitle>
          <ListSurface>
            {me.data.spaces.map((s, i) => (
              <View key={s.organizationId}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.organizationId === active?.organizationId }}
                  accessibilityLabel={`${s.organizationName}, ${m.roles[s.role]}`}
                  onPress={() => {
                    setActive(s.organizationId);
                    router.replace(homeFor(s) ?? "/");
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    padding: space.md,
                    minHeight: 56,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T variant="smallStrong">{s.organizationName}</T>
                    <T variant="caption" tone="muted">
                      {m.roles[s.role]}
                    </T>
                  </View>
                  {s.organizationId === active?.organizationId ? (
                    <Check
                      size={20}
                      color={scene.actionOnCard}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                  ) : null}
                </Pressable>
              </View>
            ))}
          </ListSurface>
        </View>
      ) : null}

      {hasAthleteSpace ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.settings.privacy}</SectionTitle>
          {consents.isPending ? <LoadingState inline /> : null}
          {consents.isError ? <ErrorState error={consents.error} onRetry={() => void consents.refetch()} /> : null}
          {consents.data ? (
            <ListSurface>
              <ConsentRow
                testID="consent-health"
                title={m.settings.healthConsent}
                detail={m.settings.healthConsentDetail}
                value={consents.data.health}
                disabled={setConsent.isPending}
                onChange={(v) => toggleConsent("health", v)}
              />
              <Divider />
              <ConsentRow
                testID="consent-video"
                title={m.settings.videoConsent}
                detail={m.settings.videoConsentDetail}
                value={consents.data.video}
                disabled={setConsent.isPending}
                onChange={(v) => toggleConsent("video", v)}
              />
            </ListSurface>
          ) : null}
          {setConsent.isError ? (
            <T variant="caption" tone="danger">
              {m.mobile.settings.consentFailed}
            </T>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.mobile.settings.notifications}</SectionTitle>
        <T variant="small">
          {push === "granted"
            ? m.mobile.settings.notificationsOn
            : push === "denied"
              ? m.mobile.push.denied
              : m.mobile.settings.notificationsOff}
        </T>
        {push === "denied" ? (
          <Button
            testID="push-open-settings"
            label={m.mobile.settings.openSystemSettings}
            variant="secondary"
            compact
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        {push === "undetermined" ? (
          <Button
            label={m.mobile.settings.enableNotifications}
            variant="secondary"
            compact
            onPress={() => void registerPush({ prompt: true }).then(setPush)}
          />
        ) : null}
      </View>

      {active?.role === "owner" && active.progressionEnabled ? (
        <ListSurface>
          <LinkRow label={m.strengthMapping.title} onPress={() => router.push("/strength-mappings")} />
        </ListSurface>
      ) : null}
      <ListSurface>
        <LinkRow
          label={m.legal.terms}
          onPress={() => void WebBrowser.openBrowserAsync(legalLinks(config.webUrl).terms)}
        />
        <Divider />
        <LinkRow
          label={m.legal.privacy}
          onPress={() => void WebBrowser.openBrowserAsync(legalLinks(config.webUrl).privacy)}
        />
        <Divider />
        <LinkRow
          label={m.legal.contact}
          onPress={() => void WebBrowser.openBrowserAsync(legalLinks(config.webUrl).contact)}
        />
      </ListSurface>

      <View style={{ gap: space.sm }}>
        <Button testID="sign-out" label={m.common.signOut} variant="secondary" onPress={confirmSignOut} />
        <Button
          testID="delete-account"
          label={m.settings.deleteAccount}
          variant="danger"
          onPress={() => {
            setDeleteError(null);
            setConfirmWord("");
            setDeleting(true);
          }}
        />
        <T variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {m.mobile.settings.version(config.appVersion)}
        </T>
      </View>

      {deleting ? (
        <Sheet
          visible
          title={m.mobile.settings.deleteConfirmTitle}
          onClose={() => setDeleting(false)}
          footer={
            <Button
              testID="delete-confirm"
              label={m.mobile.settings.deleteAction}
              variant="danger"
              loading={deleteAccount.isPending}
              disabled={confirmWord.trim() !== m.settings.deleteConfirmWord}
              onPress={() => deleteAccount.mutate()}
            />
          }
        >
          <T>{m.settings.deleteDetail}</T>
          <Field
            label={m.settings.deleteConfirmLabel}
            value={confirmWord}
            onChangeText={setConfirmWord}
            autoCapitalize="characters"
            autoCorrect={false}
            error={deleteError}
          />
        </Sheet>
      ) : null}
    </StackScreen>
  );
}
