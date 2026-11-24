import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, View } from "react-native";
import { HistorySharesSettings } from "../../src/features/history-share";
import { LinkRow, ToggleRow } from "../../src/features/settings-rows";
import { api } from "../../src/lib/api";
import { config } from "../../src/lib/config";
import { shareMyData } from "../../src/lib/export-data";
import { legalLinks } from "../../src/lib/legal-links";
import { hasPersonalSpace } from "../../src/lib/personal-space";
import { useActiveSpace, useToday } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session-store";
import { Button, Divider, Field, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const t = m.account.settings;

// Rubrique Confidentialité : mes accords dans l'espace ouvert (athlète), le partage de mon historique personnel, mes
// données, les documents, puis la suppression du compte. Les accords sont ceux de la fiche de cet espace : un athlète
// qui a aussi son espace personnel a deux fiches, et chacune garde les siens (plus de `consent_scope_required`).
export default function PrivacySettings() {
  const { me, space: active, orgId } = useActiveSpace();
  const client = useQueryClient();
  const expire = useSession((s) => s.expire);
  const athleteHere = active?.role === "athlete";
  // Les accords de la fiche de cet espace, tels que les lit sa journée.
  const consents = useToday(athleteHere ? orgId : "");
  const [deleting, setDeleting] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const setConsent = useMutation({
    mutationFn: ({ kind, granted }: { kind: "health" | "video"; granted: boolean }) =>
      api.setSpaceConsent(orgId, kind, granted),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["today", orgId] });
      void client.invalidateQueries({ queryKey: ["consents"] });
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

  const exportData = useMutation({ mutationFn: shareMyData });

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

  const title = t.rubrics.confidentialite.title;
  if (!me.data) {
    return (
      <StackScreen title={title}>
        {me.isPending ? <LoadingState /> : <ErrorState error={me.error} onRetry={() => void me.refetch()} />}
      </StackScreen>
    );
  }
  const links = legalLinks(config.webUrl);

  return (
    <StackScreen title={title}>
      {athleteHere ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.settings.privacy}</SectionTitle>
          {consents.isPending ? <LoadingState inline /> : null}
          {consents.isError ? <ErrorState error={consents.error} onRetry={() => void consents.refetch()} /> : null}
          {consents.data ? (
            <ListSurface>
              <ToggleRow
                testID="consent-health"
                title={m.settings.healthConsent}
                detail={m.settings.healthConsentDetail}
                value={consents.data.healthConsent}
                disabled={setConsent.isPending}
                onChange={(v) => toggleConsent("health", v)}
              />
              <Divider />
              <ToggleRow
                testID="consent-video"
                title={m.settings.videoConsent}
                detail={m.settings.videoConsentDetail}
                value={consents.data.videoConsent}
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

      {/* Les partages de son historique personnel avec un coach : visibles d'où qu'il soit, retirés d'un geste. */}
      {hasPersonalSpace(me.data) ? <HistorySharesSettings /> : null}

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.dataTitle}</SectionTitle>
        <T variant="small">{m.settings.exportDetail}</T>
        <Button
          testID="export-data"
          label={m.settings.exportData}
          variant="secondary"
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
        />
        {exportData.isError ? (
          <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {m.mobile.settings.exportFailed}
          </T>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.legalTitle}</SectionTitle>
        <ListSurface>
          <LinkRow label={m.legal.terms} onPress={() => void WebBrowser.openBrowserAsync(links.terms)} />
          <Divider />
          <LinkRow label={m.legal.privacy} onPress={() => void WebBrowser.openBrowserAsync(links.privacy)} />
        </ListSurface>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.accountTitle}</SectionTitle>
        <T variant="small">{t.deleteDetail}</T>
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
            testID="delete-confirm-word"
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
