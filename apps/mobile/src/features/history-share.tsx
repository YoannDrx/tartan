import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HistoryShareScope, SharedHistory } from "@tartan/contracts";
import { formatHeight } from "@tartan/domain";
import { capitalize, formatDayMonth, m } from "@tartan/i18n";
import { useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import { api } from "../lib/api";
import { SHARE_SCOPES, toggleHistoryScope } from "../lib/personal-space";
import { Button, Card, Divider, ListSurface, ScreenTitle, SectionTitle, T, Tag } from "../ui/primitives";
import { ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";
import { ConsentRow } from "./consent-row";
import { Shell } from "./push-step";

const t = m.mobile.solo.share;
const fullDay = (iso: string) => `${capitalize(formatDayMonth(iso))} ${iso.slice(0, 4)}`;

// Juste après l'arrivée dans le groupe d'un coach, pour un athlète qui a son espace personnel : facultatif. Par cases,
// rien de coché d'avance ; « Pas maintenant » ne partage rien. La santé n'est jamais une case.
export const HistoryShareStep = ({ orgId, coach, onDone }: { orgId: string; coach: string; onDone: () => void }) => {
  const client = useQueryClient();
  const [scopes, setScopes] = useState<HistoryShareScope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const share = useMutation({
    mutationFn: () => api.shareHistory({ organizationId: orgId, scopes }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["history-shares"] });
      onDone();
    },
    onError: () => setError(t.failed),
  });
  return (
    <Shell>
      <ScreenTitle title={t.title(coach)} testID="history-share-title" />
      <T>{t.lead}</T>
      <Card>
        <T variant="title2" heading>
          {t.scopesLabel}
        </T>
        {SHARE_SCOPES.map((scope) => (
          <ConsentRow
            key={scope}
            testID={`history-share-${scope}`}
            label={t.scopes[scope]}
            detail={t.scopeDetail[scope]}
            value={scopes.includes(scope)}
            disabled={share.isPending}
            onChange={() => {
              setError(null);
              setScopes((current) => toggleHistoryScope(current, scope));
            }}
          />
        ))}
        <T variant="small">{t.health}</T>
        <T variant="caption" tone="muted">
          {t.revocable}
        </T>
        {error ? (
          <T variant="small" tone="danger" accessibilityLiveRegion="assertive">
            {error}
          </T>
        ) : null}
        <Button
          testID="history-share-submit"
          label={t.submit}
          loading={share.isPending}
          onPress={() => {
            if (scopes.length === 0) {
              setError(t.pickOne);
              return;
            }
            share.mutate();
          }}
        />
      </Card>
      <Button
        testID="history-share-skip"
        label={t.skip}
        variant="secondary"
        compact
        disabled={share.isPending}
        onPress={onDone}
      />
    </Shell>
  );
};

// Réglages, Confidentialité : chaque coach avec qui l'historique est partagé, et le retrait d'un geste confirmé.
export const HistorySharesSettings = () => {
  const client = useQueryClient();
  const shares = useQuery({ queryKey: ["history-shares"], queryFn: api.historyShares });
  const [notice, setNotice] = useState<string | null>(null);
  const revoke = useMutation({
    mutationFn: (orgId: string) => api.revokeHistoryShare(orgId),
    onSuccess: () => {
      setNotice(t.revoked);
      void client.invalidateQueries({ queryKey: ["history-shares"] });
    },
    onError: () => setNotice(t.revokeFailed),
  });
  return (
    <View style={{ gap: space.sm }} testID="history-shares">
      <SectionTitle>{t.settingsTitle}</SectionTitle>
      {shares.isPending ? <LoadingState inline /> : null}
      {shares.isError && !shares.data ? (
        <ErrorState error={shares.error} onRetry={() => void shares.refetch()} />
      ) : null}
      {shares.data?.length === 0 ? <T variant="small">{t.settingsEmpty}</T> : null}
      {shares.data && shares.data.length > 0 ? (
        <ListSurface>
          {shares.data.map((share, index) => (
            <View key={share.organizationId}>
              {index > 0 ? <Divider /> : null}
              <View style={{ padding: space.md, gap: space.sm }}>
                <View accessible style={{ gap: 2 }}>
                  <T variant="smallStrong">{share.organizationName}</T>
                  <T variant="caption" tone="muted">
                    {share.scopes.map((scope) => t.coachScopes[scope]).join(", ")}
                  </T>
                  <T variant="caption" tone="muted">
                    {t.settingsSince(fullDay(share.grantedAt.slice(0, 10)))}
                  </T>
                </View>
                <Button
                  testID={`history-share-revoke-${share.organizationId}`}
                  label={t.revoke}
                  accessibilityLabel={t.revokeLabel(share.organizationName)}
                  variant="danger"
                  compact
                  disabled={revoke.isPending}
                  style={{ alignSelf: "flex-start" }}
                  onPress={() =>
                    Alert.alert(t.revokeTitle(share.organizationName), t.revokeDetail, [
                      { text: m.common.cancel, style: "cancel" },
                      { text: t.revoke, style: "destructive", onPress: () => revoke.mutate(share.organizationId) },
                    ])
                  }
                />
              </View>
            </View>
          ))}
        </ListSurface>
      ) : null}
      {notice ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {notice}
        </T>
      ) : null}
    </View>
  );
};

