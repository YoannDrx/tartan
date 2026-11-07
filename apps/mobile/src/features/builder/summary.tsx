import type { Prescription, SaveScheduledSessionInput } from "@tartan/contracts";
import { m, strengthTestLabel } from "@tartan/i18n";
import { View } from "react-native";
import type { BuilderDraft } from "./draft-storage";
import type { api } from "../../lib/api";
import { Divider, T } from "../../ui/primitives";
import { space } from "../../ui/theme";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
const PrescriptionSummary = ({ value, context }: { value: Prescription; context: Context }) => {
  const labels = {
    sets: m.builder.sets,
    reps: m.builder.reps,
    unit: m.nativeBuilder.unit,
    count: m.nativeBuilder.count,
    height_cm: m.nativeBuilder.height,
    distance_m: m.builder.distance,
    duration_s: m.builder.durationS,
    rest_s: m.builder.rest,
    tempo: m.builder.tempo,
    ground_contacts: m.builder.contacts,
    notes: m.builder.notes,
  };
  const load = value.load;
  const reference =
    load?.type === "pct_1rm"
      ? (context.exercises.find((e) => `exercise:${e.id}` === load.test)?.name ?? strengthTestLabel(load.test))
      : null;
  return (
    <View style={{ gap: space.xs }}>
      {Object.entries(labels).map(([key, label]) => {
        const v = value[key as keyof typeof labels];
        return v === undefined ? null : (
          <T key={key} variant="caption">
            {label} : {String(v).replace(/^(\d+)\.(\d+)$/, "$1,$2")}
          </T>
        );
      })}
      {load ? (
        <T variant="caption">
          {m.builder.load} : {String(load.value).replace(".", ",")}{" "}
          {load.type === "kg" ? m.builder.loadKg : m.builder.loadPct}
          {reference ? ` · ${reference}` : ""}
        </T>
      ) : null}
      {value.intensityTarget ? (
        <T variant="caption">
          {m.nativeBuilder.intensity} : {value.intensityTarget.type.toUpperCase()} {value.intensityTarget.value}
        </T>
      ) : null}
    </View>
  );
};
export const BuilderSummary = ({
  form,
  duration,
  context,
  pendingPrescription,
}: {
  form: SaveScheduledSessionInput;
  duration: string;
  context: Context;
  pendingPrescription?: BuilderDraft["prescription"];
}) => {
  const athleteName = (id: string) => {
    const a = context.athletes.find((x) => x.id === id);
    return a ? `${a.firstName} ${a.lastName}` : m.common.notFound;
  };
  return (
    <View style={{ gap: space.md }}>
      <T variant="title2">{form.draft.title || m.builder.title}</T>
      <T>
        {m.sessionType[form.draft.type]} · {form.date} {form.startTime ?? ""}
      </T>
      {form.location ? (
        <T>
          {m.builder.location} : {form.location}
        </T>
      ) : null}
      {duration ? (
        <T>
          {m.builder.duration} : {duration}
        </T>
      ) : null}
      {form.draft.coachNote ? (
        <T>
          {m.builder.coachNote} : {form.draft.coachNote}
        </T>
      ) : null}
      <T>
        {m.builder.audience} :{" "}
        {form.assignments
          .map((a) =>
            a.targetType === "athlete"
              ? athleteName(a.targetId)
              : (context.groups.find((g) => g.id === a.targetId)?.name ?? m.common.notFound),
          )
          .join(", ") || m.builder.noAudience}
      </T>
      {form.publishAt ? (
        <T>
          {m.builder.scheduleAt} : {form.publishAt.replace("T", " · ")}
        </T>
      ) : null}
      {form.draft.blocks.map((b) => (
        <View key={b.ref} style={{ gap: space.sm }}>
          <Divider />
          <T variant="bodyStrong">
            {b.name} ·{" "}
            {b.variant === "club"
              ? m.builder.versionClub
              : b.variant === "autonomous"
                ? m.builder.versionAutonomous
                : m.nativeBuilder.both}
          </T>
          {b.items.map((item) => (
            <View key={item.ref} style={{ gap: space.sm }}>
              <T variant="smallStrong">
                {context.exercises.find((e) => e.id === item.exerciseId)?.name ?? m.common.notFound}
              </T>
              <PrescriptionSummary value={item.prescription} context={context} />
              {form.overrides
                .filter((o) => o.itemRef === item.ref)
                .map((o) => (
                  <View key={o.athleteId}>
                    <T variant="smallStrong">
                      {m.builder.adjustments} · {athleteName(o.athleteId)}
                    </T>
                    <PrescriptionSummary value={o.prescription} context={context} />
                  </View>
                ))}
            </View>
          ))}
        </View>
      ))}
      {pendingPrescription ? (
        <View style={{ gap: space.sm }}>
          <Divider />
          <T heading variant="title2">
            {m.nativeBuilder.pendingPrescription}
          </T>
          <T>
            {context.exercises.find(
              (e) =>
                form.draft.blocks.flatMap((b) => b.items).find((i) => i.ref === pendingPrescription.itemRef)
                  ?.exerciseId === e.id,
            )?.name ?? m.common.notFound}
            {pendingPrescription.athleteId ? ` · ${athleteName(pendingPrescription.athleteId)}` : ""}
          </T>
          {Object.entries({
            sets: m.builder.sets,
            reps: m.builder.reps,
            distance_m: m.builder.distance,
            duration_s: m.builder.durationS,
            rest_s: m.builder.rest,
            ground_contacts: m.builder.contacts,
            count: m.nativeBuilder.count,
            height_cm: m.nativeBuilder.height,
            unit: m.nativeBuilder.unit,
            tempo: m.builder.tempo,
            notes: m.builder.notes,
          }).map(([key, label]) => {
            const value = pendingPrescription.fields[key as keyof typeof pendingPrescription.fields];
            return value ? (
              <T key={key} variant="caption">
                {label} : {value}
              </T>
            ) : null;
          })}
          <T variant="caption">
            {m.builder.load} :{" "}
            {pendingPrescription.fields.loadType === "none"
              ? m.nativeBuilder.noLoad
              : `${pendingPrescription.fields.loadValue} ${pendingPrescription.fields.loadType === "kg" ? m.builder.loadKg : m.builder.loadPct}`}
          </T>
          {pendingPrescription.fields.loadType === "pct_1rm" ? (
            <T variant="caption">
              {m.builder.test} :{" "}
              {context.exercises.find((e) => `exercise:${e.id}` === pendingPrescription.fields.test)?.name ??
                strengthTestLabel(pendingPrescription.fields.test)}
            </T>
          ) : null}
          <T variant="caption">
            {m.nativeBuilder.intensity} :{" "}
            {pendingPrescription.fields.intensityType === "none"
              ? m.nativeBuilder.noIntensity
              : `${pendingPrescription.fields.intensityType.toUpperCase()} ${pendingPrescription.fields.intensityValue}`}
          </T>
        </View>
      ) : null}
    </View>
  );
};
