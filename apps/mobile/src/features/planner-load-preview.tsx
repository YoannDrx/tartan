import { useQuery } from "@tanstack/react-query";
import { plannerReviewedDraft, type PlannerReviewedDraft, type Prescription } from "@tartan/contracts";
import { formatPrescription } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { Button, Divider, Field, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";

const t = m.aiPlanner;
export function PlannerLoadPreview({
  orgId,
  proposalId,
  version,
  session,
  disabled,
  onReady,
  onLoad,
}: {
  orgId: string;
  proposalId: string;
  version: number;
  session: PlannerReviewedDraft;
  disabled: boolean;
  onReady: (ready: boolean) => void;
  onLoad: (athleteId: string, itemRef: string, load: Prescription["load"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{
    athleteId: string;
    itemRef: string;
    exerciseId: string;
    title: string;
  } | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"kg" | "pct_1rm">("kg");
  const [error, setError] = useState("");
  const requestValid = plannerReviewedDraft.safeParse(session).success;
  const data = useQuery({
    queryKey: ["planner-loads", orgId, proposalId, version, session, cursors[page]],
    queryFn: ({ signal }) =>
      api.previewPlannerLoads(
        orgId,
        proposalId,
        { expectedVersion: version, session, afterAthleteId: cursors[page] },
        signal,
      ),
    enabled: open && requestValid,
    retry: false,
    networkMode: "always",
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    onReady(Boolean(requestValid && data.data && !data.isError && !data.isFetching));
  }, [requestValid, data.data, data.isError, data.isFetching, onReady]);
  useEffect(() => () => onReady(false), [onReady]);
  const apply = () => {
    if (!editing) return;
    const number = Number(value.trim().replace(",", "."));
    if (
      !value.trim() ||
      !Number.isFinite(number) ||
      number < (unit === "kg" ? 0 : 1) ||
      number > (unit === "kg" ? 1000 : 150)
    ) {
      setError(m.errors.invalid);
      return;
    }
    onLoad(
      editing.athleteId,
      editing.itemRef,
      unit === "kg"
        ? { type: "kg", value: number }
        : { type: "pct_1rm", value: number, test: `exercise:${editing.exerciseId}` },
    );
    setEditing(null);
  };
  const current = requestValid && !data.isError && !data.isFetching ? data.data : undefined;
  return (
    <View style={{ gap: space.sm }}>
      <Button
        variant="secondary"
        label={t.previewLoads}
        expanded={open}
        disabled={disabled || !requestValid}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <>
          <T>{t.previewProvisional}</T>
          {data.isPending || data.isFetching ? <LoadingState /> : null}
          {data.isError ? (
            <ErrorState
              error={data.error}
              onRetry={() => {
                void data.refetch();
              }}
            />
          ) : null}
          {current ? (
            <>
              <T>{t.previewCoverage(current.offset + current.athletes.length, current.athleteCount)}</T>
              {current.athletes.map((athlete) => (
                <View key={athlete.id} style={{ gap: space.sm }}>
                  <Divider />
                  <T variant="bodyStrong">{athlete.name}</T>
                  {athlete.items.map((item) => {
                    const sourceKind = item.source?.kind;
                    const sourceLabel =
                      sourceKind && sourceKind in m.strength.referenceKinds
                        ? m.strength.referenceKinds[sourceKind as keyof typeof m.strength.referenceKinds]
                        : t.referenceSource;
                    return (
                      <View key={item.ref} style={{ gap: space.xs }}>
                        <T variant="smallStrong">{item.name}</T>
                        <T>{formatPrescription(item.prescription, item.resolvedLoadKg)}</T>
                        {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg !== null ? (
                          <T variant="small" tone="muted">
                            {item.prescription.load.value} {m.builder.loadPct}
                          </T>
                        ) : null}
                        {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null ? (
                          <T>{t.loadUndefined}</T>
                        ) : null}
                        {item.source ? (
                          <T variant="small" tone="muted">
                            {sourceLabel} : {item.source.value} kg · {item.source.date}
                          </T>
                        ) : null}
                        <Button
                          variant="secondary"
                          label={t.adaptLoad}
                          disabled={disabled}
                          onPress={() => {
                            setEditing({
                              athleteId: athlete.id,
                              itemRef: item.ref,
                              exerciseId: item.exerciseId,
                              title: `${athlete.name} · ${item.name}`,
                            });
                            setUnit(item.prescription.load?.type ?? "kg");
                            setValue(item.prescription.load?.value.toString() ?? "");
                            setError("");
                          }}
                        />
                        {session.overrides.some(
                          (o) => o.athleteId === athlete.id && o.itemRef === item.ref && o.prescription.load,
                        ) ? (
                          <Button
                            variant="ghost"
                            label={t.resetLoad}
                            disabled={disabled}
                            onPress={() => onLoad(athlete.id, item.ref, undefined)}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
              {page > 0 ? (
                <Button
                  variant="secondary"
                  label={t.previousAthletes}
                  disabled={disabled}
                  onPress={() => setPage((p) => p - 1)}
                />
              ) : null}
              {current.nextCursor ? (
                <Button
                  variant="secondary"
                  label={t.nextAthletes}
                  disabled={disabled}
                  onPress={() => {
                    setCursors((old) => [...old.slice(0, page + 1), current.nextCursor!]);
                    setPage((p) => p + 1);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {editing ? (
        <Sheet
          visible
          title={t.adaptLoad}
          onClose={() => setEditing(null)}
          footer={<Button label={m.nativeBuilder.apply} disabled={disabled} onPress={apply} />}
        >
          <T>{editing.title}</T>
          <T>{t.noAutomaticLoad}</T>
          <Button variant="secondary" label={m.builder.loadKg} selected={unit === "kg"} onPress={() => setUnit("kg")} />
          <Button
            variant="secondary"
            label={m.builder.loadPct}
            selected={unit === "pct_1rm"}
            onPress={() => setUnit("pct_1rm")}
          />
          <Field
            label={m.builder.load}
            value={value}
            keyboardType="decimal-pad"
            onChangeText={setValue}
            error={error}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
