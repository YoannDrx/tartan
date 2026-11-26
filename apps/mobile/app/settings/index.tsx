import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { LinkRow } from "../../src/features/settings-rows";
import { config } from "../../src/lib/config";
import { useActiveSpace } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session-store";
import { rubricHref, settingsGroups, type SettingsRubric } from "../../src/lib/settings-rubrics";
import { spaceCaption } from "../../src/lib/personal-space";
import { homeFor, useSpaceStore } from "../../src/lib/space-store";
import { useOpQueue } from "../../src/lib/sync/op-queue";
import { useOwnUploads } from "../../src/lib/upload/upload-queue";
import { Avatar } from "../../src/ui/avatar";
import { Check } from "../../src/ui/icons";
import { Button, Divider, ListSurface, MutedChevron, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { useThemePreference } from "../../src/ui/theme-preference";
import { scene, space } from "../../src/ui/theme";

const t = m.account.settings;

// Le sommaire des réglages : qui je suis, puis une rangée par rubrique, groupées comme sur la web app.
export default function Settings() {
  const { me, space: active } = useActiveSpace();
  const router = useRouter();
  const signOut = useSession((s) => s.signOut);
  const theme = useThemePreference((state) => state.preference);
  const setActive = useSpaceStore((s) => s.setActive);
  const client = useQueryClient();
  const home = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: (data) => client.setQueryData(["me"], data),
  });
  const pendingOps = useOpQueue((s) => s.items.length);
  const pendingUploads = useOwnUploads().length;

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
      <StackScreen title={m.settings.title}>
        <LoadingState />
      </StackScreen>
    );
  }
  if (!me.data) {
    return (
      <StackScreen title={m.settings.title}>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </StackScreen>
    );
  }

  const data = me.data;
  const clubs = data.spaces.filter((s) => s.kind !== "personal" && !s.isDemo);
  const standalone = clubs.every((club) => club.role !== "athlete") && data.spaces.find((s) => s.kind === "personal");
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;
  const athleteOnly = data.spaces.length > 0 && data.spaces.every((s) => s.role === "athlete");
  const summary = (rubric: SettingsRubric): string => {
    const r = t.rubrics;
    if (rubric === "apparence") return r.apparence.summary(m.appearance[theme]);
    if (rubric === "confidentialite") return athleteOnly ? r.confidentialite.summaryAthlete : r.confidentialite.summary;
    return r[rubric].summary;
  };

  return (
    <StackScreen title={m.settings.title}>
      <ListSurface>
        <Pressable
          testID="settings-profile"
          onPress={() => router.push(rubricHref("profil"))}
          accessibilityRole="link"
          accessibilityLabel={t.openProfile(name)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            padding: space.md,
            minHeight: 72,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Avatar
            person={{
              name,
              firstName: data.firstName,
              lastName: data.lastName,
              avatarUrl: data.avatarUrl,
              avatarPreset: data.avatarPreset,
            }}
            size="lg"
          />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong" numberOfLines={2}>
              {name}
            </T>
            <T variant="caption" tone="muted" numberOfLines={1}>
              {data.email}
            </T>
          </View>
          <MutedChevron />
        </Pressable>
      </ListSurface>

      {settingsGroups(active?.role ?? null).map((group) => (
        <View key={group.id} style={{ gap: space.sm }}>
          <SectionTitle>{t.groups[group.id]}</SectionTitle>
          <ListSurface>
            {group.rubrics.map((rubric, index) => (
              <View key={rubric}>
                {index > 0 ? <Divider /> : null}
                <LinkRow
                  testID={`settings-rubric-${rubric}`}
                  label={t.rubrics[rubric].title}
                  detail={summary(rubric)}
                  onPress={() => router.push(rubricHref(rubric))}
                />
              </View>
            ))}
          </ListSurface>
        </View>
      ))}

      {clubs.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.brand.clubs}</SectionTitle>
          <ListSurface>
            {clubs.map((s, i) => (
              <View key={s.organizationId}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.organizationId === active?.organizationId }}
                  accessibilityLabel={`${s.organizationName}, ${spaceCaption(s)}`}
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
                      {spaceCaption(s)}
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
                {i === 0 ? (
                  <T variant="caption">{m.brand.usual}</T>
                ) : (
                  <Button
                    label={m.brand.makeUsual}
                    disabled={home.isPending}
                    onPress={() => home.mutate({ homeOrganizationId: s.organizationId })}
                  />
                )}
              </View>
            ))}
          </ListSurface>
          {standalone && (
            <Button
              label={m.brand.notebook}
              variant="secondary"
              onPress={() => {
                setActive(standalone.organizationId);
                router.replace(homeFor(standalone) ?? "/");
              }}
            />
          )}
        </View>
      ) : null}

      {home.isError && <ErrorState error={home.error} onRetry={() => home.reset()} />}
      <View style={{ gap: space.sm }}>
        <Button testID="sign-out" label={m.common.signOut} variant="secondary" onPress={confirmSignOut} />
        <T variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {m.mobile.settings.version(config.appVersion)}
        </T>
      </View>
    </StackScreen>
  );
}
