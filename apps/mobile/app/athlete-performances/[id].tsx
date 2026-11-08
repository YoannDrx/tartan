import { DateField } from "../../src/ui/date-field";
import { performanceInput, updatePerformanceInput, type PerformanceEntry } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../../src/lib/api";
import { localIsoDate } from "../../src/lib/dates";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace, useCoachAthleteFile } from "../../src/lib/queries";
import { Button, Card, Field, SectionTitle, T, Tag } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const Form = ({
  orgId,
  athleteId,
  initial,
  onSaved,
  onCancel,
}: {
  orgId: string;
  athleteId: string;
  initial?: PerformanceEntry;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) => {
  const [discipline, setDiscipline] = useState(initial?.discipline ?? "");
  const [mark, setMark] = useState(initial ? String(initial.mark) : "");
  const [unit, setUnit] = useState<"s" | "m" | "cm" | "">(
    initial ? (initial.unit === "s" ? "s" : initial.unit === "cm" ? "cm" : initial.unit === "m" ? "m" : "") : "m",
  );
  const [date, setDate] = useState(initial?.date ?? localIsoDate());
  const [location, setLocation] = useState(initial?.location ?? "");
  const [context, setContext] = useState(initial?.comparisonContext ?? "");
  const [wind, setWind] = useState(initial?.wind == null ? "" : String(initial.wind));
  const [clientId] = useState(randomUUID);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigation = useNavigation();
  const initialValues = useRef(JSON.stringify([discipline, mark, unit, date, location, context, wind]));
  const dirty = JSON.stringify([discipline, mark, unit, date, location, context, wind]) !== initialValues.current;
  usePreventRemove(!saved && (saving || dirty), ({ data }) => {
    if (busy.current) return;
    Alert.alert(m.common.back, m.performances.discarded, [
      { text: m.common.cancel, style: "cancel" },
      { text: m.common.yes, style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const save = async () => {
    if (busy.current || saved) return;
    const raw = {
      athleteId,
      discipline,
      mark: mark.trim() ? Number(mark.replace(",", ".")) : NaN,
      unit,
      measurementType: unit === "s" ? "time" : "distance",
      recordDirection: unit === "s" ? "lower" : "higher",
      date,
      location: location || null,
      comparisonContext: context,
      wind: wind.trim() ? Number(wind.replace(",", ".")) : null,
      competitionId: initial?.competitionId ?? null,
    };
    const parsed = initial
      ? updatePerformanceInput.safeParse({ ...raw, id: initial.id, expectedVersion: initial.version })
      : performanceInput.safeParse({ ...raw, clientId });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setMessage(m.performances.invalid);
      return;
    }
    setErrors({});
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      if (initial && "expectedVersion" in parsed.data) {
        const { athleteId: _athlete, id, ...body } = parsed.data;
        await api.updatePerformance(orgId, athleteId, id, body);
      } else {
        const { athleteId: _athlete, ...body } = parsed.data;
        await api.addPerformance(orgId, athleteId, { ...body, clientId });
      }
      setSaved(true);
      setMessage(m.performances.saved);
      await onSaved();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <SectionTitle>{initial ? m.performances.edit : m.performances.add}</SectionTitle>
        {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
        <Field
          error={errors.discipline}
          label={m.performances.discipline}
          value={discipline}
          onChangeText={setDiscipline}
          maxLength={40}
          editable={!saving && !saved}
        />
        <T variant="smallStrong">{m.performances.measurement}</T>
        <Button
          label={m.performances.time}
          selected={unit === "s"}
          variant="secondary"
          disabled={saving || saved}
          onPress={() => setUnit("s")}
        />
        <Button
          label={m.performances.distance}
          selected={unit === "m" || unit === "cm"}
          variant="secondary"
          disabled={saving || saved}
          onPress={() => setUnit("m")}
        />
        <Field
          error={errors.mark}
          label={m.performances.mark}
          keyboardType="decimal-pad"
          value={mark}
          onChangeText={setMark}
          editable={!saving && !saved}
        />
        {unit === "s" ? (
          <T>s</T>
        ) : (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {(["m", "cm"] as const).map((value) => (
              <Button
                key={value}
                label={value}
                selected={unit === value}
                variant="secondary"
                disabled={saving || saved}
                onPress={() => setUnit(value)}
              />
            ))}
          </View>
        )}
        <Field
          error={errors.comparisonContext}
          label={m.performances.context}
          value={context}
          onChangeText={setContext}
          maxLength={80}
          hint={m.performances.contextHint}
          editable={!saving && !saved}
        />
        <Field
          error={errors.wind}
          label={m.performances.wind}
          keyboardType="numbers-and-punctuation"
          value={wind}
          onChangeText={setWind}
          editable={!saving && !saved}
        />
        <DateField
          error={errors.date}
          label={m.builder.date}
          value={date}
          onChangeText={setDate}
          editable={!saving && !saved}
        />
        <Field
          error={errors.location}
          label={m.builder.location}
          value={location}
          onChangeText={setLocation}
          maxLength={120}
          editable={!saving && !saved}
        />
        <Button
          label={m.common.save}
          loading={saving}
          disabled={saved || !unit || Boolean(initial && !initial.version)}
          onPress={() => void save()}
        />
        <Button
          label={m.common.cancel}
          variant="secondary"
          disabled={saving}
          onPress={() =>
            Alert.alert(m.common.cancel, m.performances.discarded, [
              { text: m.common.cancel, style: "cancel" },
              { text: m.common.yes, onPress: onCancel },
            ])
          }
        />
      </View>
    </Card>
  );
};

const Panel = ({ orgId, athleteId }: { orgId: string; athleteId: string }) => {
  const file = useCoachAthleteFile(orgId, athleteId);
  const client = useQueryClient();
  const [editing, setEditing] = useState<PerformanceEntry | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const pending = useRef(false);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["coach-athlete", orgId, athleteId] }),
      client.invalidateQueries({ queryKey: ["athlete-file", orgId] }),
    ]);
  };
  const remove = (row: PerformanceEntry) =>
    Alert.alert(m.common.delete, m.performances.deleteConfirm, [
      { text: m.common.cancel, style: "cancel" },
      {
        text: m.common.delete,
        style: "destructive",
        onPress: async () => {
          if (pending.current || !row.version) return;
          pending.current = true;
          setDeleting(true);
          setMessage("");
          try {
            await api.deletePerformance(orgId, athleteId, row.id, row.version);
            await refresh();
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            pending.current = false;
            setDeleting(false);
          }
        },
      },
    ]);
  if (file.isPending) return <LoadingState />;
  if (file.isError || !file.data) return <ErrorState error={file.error} onRetry={() => void file.refetch()} />;
  return (
    <View style={{ gap: space.lg }}>
      <SectionTitle>{`${file.data.firstName} ${file.data.lastName}`}</SectionTitle>
      {editing ? (
        <Form
          key={editing === "new" ? "new" : `${editing.id}-${editing.version}`}
          orgId={orgId}
          athleteId={athleteId}
          initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
            setMessage(m.performances.saved);
          }}
        />
      ) : (
        <Button
          label={m.performances.add}
          disabled={deleting}
          onPress={() => {
            setMessage("");
            setEditing("new");
          }}
        />
      )}
      {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
      {file.data.performances.map((row) => (
        <Card key={row.id}>
          <View style={{ gap: space.sm }}>
            <T heading variant="title2">
              {row.discipline}
            </T>
            <T variant="figure">{`${String(row.mark).replace(".", ",")} ${row.unit}`}</T>
            <T>{[row.date, row.location, row.comparisonContext].filter(Boolean).join(" · ")}</T>
            <T>
              {row.recordDirection === "lower"
                ? m.performances.lower
                : row.recordDirection === "higher"
                  ? m.performances.higher
                  : m.performances.unknown}
            </T>
            {row.isBaseline ? (
              <Tag label={m.performances.baseline} />
            ) : row.isPb ? (
              <Tag label={m.athletes.record} tone="brand" />
            ) : null}
            <Button
              label={m.performances.edit}
              variant="secondary"
              disabled={Boolean(editing) || deleting || !row.version}
              onPress={() => setEditing(row)}
            />
            <Button
              label={m.common.delete}
              variant="danger"
              disabled={Boolean(editing) || deleting || !row.version}
              onPress={() => remove(row)}
            />
          </View>
        </Card>
      ))}
    </View>
  );
};
export default function AthletePerformances() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orgId, me, space: active } = useActiveSpace();
  const allowed = active?.role === "owner" || active?.role === "coach";
  return (
    <StackScreen world="work" title={m.performances.title}>
      {orgId && id && allowed ? (
        <Panel key={`${me.data?.id}/${orgId}/${id}`} orgId={orgId} athleteId={id} />
      ) : (
        <T>{m.errors.forbidden}</T>
      )}
    </StackScreen>
  );
}
