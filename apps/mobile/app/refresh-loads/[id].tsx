import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PrescriptionRefreshPreview } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace } from "../../src/lib/queries";
import { Button, Card, Divider, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

type LoadState = PrescriptionRefreshPreview["athletes"][number]["changes"][number]["before"];
const LoadValue = ({ value, label }: { value: LoadState; label: string }) => {
  const ref = value.reference;
  const origin = ref?.originKind ?? ref?.kind;
  const kind =
    origin === "one_rm"
      ? m.strength.referenceKinds.tested
      : origin === "three_rm"
        ? m.prescriptionRefresh.threeRm
        : ref?.originKind && ref.originKind in m.strength.referenceKinds
          ? m.strength.referenceKinds[ref.originKind as keyof typeof m.strength.referenceKinds]
          : m.prescriptionRefresh.legacy;
  return (
    <View style={{ gap: space.xs }}>
      <T variant="caption">{label}</T>
      <T variant="title2">
        {value.kg === null ? m.prescriptionRefresh.missing : `${String(value.kg).replace(".", ",")} kg`}
      </T>
      {ref ? (
        <T variant="caption">{m.prescriptionRefresh.source(ref.value, kind, ref.date, ref.stepKg ?? 1.25)}</T>
      ) : null}
    </View>
  );
};

const RefreshEditor = ({ orgId, id }: { orgId: string; id: string }) => {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const detail = useQuery({
    queryKey: ["prescription-refresh", orgId, id],
    queryFn: () => api.previewPrescriptionRefresh(orgId, id),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const preview = detail.data;
  const count = preview?.athletes.filter((a) => a.status === "ready").length ?? 0;
  const save = async (reviewed: PrescriptionRefreshPreview) => {
    if (!mounted.current || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.refreshPublishedLoads(orgId, id, {
        expectedVersion: reviewed.sessionVersion,
        token: reviewed.token,
        confirmed: true,
      });
      setSaved(true);
      for (const key of [
        "coach-session",
        "coach-athlete-log",
        "coach-calendar",
        "tracking",
        "session",
        "prescription-refresh",
      ])
        void client.invalidateQueries({ queryKey: [key, orgId] });
    } catch (cause) {
      setError(errorMessage(cause));
      setStale(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const confirm = () => {
    if (!preview || stale || pending.current || !count) return;
    Alert.alert(m.prescriptionRefresh.title, m.prescriptionRefresh.confirmDetail(count), [
      { text: m.common.cancel, style: "cancel" },
      { text: m.prescriptionRefresh.confirm, onPress: () => void save(preview) },
    ]);
  };
  if (saved)
    return (
      <View style={{ gap: space.md }}>
        <T accessibilityLiveRegion="polite">{m.prescriptionRefresh.saved}</T>
        <Button
          label={m.prescriptionRefresh.back}
          onPress={() => router.replace({ pathname: "/coach-session/[id]", params: { id } })}
        />
      </View>
    );
  if (detail.isPending) return <LoadingState />;
  if (!preview) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  return (
    <View style={{ gap: space.lg }}>
      <T>{m.prescriptionRefresh.lead}</T>
      <T variant="smallStrong">{m.prescriptionRefresh.summary(count, preview.athletes.length)}</T>
      {preview.athletes.map((athlete) => (
        <Card key={athlete.athleteId}>
          <View style={{ gap: space.md }}>
            <T heading variant="title2">
              {athlete.name}
            </T>
            <T>{m.prescriptionRefresh.status[athlete.status]}</T>
            {athlete.changes.map((change) => (
              <View key={change.itemRef} style={{ gap: space.md }}>
                <Divider />
                <T variant="smallStrong">
                  {change.exerciseName} · {change.percentage} %
                </T>
                <LoadValue value={change.before} label={m.prescriptionRefresh.before} />
                <LoadValue value={change.after} label={m.prescriptionRefresh.after} />
              </View>
            ))}
            {athlete.incompatible.map((item) => (
              <T key={item.itemRef}>
                {item.exerciseName} : {m.prescriptionRefresh.incompatible}
              </T>
            ))}
          </View>
        </Card>
      ))}
      {error ? (
        <T accessibilityLiveRegion="assertive" tone="danger">
          {error}
        </T>
      ) : null}
      {!count ? <T>{m.prescriptionRefresh.empty}</T> : null}
      <Button
        label={m.prescriptionRefresh.reload}
        variant="secondary"
        disabled={busy || detail.isFetching}
        onPress={() => {
          setStale(true);
          void detail.refetch().then((result) => {
            if (result.isSuccess) {
              setStale(false);
              setError("");
            } else setError(errorMessage(result.error));
          });
        }}
      />
      <Button
        label={m.prescriptionRefresh.confirm}
        loading={busy}
        disabled={!count || stale || detail.isFetching}
        onPress={confirm}
      />
    </View>
  );
};

export default function RefreshLoads() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space: active, orgId, me } = useActiveSpace();
  const staff = active && ["owner", "coach", "assistant"].includes(active.role);
  return (
    <StackScreen title={m.prescriptionRefresh.title}>
      {me.isPending ? (
        <LoadingState />
      ) : !id || !orgId ? (
        <T>{m.common.notFound}</T>
      ) : !staff ? (
        <T>{m.errors.forbidden}</T>
      ) : !active?.progressionEnabled ? (
        <T>{m.progression.disabled}</T>
      ) : (
        <RefreshEditor key={`${orgId}.${id}.${me.data?.id}`} orgId={orgId} id={id} />
      )}
    </StackScreen>
  );
}
