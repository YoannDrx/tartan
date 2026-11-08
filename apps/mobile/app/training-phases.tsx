import {
  saveTrainingPhaseInput,
  trainingPhaseKind,
  trainingPhaseQuery,
  uuid,
  type SaveTrainingPhaseInput,
  type TrainingPhaseContext,
  type TrainingPhaseSummary,
} from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { usePreventRemove } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { NativePhaseList, useTrainingPhases } from "../src/features/training-phases";
import { api } from "../src/lib/api";
import { localIsoDate } from "../src/lib/dates";
import { errorMessage } from "../src/lib/errors";
import { useActiveSpace } from "../src/lib/queries";
import { Button, Field, SectionTitle, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";

const t = m.trainingPhases;
function PhaseForm({
  orgId,
  initial,
  shared,
  context,
  onDone,
}: {
  orgId: string;
  initial: SaveTrainingPhaseInput;
  shared: boolean;
  context: TrainingPhaseContext;
  onDone: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [search, setSearch] = useState("");
  const [choosing, setChoosing] = useState(!initial.target.id);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const navigation = useNavigation();
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  usePreventRemove(!saved && (dirty || busy), ({ data }) => {
    if (lock.current) return;
    Alert.alert(m.common.back, t.discarded, [
      { text: m.common.cancel, style: "cancel" },
      { text: m.common.yes, style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const options = [
    ...context.groups.map((g) => ({ ...g, type: "group" as const })),
    ...context.athletes.map((a) => ({ ...a, type: "athlete" as const })),
  ];
  const selected = options.find((o) => o.type === value.target.type && o.id === value.target.id);
  const matches = options.filter((o) => o.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")));
  const field = <K extends keyof SaveTrainingPhaseInput>(key: K, next: SaveTrainingPhaseInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  const save = async () => {
    if (lock.current || saved) return;
    const parsed = saveTrainingPhaseInput.safeParse(value);
    if (!parsed.success) {
      setIssues(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setError(t.invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    setIssues({});
    setError("");
    try {
      await api.saveTrainingPhase(orgId, parsed.data);
      setSaved(true);
      await onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{initial.expectedVersion ? t.edit : t.add}</SectionTitle>
      <T>{shared ? t.sharedEdit : t.defaultPrivate}</T>
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      <Button
        variant="secondary"
        label={selected ? `${t.target} : ${selected.name}` : t.chooseTarget}
        expanded={choosing}
        disabled={busy || saved}
        onPress={() => setChoosing(!choosing)}
      />
      {issues.target ? <T tone="danger">{issues.target}</T> : null}
      {choosing ? (
        <View style={{ gap: space.sm }}>
          <Field label={t.searchTarget} value={search} onChangeText={setSearch} editable={!busy && !saved} />
          {matches.map((o) => (
            <Button
              key={`${o.type}:${o.id}`}
              variant="secondary"
              label={`${o.name} · ${o.type === "group" ? t.group : t.athlete}`}
              selected={o.id === value.target.id && o.type === value.target.type}
              disabled={busy || saved}
              onPress={() => {
                field("target", { type: o.type, id: o.id });
                setChoosing(false);
              }}
            />
          ))}
        </View>
      ) : null}
      <Field
        label={t.name}
        value={value.name}
        onChangeText={(v) => field("name", v)}
        maxLength={100}
        editable={!busy && !saved}
        error={issues.name}
      />
      <T variant="smallStrong">{t.kind}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {trainingPhaseKind.options.map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            label={t.kinds[kind]}
            selected={value.kind === kind}
            disabled={busy || saved}
            onPress={() => field("kind", kind)}
          />
        ))}
      </View>
      <Field
        label={t.start}
        value={value.startDate}
        onChangeText={(v) => field("startDate", v)}
        hint={t.dateFormat}
        error={issues.startDate}
        editable={!busy && !saved}
      />
      <Field
        label={t.end}
        value={value.endDate}
        onChangeText={(v) => field("endDate", v)}
        hint={t.datesHint}
        error={issues.endDate}
        editable={!busy && !saved}
      />
      <Field
        label={t.objective}
        value={value.objective}
        onChangeText={(v) => field("objective", v)}
        maxLength={300}
        error={issues.objective}
        editable={!busy && !saved}
      />
      <Field
        label={t.description}
        value={value.description}
        onChangeText={(v) => field("description", v)}
        maxLength={4000}
        multiline
        error={issues.description}
        editable={!busy && !saved}
      />
      <Field
        label={t.privateNote}
        value={value.privateNote}
        onChangeText={(v) => field("privateNote", v)}
        maxLength={4000}
        multiline
        hint={t.privateHint}
        error={issues.privateNote}
        editable={!busy && !saved}
      />
      <Button label={m.common.save} onPress={() => void save()} loading={busy} disabled={saved} />
      <Button
        label={m.common.cancel}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          if (!dirty) void onDone();
          else
            Alert.alert(m.common.cancel, t.discarded, [
              { text: m.common.cancel, style: "cancel" },
              { text: m.common.yes, style: "destructive", onPress: () => void onDone() },
            ]);
        }}
      />
    </View>
  );
}
function PhasePanel({
  orgId,
  userId,
  canManage,
  initialFrom,
  initialTo,
  groupId,
}: {
  orgId: string;
  userId: string;
  canManage: boolean;
  initialFrom: string;
  initialTo: string;
  groupId?: string;
}) {
  const [dates, setDates] = useState({ from: initialFrom, to: initialTo });
  const [filter, setFilter] = useState(dates);
  const [targetFilter, setTargetFilter] = useState<SaveTrainingPhaseInput["target"] | null>(
    groupId ? { type: "group", id: groupId } : null,
  );
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const list = useTrainingPhases({
    ...filter,
    ...(targetFilter?.type === "group"
      ? { groupId: targetFilter.id }
      : targetFilter
        ? { athleteId: targetFilter.id }
        : {}),
  });
  const context = useQuery({
    queryKey: ["training-phase-context", orgId, userId],
    queryFn: () => api.trainingPhaseContext(orgId),
    enabled: canManage,
  });
  const client = useQueryClient();
  const targets = context.data
    ? [
        ...context.data.groups.map((g) => ({ ...g, type: "group" as const })),
        ...context.data.athletes.map((a) => ({ ...a, type: "athlete" as const })),
      ]
    : [];
  const targetName =
    targets.find((target) => target.type === targetFilter?.type && target.id === targetFilter.id)?.name ?? t.all;
  const [editing, setEditing] = useState<{ value: SaveTrainingPhaseInput; shared: boolean } | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["training-phases", orgId] });
  };
  const mutate = async (run: () => Promise<unknown>, success: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
      setMessage(success);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const edit = (phase?: TrainingPhaseSummary) => {
    setError("");
    setMessage("");
    setEditing({
      shared: phase?.shared ?? false,
      value: phase
        ? {
            id: phase.id,
            expectedVersion: phase.version,
            target: phase.target,
            name: phase.name,
            kind: phase.kind,
            startDate: phase.startDate,
            endDate: phase.endDate,
            objective: phase.objective,
            description: phase.description,
            privateNote: phase.privateNote ?? "",
          }
        : {
            id: randomUUID(),
            expectedVersion: 0,
            target: targetFilter ?? { type: "group", id: "" },
            name: "",
            kind: "general",
            startDate: filter.from,
            endDate: filter.to,
            objective: "",
            description: "",
            privateNote: "",
          },
    });
  };
  if (canManage && editing && context.data && !context.isError)
    return (
      <PhaseForm
        key={editing.value.id}
        orgId={orgId}
        initial={editing.value}
        shared={editing.shared}
        context={context.data}
        onDone={async () => {
          setEditing(null);
          await refresh();
        }}
      />
    );
  return (
    <View style={{ gap: space.md }}>
      {canManage && context.data && !context.isError ? (
        <>
          <Button
            label={`${t.target} : ${targetName}`}
            variant="secondary"
            expanded={choosingTarget}
            onPress={() => setChoosingTarget(!choosingTarget)}
          />
          {choosingTarget ? (
            <View style={{ gap: space.sm }}>
              <Field label={t.searchTarget} value={targetSearch} onChangeText={setTargetSearch} />
              <Button
                label={t.all}
                variant="secondary"
                selected={!targetFilter}
                onPress={() => {
                  setTargetFilter(null);
                  setChoosingTarget(false);
                }}
              />
              {targets
                .filter((target) =>
                  target.name.toLocaleLowerCase("fr").includes(targetSearch.trim().toLocaleLowerCase("fr")),
                )
                .map((target) => (
                  <Button
                    key={`${target.type}:${target.id}`}
                    label={`${target.name} · ${target.type === "group" ? t.group : t.athlete}`}
                    variant="secondary"
                    selected={target.type === targetFilter?.type && target.id === targetFilter.id}
                    onPress={() => {
                      setTargetFilter({ type: target.type, id: target.id });
                      setChoosingTarget(false);
                    }}
                  />
                ))}
            </View>
          ) : null}
        </>
      ) : null}
      <Field
        label={t.start}
        value={dates.from}
        onChangeText={(from) => setDates({ ...dates, from })}
        hint={t.dateFormat}
      />
      <Field label={t.end} value={dates.to} onChangeText={(to) => setDates({ ...dates, to })} hint={t.dateFormat} />
      <Button
        label={t.filter}
        variant="secondary"
        onPress={() => {
          if (trainingPhaseQuery.safeParse(dates).success) {
            setFilter(dates);
            setError("");
          } else setError(t.invalid);
        }}
      />
      {canManage && context.data && !context.isError ? (
        <Button label={t.add} disabled={busy} onPress={() => edit()} />
      ) : null}
      {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      {list.isPending || (canManage && context.isPending) ? <LoadingState /> : null}
      {context.isError ? <ErrorState error={context.error} onRetry={() => void context.refetch()} /> : null}
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {list.data && !list.isError ? (
        <NativePhaseList
          phases={list.data.phases}
          from={filter.from}
          to={filter.to}
          today={localIsoDate()}
          actions={
            canManage && context.data && !context.isError
              ? (phase) => (
                  <>
                    <Button label={m.common.edit} variant="secondary" disabled={busy} onPress={() => edit(phase)} />
                    <Button
                      label={phase.shared ? t.unpublish : t.publish}
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          phase.shared ? t.unpublish : t.publish,
                          phase.shared ? t.unpublishConfirm : t.publishConfirm,
                          [
                            { text: m.common.cancel, style: "cancel" },
                            {
                              text: phase.shared ? t.unpublish : t.publish,
                              onPress: () =>
                                void mutate(
                                  () => api.setTrainingPhaseVisibility(orgId, phase.id, phase.version, !phase.shared),
                                  t.visibilitySaved,
                                ),
                            },
                          ],
                        )
                      }
                    />
                    <Button
                      label={m.common.delete}
                      variant="ghost"
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(m.common.delete, t.deleteConfirm, [
                          { text: m.common.cancel, style: "cancel" },
                          {
                            text: m.common.delete,
                            style: "destructive",
                            onPress: () =>
                              void mutate(() => api.deleteTrainingPhase(orgId, phase.id, phase.version), t.deleted),
                          },
                        ])
                      }
                    />
                  </>
                )
              : undefined
          }
        />
      ) : null}
    </View>
  );
}
export default function TrainingPhasesScreen() {
  const { orgId, space: active, me } = useActiveSpace();
  const params = useLocalSearchParams<{ from?: string; to?: string; groupId?: string }>();
  const today = localIsoDate();
  const query = trainingPhaseQuery.safeParse({
    from: params.from ?? today,
    to: params.to ?? addDays(today, 83),
    groupId: params.groupId,
  });
  const valid = query.success && (!params.groupId || uuid.safeParse(params.groupId).success);
  return (
    <StackScreen title={t.title} world="work">
      {!active ? (
        <LoadingState />
      ) : !active.phasesEnabled ? (
        <T>{t.disabled}</T>
      ) : !valid || !query.success ? (
        <T>{t.invalid}</T>
      ) : (
        <PhasePanel
          key={`${orgId}:${me.data?.id}:${active.role}:${params.groupId ?? ""}`}
          orgId={orgId}
          userId={me.data!.id}
          canManage={active.role === "owner" || active.role === "coach"}
          initialFrom={query.data.from}
          initialTo={query.data.to}
          groupId={query.data.groupId}
        />
      )}
    </StackScreen>
  );
}
