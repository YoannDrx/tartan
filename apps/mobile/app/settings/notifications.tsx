import { useMutation, useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { LinkRow, ToggleRow } from "../../src/features/settings-rows";
import { api } from "../../src/lib/api";
import { getPushPermission, registerPush } from "../../src/lib/notifications";
import { useActiveSpace } from "../../src/lib/queries";
import { Button, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

// Rubrique Notifications : ce téléphone, les catégories, puis les e-mails.
export default function NotificationSettings() {
  const { me, space: active } = useActiveSpace();
  const client = useQueryClient();
  const router = useRouter();
  const [push, setPush] = useState<"granted" | "denied" | "undetermined" | null>(null);
  const save = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: (next) => client.setQueryData(["me"], next),
  });

  useEffect(() => {
    void getPushPermission()
      .then(setPush)
      .catch(() => setPush("undetermined"));
  }, []);

  const title = m.account.settings.rubrics.notifications.title;
  if (!me.data) {
    return (
      <StackScreen title={title}>
        {me.isPending ? <LoadingState /> : <ErrorState error={me.error} onRetry={() => void me.refetch()} />}
      </StackScreen>
    );
  }
  const categories = me.data.preferences?.notifications;
  const emails = me.data.preferences?.email;

  return (
    <StackScreen title={title}>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.mobile.settings.notifications}</SectionTitle>
        <T variant="small" testID="push-state">
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
            testID="push-enable"
            label={m.mobile.settings.enableNotifications}
            variant="secondary"
            compact
            onPress={() => void registerPush({ prompt: true }).then(setPush)}
          />
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.inbox.categories}</SectionTitle>
        <T variant="small">{m.inbox.categoriesDetail}</T>
        <ListSurface>
          {(["sessions", "feedback", "group", "product"] as const).map((key, index) => (
            <View key={key}>
              {index > 0 ? <Divider /> : null}
              <ToggleRow
                testID={`push-category-${key}`}
                title={m.inbox[key]}
                detail=""
                value={categories?.[key] ?? true}
                disabled={save.isPending}
                onChange={(on) => save.mutate({ notifications: { [key]: on } })}
              />
            </View>
          ))}
        </ListSurface>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.settings.emails}</SectionTitle>
        <T variant="small">{m.settings.emailsDetail}</T>
        <ListSurface>
          <ToggleRow
            testID="email-notifications"
            title={m.settings.emailNotifications}
            detail=""
            value={emails?.notifications ?? true}
            disabled={save.isPending}
            onChange={(on) => save.mutate({ email: { notifications: on } })}
          />
          {active?.role === "owner" ? (
            <>
              <Divider />
              <ToggleRow
                testID="email-digest"
                title={m.settings.emailDigest}
                detail=""
                value={emails?.digest ?? true}
                disabled={save.isPending}
                onChange={(on) => save.mutate({ email: { digest: on } })}
              />
            </>
          ) : null}
          {active?.aiPlannerEnabled ? (
            <>
              <Divider />
              <ToggleRow
                testID="ai-consent"
                title={m.aiPlanner.consentSetting}
                detail={m.aiPlanner.consentSettingDetail}
                value={me.data.preferences?.aiConsent ?? false}
                disabled={save.isPending}
                onChange={(on) => save.mutate({ aiConsent: on })}
              />
            </>
          ) : null}
        </ListSurface>
        {save.isError ? (
          <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {m.mobile.settings.consentFailed}
          </T>
        ) : null}
      </View>

      <ListSurface>
        <LinkRow label={m.inbox.title} onPress={() => router.push("/notifications")} />
      </ListSurface>
    </StackScreen>
  );
}