const markLabel = (value: number, unit: string) =>
  unit === "cm" ? `${formatHeight(value)} m` : `${String(value).replace(".", ",")} ${unit}`;
const disciplineLabel = (key: string) => (m.mobile.progress.discipline as Record<string, string>)[key] ?? key;
const testKind = (kind: string) => (m.testKind as Record<string, string>)[kind] ?? kind;

const HistoryRow = ({
  title,
  detail,
  value,
  badge,
}: {
  title: string;
  detail: string;
  value: string;
  badge?: string;
}) => (
  <View
    accessible
    style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 56 }}
  >
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="smallStrong">{title}</T>
      <T variant="caption" tone="muted">
        {detail}
      </T>
      {badge ? <Tag label={badge} tone="brand" /> : null}
    </View>
    <T variant="smallStrong">{value}</T>
  </View>
);

const Part = ({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) => (
  <View style={{ gap: space.xs }}>
    <T variant="smallStrong" heading>
      {title}
    </T>
    {empty ? <T variant="small">{t.coachEmpty}</T> : <ListSurface>{children}</ListSurface>}
  </View>
);

const SharedHistoryBody = ({ history }: { history: NonNullable<SharedHistory> }) => (
  <View style={{ gap: space.md }}>
    <T variant="small">{t.coachLead(fullDay(history.grantedAt.slice(0, 10)))}</T>
    {history.records ? (
      <Part title={t.coachScopes.records} empty={history.records.length === 0}>
        {history.records.map((record, index) => (
          <View key={`${record.discipline}-${record.date}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <HistoryRow
              title={disciplineLabel(record.discipline)}
              detail={fullDay(record.date)}
              value={markLabel(record.mark, record.unit)}
              badge={record.isPb ? m.athletes.record : undefined}
            />
          </View>
        ))}
      </Part>
    ) : null}
    {history.strength ? (
      <Part title={t.coachScopes.strength} empty={history.strength.length === 0}>
        {history.strength.map((test, index) => (
          <View key={`${test.exercise}-${test.date}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <HistoryRow
              title={test.exercise}
              detail={`${testKind(test.kind)}, ${fullDay(test.date)}`}
              value={markLabel(test.value, test.unit)}
            />
          </View>
        ))}
      </Part>
    ) : null}
    {history.sessions ? (
      <Part title={t.coachScopes.sessions} empty={history.sessions.length === 0}>
        {history.sessions.map((session, index) => (
          <View key={`${session.date}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <HistoryRow
              title={session.title}
              detail={fullDay(session.date)}
              value={t.status[session.status] ?? session.status}
            />
          </View>
        ))}
      </Part>
    ) : null}
  </View>
);

// Sur la fiche de l'athlète, côté coach : ce qu'il a fait seul, s'il le partage. Lecture seule ; rien sans partage.
export const SharedHistorySection = ({ orgId, athleteId }: { orgId: string; athleteId: string }) => {
  const shared = useQuery({
    queryKey: ["shared-history", orgId, athleteId],
    queryFn: () => api.sharedHistory(orgId, athleteId),
    enabled: Boolean(orgId && athleteId),
  });
  const history = shared.data?.history;
  if (!history) return null;
  return (
    <View style={{ gap: space.sm }} testID="shared-history">
      <SectionTitle>{t.coachTitle}</SectionTitle>
      <SharedHistoryBody history={history} />
    </View>
  );
};
