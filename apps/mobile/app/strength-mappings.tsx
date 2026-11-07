import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  legacyStrengthKey,
  legacyStrengthMappingInput,
  type ExerciseSummary,
  type StrengthMappingReport,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { api } from "../src/lib/api";
import { errorMessage } from "../src/lib/errors";
import { useActiveSpace, useExercises } from "../src/lib/queries";
import { Button, Card, Field, SectionTitle, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";

const label = (key: string) =>
  legacyStrengthKey.safeParse(key).success ? m.strengthTest[key as keyof typeof m.strengthTest] : key;

const MappingRow = ({
  row,
  exercises,
  orgId,
  onSaved,
}: {
  row: StrengthMappingReport["unmapped"][number];
  exercises: ExerciseSummary[];
  orgId: string;
  onSaved: (report: StrengthMappingReport) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const exercise = exercises.find((item) => item.id === exerciseId);
  const eligible = legacyStrengthKey.safeParse(row.legacyKey).success;
  const filtered = exercises.filter((item) =>
    item.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")),
  );
  const confirm = () => {
    setShowIssues(true);
    setError("");
    const input = legacyStrengthMappingInput.safeParse({
      legacyKey: row.legacyKey,
      exerciseId,
      reason,
      confirmed: checked,
    });
    if (!input.success || !exercise) {
      return;
    }
    Alert.alert(
      m.strengthMapping.confirm,
      m.strengthMapping.confirmDetail(
        label(row.legacyKey),
        exercise.name,
        m.strength.conventions[exercise.strengthLoadKind!],
        row.count,
      ),
      [
        { text: m.common.cancel, style: "cancel" },
        {
          text: m.strengthMapping.confirm,
          onPress: () => {
            setBusy(true);
            setError("");
            void api
              .confirmStrengthMapping(orgId, input.data)
              .then(onSaved)
              .catch((cause) => setError(errorMessage(cause)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <T heading variant="title2">
          {label(row.legacyKey)}
        </T>
        <T>{m.strengthMapping.count(row.count)}</T>
        {!eligible ? (
          <T>{m.strengthMapping.unknown}</T>
        ) : !open ? (
          <Button
            variant="secondary"
            label={m.strengthMapping.choose}
            disabled={!exercises.length}
            onPress={() => setOpen(true)}
          />
        ) : (
          <>
            {exercise ? (
              <>
                <T variant="smallStrong">{exercise.name}</T>
                <T>{m.strength.conventions[exercise.strengthLoadKind!]}</T>
                {exercise.cues.map((cue, index) => (
                  <T key={index}>{cue}</T>
                ))}
                <Button
                  disabled={busy}
                  variant="secondary"
                  label={m.strength.changeExercise}
                  onPress={() => {
                    setExerciseId("");
                    setChecked(false);
                  }}
                />
              </>
            ) : (
              <>
                <Field
                  label={m.strength.exerciseSearch}
                  error={showIssues && !exercise ? m.strengthMapping.invalid : undefined}
                  value={search}
                  onChangeText={setSearch}
                  editable={!busy}
                />
                {!filtered.length ? <T>{m.strength.noMatch}</T> : null}
                {filtered.map((item) => (
                  <Button
                    key={item.id}
                    variant="secondary"
                    disabled={busy}
                    label={`${item.name} · ${m.strength.conventions[item.strengthLoadKind!]}`}
                    onPress={() => {
                      setExerciseId(item.id);
                      setChecked(false);
                    }}
                  />
                ))}
              </>
            )}
            <Field
              label={m.strengthMapping.reason}
              error={
                showIssues && (reason.trim().length < 10 || reason.trim().length > 500)
                  ? m.strengthMapping.reasonError
                  : undefined
              }
              value={reason}
              onChangeText={setReason}
              editable={!busy}
              multiline
              maxLength={500}
            />
            <T variant="caption">{m.strengthMapping.reasonHint}</T>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={m.strengthMapping.check}
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => setChecked(!checked)}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <T>
                {m.strengthMapping.check} : {checked ? m.common.yes : m.common.no}
              </T>
            </Pressable>
            {showIssues && !checked ? (
              <T accessibilityRole="alert" tone="danger">
                {m.strengthMapping.invalid}
              </T>
            ) : null}
            <Button label={m.strengthMapping.confirm} loading={busy} disabled={busy} onPress={confirm} />
            {error ? (
              <T accessibilityRole="alert" tone="danger">
                {error}
              </T>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
};

const MappingsScreen = ({ orgId }: { orgId: string }) => {
  const client = useQueryClient();
  const router = useRouter();
  const report = useQuery({ queryKey: ["strength-mappings", orgId], queryFn: () => api.strengthMappings(orgId) });
  const exercises = useExercises(orgId);
  const [saved, setSaved] = useState(false);
  const compatible = (exercises.data ?? []).filter(
    (item) => item.strengthLoadKind === "external_total" || item.strengthLoadKind === "added_weight",
  );
  return (
    <StackScreen world="work" title={m.strengthMapping.title}>
      {report.isPending || exercises.isPending ? (
        <LoadingState />
      ) : report.isError || exercises.isError ? (
        <ErrorState
          error={report.error ?? exercises.error}
          onRetry={() => {
            void report.refetch();
            void exercises.refetch();
          }}
        />
      ) : (
        <>
          <T>{m.strengthMapping.lead}</T>
          <T>{m.strengthMapping.warning}</T>
          <T>{m.strengthMapping.referenceWarning}</T>
          {saved ? <T accessibilityLiveRegion="polite">{m.strengthMapping.saved}</T> : null}
          <Button variant="secondary" label={m.strengthMapping.athletes} onPress={() => router.push("/athletes")} />
          <SectionTitle>{m.strengthMapping.pending}</SectionTitle>
          {!report.data.unmapped.length ? <T>{m.strengthMapping.empty}</T> : null}
          {!compatible.length && report.data.unmapped.length ? (
            <>
              <T>{m.strength.noCompatibleExercise}</T>
              <Button label={m.strength.openLibrary} onPress={() => router.push("/exercises")} />
            </>
          ) : null}
          {report.data.unmapped.map((row) => (
            <MappingRow
              key={row.legacyKey}
              row={row}
              exercises={compatible}
              orgId={orgId}
              onSaved={(next) => {
                client.setQueryData(["strength-mappings", orgId], next);
                setSaved(true);
                for (const key of ["coach-athlete", "exercise-strength", "session-builder"])
                  void client.invalidateQueries({ queryKey: [key, orgId] });
              }}
            />
          ))}
          <SectionTitle>{m.strengthMapping.confirmed}</SectionTitle>
          {!report.data.mappings.length ? <T>{m.strengthMapping.noConfirmed}</T> : null}
          {report.data.mappings.map((mapping) => (
            <Card key={mapping.legacyKey}>
              <View style={{ gap: space.sm }}>
                <T variant="smallStrong">
                  {label(mapping.legacyKey)} → {mapping.exerciseName}
                </T>
                <T>
                  {mapping.loadKind && mapping.loadKind in m.strength.conventions
                    ? m.strength.conventions[mapping.loadKind as keyof typeof m.strength.conventions]
                    : m.strength.unknownConvention}
                </T>
                <T>{mapping.reason}</T>
              </View>
            </Card>
          ))}
        </>
      )}
    </StackScreen>
  );
};

export default function StrengthMappings() {
  const { me, orgId, space: active } = useActiveSpace();
  if (me.isPending)
    return (
      <StackScreen title={m.strengthMapping.title}>
        <LoadingState />
      </StackScreen>
    );
  if (active?.role !== "owner")
    return (
      <StackScreen title={m.strengthMapping.title}>
        <T>{m.common.forbidden}</T>
      </StackScreen>
    );
  if (!active.progressionEnabled)
    return (
      <StackScreen title={m.strengthMapping.title}>
        <T>{m.progression.disabled}</T>
      </StackScreen>
    );
  return <MappingsScreen key={orgId} orgId={orgId} />;
}
