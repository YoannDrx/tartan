import { usePreventRemove } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import {
  sessionType,
  type Prescription,
  type SaveScheduledSessionInput,
  type SessionDraft,
  type SessionEditResponse,
} from "@tartan/contracts";
import { copyDraftWithNewRefs, formatPrescription, withSessionRefs } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { useIsOnline } from "../../lib/network";
import { Button, Card, Chip, Divider, Field, T } from "../../ui/primitives";
import { StackScreen } from "../../ui/screen";
import { Sheet } from "../../ui/sheet";
import { space } from "../../ui/theme";
import { builderErrors, localSchedule, parseSessionForm } from "./form";
import { PrescriptionEditor } from "./prescription-editor";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
type Item = SessionDraft["blocks"][number]["items"][number];
type Editing = { itemRef: string; athleteId?: string };
const initialForm = (initial: SessionEditResponse | null, date: string, groupId?: string): SaveScheduledSessionInput =>
  initial
    ? {
        id: initial.id,
        expectedVersion: initial.version,
        date: initial.date,
        startTime: initial.startTime,
        location: initial.location,
        publishAt: localSchedule(initial.publishAt),
        assignments: initial.assignments,
        overrides: initial.overrides,
        draft: withSessionRefs(initial.draft),
      }
    : {
        date,
        startTime: null,
        location: null,
        publishAt: null,
        assignments: groupId ? [{ targetType: "group", targetId: groupId }] : [],
        overrides: [],
        draft: {
          title: "",
          type: "strength",
          durationMin: null,
          coachNote: null,
          blocks: [m.builder.blocks.warmup, m.builder.blocks.main, m.builder.blocks.cooldown].map((name) => ({
            ref: randomUUID(),
            name,
            variant: "club",
            items: [],
          })),
        },
      };

export const NativeSessionBuilder = ({
  orgId,
  initial,
  context,
  date,
  groupId,
  onReload,
}: {
  orgId: string;
  initial: SessionEditResponse | null;
  context: Context;
  date: string;
  groupId?: string;
  onReload: (id?: string) => void;
}) => {
  const [form, setForm] = useState(() => initialForm(initial, date, groupId));
  const [duration, setDuration] = useState(initial?.draft.durationMin?.toString() ?? "");
  const [baseline, setBaseline] = useState(() => JSON.stringify({ form, duration }));
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [libraryBlock, setLibraryBlock] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const online = useIsOnline();
  const navigation = useNavigation();
  const router = useRouter();
  const client = useQueryClient();
  const dirty = JSON.stringify({ form, duration }) !== baseline;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  usePreventRemove(dirty || busy, ({ data }) => {
    if (pending.current) {
      Alert.alert(m.builder.title, m.nativeBuilder.publicationPending);
      return;
    }
    Alert.alert(m.nativeBuilder.unsaved, m.nativeBuilder.leaveConfirm, [
      { text: m.common.cancel, style: "cancel" },
      {
        text: m.nativeBuilder.leave,
        style: "destructive",
        onPress: () => {
          if (mounted.current && !pending.current) navigation.dispatch(data.action);
        },
      },
    ]);
  });
  const confirm = (body: string, action: () => void, destructive = false) =>
    Alert.alert(m.builder.title, body, [
      { text: m.common.cancel, style: "cancel" },
      {
        text: destructive ? m.common.delete : m.nativeBuilder.apply,
        style: destructive ? "destructive" : "default",
        onPress: () => {
          if (mounted.current && !pending.current) action();
        },
      },
    ]);
  const change = (patch: Partial<SaveScheduledSessionInput>) => {
    setMessage("");
    setForm((v) => ({ ...v, ...patch }));
  };
  const draft = (patch: Partial<SessionDraft>) => {
    setMessage("");
    setForm((v) => ({ ...v, draft: { ...v.draft, ...patch } }));
  };
  const blocks = (next: SessionDraft["blocks"]) => {
    const refs = new Set(next.flatMap((b) => b.items.map((i) => i.ref)));
    setForm((v) => ({
      ...v,
      draft: { ...v.draft, blocks: next },
      overrides: v.overrides.filter((o) => refs.has(o.itemRef)),
    }));
  };
  const move = <T,>(list: T[], index: number, offset: number): T[] => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item !== undefined) next.splice(index + offset, 0, item);
    return next;
  };
  const toggleAudience = (targetType: "group" | "athlete", targetId: string) => {
    const selected = form.assignments.some((a) => a.targetType === targetType && a.targetId === targetId);
    change({
      assignments: selected
        ? form.assignments.filter((a) => !(a.targetType === targetType && a.targetId === targetId))
        : [...form.assignments, { targetType, targetId }],
    });
  };
  const exerciseFor = (item: Item) => context.exercises.find((e) => e.id === item.exerciseId);
  const allItems = form.draft.blocks.flatMap((b) => b.items);
  const editedItem = editing ? allItems.find((i) => i.ref === editing.itemRef) : undefined;
  const editedExercise = editedItem ? exerciseFor(editedItem) : undefined;
  const editedValue =
    editing && editedItem
      ? (form.overrides.find((o) => o.itemRef === editing.itemRef && o.athleteId === editing.athleteId)?.prescription ??
        editedItem.prescription)
      : undefined;
  const applyPrescription = (prescription: Prescription) => {
    if (!editing) return;
    if (editing.athleteId)
      change({
        overrides: [
          ...form.overrides.filter((o) => !(o.itemRef === editing.itemRef && o.athleteId === editing.athleteId)),
          { athleteId: editing.athleteId, itemRef: editing.itemRef, prescription },
        ],
      });
    else
      draft({
        blocks: form.draft.blocks.map((b) => ({
          ...b,
          items: b.items.map((i) => (i.ref === editing.itemRef ? { ...i, prescription } : i)),
        })),
      });
    setEditing(null);
  };
  const submit = async (publish: boolean) => {
    if (!mounted.current || pending.current || stale) return;
    if (!online) {
      setError(m.nativeBuilder.offline);
      return;
    }
    const parsed = parseSessionForm({ ...form, publishAt: publish ? null : form.publishAt }, duration);
    if (!parsed.success) {
      setError(builderErrors(parsed.error.issues));
      return;
    }
    if (publish && parsed.data.assignments.length === 0) {
      setError(m.builder.noAudience);
      return;
    }
    if (parsed.data.publishAt && Date.parse(parsed.data.publishAt) <= Date.now()) {
      setError(m.builder.schedulePast);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let saved: { id: string; version: number } | null = null;
    try {
      const { id, expectedVersion, ...body } = parsed.data;
      saved =
        id && expectedVersion
          ? await api.updateSession(orgId, id, { ...body, expectedVersion })
          : await api.createSession(orgId, body);
      if (!mounted.current) return;
      const next = {
        ...parsed.data,
        publishAt: localSchedule(parsed.data.publishAt),
        id: saved.id,
        expectedVersion: saved.version,
      };
      // L'identité reçue est conservée même si la publication échoue ensuite.
      setForm(next);
      setBaseline(JSON.stringify({ form: next, duration }));
      if (publish && !publishedAt) await api.publishSession(orgId, saved.id, saved.version);
      if (!mounted.current) return;
      const current = await api.editSession(orgId, saved.id);
      const refreshed = initialForm(current, current.date);
      if (!mounted.current) return;
      setPublishedAt(current.publishedAt);
      setForm(refreshed);
      setBaseline(JSON.stringify({ form: refreshed, duration }));
      setMessage(
        publish || current.publishedAt
          ? publishedAt
            ? m.builder.updated
            : m.builder.published
          : m.nativeBuilder.saved,
      );
      setPreview(false);
      // Le cache d'édition ne remplace jamais le formulaire pendant la saisie.
      for (const key of ["coach-calendar", "tracking", "coach-session", "session", "session-edit"])
        void client.invalidateQueries({ queryKey: [key, orgId] });
    } catch (cause) {
      if (!mounted.current) return;
      setError(saved && publish ? m.nativeBuilder.publishFailed : errorMessage(cause));
      // Une réponse perdue ou un conflit impose une relecture, jamais un écrasement automatique.
      if (saved || !(cause instanceof ApiError) || cause.status === 409 || cause.status >= 500) {
        setStale(true);
        if (!form.id && !saved) setError(m.nativeBuilder.unknownCreation);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const saveTemplate = async () => {
    if (!mounted.current || pending.current || !online) return;
    const result = parseSessionForm(form, duration);
    if (!result.success) {
      setError(builderErrors(result.error.issues));
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.saveSessionTemplate(orgId, result.data.draft);
      if (mounted.current) setMessage(m.nativeBuilder.templateSaved);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const review = () => {
    const parsed = parseSessionForm(form, duration);
    if (!parsed.success) {
      setError(builderErrors(parsed.error.issues));
      return;
    }
    if (!form.assignments.length) {
      setError(m.builder.noAudience);
      return;
    }
    setPreview(true);
  };
  const audienceName = (a: SaveScheduledSessionInput["assignments"][number]) =>
    a.targetType === "group"
      ? (context.groups.find((g) => g.id === a.targetId)?.name ?? m.common.notFound)
      : (() => {
          const p = context.athletes.find((x) => x.id === a.targetId);
          return p ? `${p.firstName} ${p.lastName}` : m.common.notFound;
        })();
  return (
    <StackScreen title={initial ? m.common.edit + " · " + m.builder.title : m.coach.newSession}>
      {!online ? <T accessibilityRole="alert">{m.nativeBuilder.offline}</T> : null}
      <View pointerEvents={busy ? "none" : "auto"} style={{ gap: space.lg }} accessibilityElementsHidden={busy}>
        <Field
          testID="builder-title"
          label={m.builder.titleLabel}
          value={form.draft.title}
          maxLength={120}
          onChangeText={(title) => draft({ title })}
        />
        <Field
          label={m.builder.date}
          value={form.date}
          placeholder={m.nativeBuilder.dateHint}
          onChangeText={(date) => change({ date })}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {sessionType.options.map((type) => (
            <Chip
              key={type}
              label={m.sessionType[type]}
              active={form.draft.type === type}
              onPress={() => draft({ type })}
            />
          ))}
        </View>
        <T variant="title2" heading>
          {m.builder.audience}
        </T>
        {context.groups.map((g) => (
          <Chip
            key={g.id}
            label={`${g.name} · ${g.athleteCount}`}
            active={form.assignments.some((a) => a.targetType === "group" && a.targetId === g.id)}
            onPress={() => toggleAudience("group", g.id)}
          />
        ))}
        <Field label={m.builder.pickAthletes} value={athleteSearch} onChangeText={setAthleteSearch} />
        {context.athletes
          .filter(
            (a) =>
              (athleteSearch &&
                `${a.firstName} ${a.lastName}`
                  .toLocaleLowerCase("fr")
                  .includes(athleteSearch.toLocaleLowerCase("fr"))) ||
              form.assignments.some((t) => t.targetType === "athlete" && t.targetId === a.id),
          )
          .map((a) => (
            <Chip
              key={a.id}
              label={`${a.firstName} ${a.lastName}`}
              active={form.assignments.some((t) => t.targetType === "athlete" && t.targetId === a.id)}
              onPress={() => toggleAudience("athlete", a.id)}
            />
          ))}
        <Button
          variant="secondary"
          label={m.builder.useTemplate}
          disabled={!context.templates.length}
          onPress={() => setTemplates(true)}
        />
        {form.draft.blocks.map((block, bi) => (
          <Card key={block.ref}>
            <View style={{ gap: space.md }}>
              <Field
                nativeID={`block-${block.ref}`}
                label={m.nativeBuilder.blockName}
                value={block.name}
                maxLength={80}
                onChangeText={(name) =>
                  draft({ blocks: form.draft.blocks.map((b) => (b.ref === block.ref ? { ...b, name } : b)) })
                }
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {(["club", "autonomous", "both"] as const).map((variant) => (
                  <Chip
                    key={variant}
                    label={
                      variant === "club"
                        ? m.builder.versionClub
                        : variant === "autonomous"
                          ? m.builder.versionAutonomous
                          : m.nativeBuilder.both
                    }
                    active={block.variant === variant}
                    onPress={() =>
                      draft({ blocks: form.draft.blocks.map((b) => (b.ref === block.ref ? { ...b, variant } : b)) })
                    }
                  />
                ))}
              </View>
              {block.items.map((item, ii) => (
                <View key={item.ref} style={{ gap: space.sm }}>
                  <Divider />
                  <T variant="bodyStrong">{exerciseFor(item)?.name ?? m.common.notFound}</T>
                  <T variant="small">{formatPrescription(item.prescription)}</T>
                  {item.prescription.notes ? <T variant="caption">{item.prescription.notes}</T> : null}
                  <Button
                    compact
                    variant="secondary"
                    label={m.builder.setPrescription}
                    accessibilityLabel={`${m.builder.setPrescription} · ${exerciseFor(item)?.name ?? ""}`}
                    onPress={() => setEditing({ itemRef: item.ref! })}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label={m.nativeBuilder.moveTo}
                    disabled={form.draft.blocks.length < 2}
                    onPress={() => setMoving(item.ref!)}
                  />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                    <Button
                      compact
                      variant="secondary"
                      label={m.nativeBuilder.up}
                      accessibilityLabel={`${m.nativeBuilder.up} · ${exerciseFor(item)?.name ?? ""}`}
                      disabled={ii === 0}
                      onPress={() =>
                        blocks(
                          form.draft.blocks.map((b) =>
                            b.ref === block.ref ? { ...b, items: move(b.items, ii, -1) } : b,
                          ),
                        )
                      }
                    />
                    <Button
                      compact
                      variant="secondary"
                      label={m.nativeBuilder.down}
                      accessibilityLabel={`${m.nativeBuilder.down} · ${exerciseFor(item)?.name ?? ""}`}
                      disabled={ii === block.items.length - 1}
                      onPress={() =>
                        blocks(
                          form.draft.blocks.map((b) =>
                            b.ref === block.ref ? { ...b, items: move(b.items, ii, 1) } : b,
                          ),
                        )
                      }
                    />
                    <Button
                      compact
                      variant="secondary"
                      label={m.common.delete}
                      accessibilityLabel={`${m.common.delete} · ${exerciseFor(item)?.name ?? ""}`}
                      onPress={() =>
                        confirm(
                          m.nativeBuilder.removeExercise,
                          () =>
                            blocks(
                              form.draft.blocks.map((b) => ({
                                ...b,
                                items: b.items.filter((i) => i.ref !== item.ref),
                              })),
                            ),
                          true,
                        )
                      }
                    />
                  </View>
                  <Button
                    compact
                    variant="secondary"
                    label={`${m.builder.adjustments} (${form.overrides.filter((o) => o.itemRef === item.ref).length})`}
                    onPress={() => {
                      setAthleteSearch("");
                      setAdjusting(item.ref!);
                    }}
                  />
                </View>
              ))}
              <Button
                variant="secondary"
                label={m.nativeBuilder.addExercise}
                disabled={block.items.length >= 60}
                onPress={() => {
                  setSearch("");
                  setLibraryBlock(block.ref!);
                }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                <Button
                  compact
                  variant="secondary"
                  label={m.nativeBuilder.up}
                  disabled={bi === 0}
                  onPress={() => blocks(move(form.draft.blocks, bi, -1))}
                />
                <Button
                  compact
                  variant="secondary"
                  label={m.nativeBuilder.down}
                  disabled={bi === form.draft.blocks.length - 1}
                  onPress={() => blocks(move(form.draft.blocks, bi, 1))}
                />
                <Button
                  compact
                  variant="secondary"
                  label={m.common.delete}
                  disabled={form.draft.blocks.length === 1}
                  onPress={() =>
                    confirm(
                      m.nativeBuilder.removeBlock,
                      () => blocks(form.draft.blocks.filter((b) => b.ref !== block.ref)),
                      true,
                    )
                  }
                />
              </View>
            </View>
          </Card>
        ))}
        <Button
          variant="secondary"
          label={m.builder.addBlock}
          disabled={form.draft.blocks.length >= 12}
          onPress={() =>
            blocks([
              ...form.draft.blocks,
              { ref: randomUUID(), name: m.builder.blocks.main, variant: "club", items: [] },
            ])
          }
        />
        <Button
          variant="secondary"
          label={advanced ? m.nativeBuilder.hideAdvanced : m.nativeBuilder.advanced}
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <View style={{ gap: space.md }}>
            <Button
              variant="secondary"
              label={m.builder.saveTemplate}
              disabled={!online}
              onPress={() => void saveTemplate()}
            />
            <Field
              label={m.builder.time}
              value={form.startTime ?? ""}
              placeholder={m.nativeBuilder.timeHint}
              onChangeText={(text) => change({ startTime: text || null })}
            />
            <Field
              label={m.builder.location}
              value={form.location ?? ""}
              maxLength={120}
              onChangeText={(text) => change({ location: text || null })}
            />
            <Field label={m.builder.duration} value={duration} keyboardType="number-pad" onChangeText={setDuration} />
            <Field
              label={m.builder.coachNote}
              value={form.draft.coachNote ?? ""}
              maxLength={280}
              multiline
              onChangeText={(text) => draft({ coachNote: text || null })}
            />
            {!publishedAt ? (
              <View style={{ gap: space.sm }}>
                <Chip
                  label={m.builder.schedule}
                  active={form.publishAt !== null}
                  onPress={() => change({ publishAt: form.publishAt === null ? `${form.date}T18:00` : null })}
                />
                {form.publishAt !== null ? (
                  <>
                    <T variant="caption">
                      {m.nativeBuilder.scheduleZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                    </T>
                    <Field
                      label={m.nativeBuilder.scheduleDate}
                      value={form.publishAt.split("T")[0] ?? ""}
                      placeholder={m.nativeBuilder.dateHint}
                      onChangeText={(text) =>
                        change({ publishAt: `${text}T${form.publishAt?.split("T")[1] ?? "18:00"}` })
                      }
                    />
                    <Field
                      label={m.nativeBuilder.scheduleTime}
                      value={form.publishAt.split("T")[1] ?? ""}
                      placeholder={m.nativeBuilder.timeHint}
                      onChangeText={(text) =>
                        change({ publishAt: `${form.publishAt?.split("T")[0] ?? form.date}T${text}` })
                      }
                    />
                  </>
                ) : null}
              </View>
            ) : null}
            <Button
              variant="secondary"
              label={m.builder.generate}
              onPress={() =>
                confirm(m.nativeBuilder.generateConfirm, () => {
                  const club = form.draft.blocks.filter((b) => b.variant === "club");
                  const copies = copyDraftWithNewRefs({ ...form.draft, blocks: club }, randomUUID).blocks.map((b) => ({
                    ...b,
                    variant: "autonomous" as const,
                  }));
                  blocks([...form.draft.blocks.filter((b) => b.variant !== "autonomous"), ...copies]);
                })
              }
            />
          </View>
        ) : null}
        {error ? (
          <T tone="danger" accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
        {stale && !form.id ? (
          <Button variant="secondary" label={m.nav.calendrier} onPress={() => router.push("/(coach)/planning")} />
        ) : null}
        {stale && form.id ? (
          <Button
            variant="secondary"
            label={m.nativeBuilder.reload}
            onPress={() => confirm(m.nativeBuilder.reloadConfirm, () => onReload(form.id))}
          />
        ) : null}

        <Button
          label={publishedAt ? m.common.save : m.builder.publish}
          disabled={busy || stale || !online}
          onPress={review}
        />
        {!publishedAt ? (
          <Button
            variant="secondary"
            label={form.publishAt ? m.builder.publishLater : m.builder.saveDraft}
            disabled={busy || stale || !online}
            onPress={() => void submit(false)}
          />
        ) : null}
        {form.id && !dirty ? (
          <Button
            variant="secondary"
            label={m.coach.trackingTitle}
            onPress={() => router.push({ pathname: "/coach-session/[id]", params: { id: form.id! } })}
          />
        ) : null}
      </View>
      {libraryBlock ? (
        <Sheet visible title={m.builder.library} onClose={() => setLibraryBlock(null)}>
          <Field label={m.exercises.search} value={search} onChangeText={setSearch} />
          {context.exercises
            .filter((e) =>
              `${e.name} ${e.tags.join(" ")}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
            )
            .map((e) => (
              <Button
                key={e.id}
                variant="secondary"
                label={e.name}
                onPress={() => {
                  draft({
                    blocks: form.draft.blocks.map((b) =>
                      b.ref === libraryBlock
                        ? {
                            ...b,
                            items: [
                              ...b.items,
                              { ref: randomUUID(), exerciseId: e.id, prescription: e.defaultPrescription },
                            ],
                          }
                        : b,
                    ),
                  });
                  setLibraryBlock(null);
                }}
              />
            ))}
        </Sheet>
      ) : null}
      {moving ? (
        <Sheet visible title={m.nativeBuilder.moveTo} onClose={() => setMoving(null)}>
          {form.draft.blocks.map((block) => (
            <Button
              key={block.ref}
              label={block.name}
              variant="secondary"
              disabled={block.items.some((i) => i.ref === moving) || block.items.length >= 60}
              onPress={() => {
                const item = allItems.find((i) => i.ref === moving);
                if (item)
                  blocks(
                    form.draft.blocks.map((b) => ({
                      ...b,
                      items: b.ref === block.ref ? [...b.items, item] : b.items.filter((i) => i.ref !== moving),
                    })),
                  );
                setMoving(null);
              }}
            />
          ))}
        </Sheet>
      ) : null}
      {templates ? (
        <Sheet visible title={m.builder.useTemplate} onClose={() => setTemplates(false)}>
          {context.templates.map((t) => (
            <Button
              key={t.id}
              variant="secondary"
              label={t.title}
              onPress={() =>
                confirm(m.nativeBuilder.replaceTemplate, () => {
                  change({ draft: copyDraftWithNewRefs(t, randomUUID), overrides: [] });
                  setDuration(t.durationMin?.toString() ?? "");
                  setTemplates(false);
                })
              }
            />
          ))}
        </Sheet>
      ) : null}
      {adjusting ? (
        <Sheet visible title={m.builder.adjustments} onClose={() => setAdjusting(null)}>
          <Field label={m.nativeBuilder.adjustmentsFor} value={athleteSearch} onChangeText={setAthleteSearch} />
          {context.athletes
            .filter((a) =>
              `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.toLocaleLowerCase("fr")),
            )
            .map((a) => {
              const override = form.overrides.find((o) => o.itemRef === adjusting && o.athleteId === a.id);
              return (
                <View key={a.id} style={{ gap: space.xs }}>
                  <Button
                    variant="secondary"
                    label={`${a.firstName} ${a.lastName}`}
                    onPress={() => {
                      setEditing({ itemRef: adjusting, athleteId: a.id });
                      setAdjusting(null);
                    }}
                  />
                  <T variant="caption">
                    {override ? formatPrescription(override.prescription) : m.nativeBuilder.noAdjustment}
                  </T>
                  {override ? (
                    <Button
                      compact
                      variant="secondary"
                      label={m.nativeBuilder.resetAdjustment}
                      onPress={() => change({ overrides: form.overrides.filter((o) => o !== override) })}
                    />
                  ) : null}
                </View>
              );
            })}
        </Sheet>
      ) : null}
      {editing && editedItem && editedExercise && editedValue ? (
        <PrescriptionEditor
          key={`${editing.itemRef}-${editing.athleteId ?? "all"}`}
          title={editing.athleteId ? m.builder.adjustments : m.builder.setPrescription}
          exercise={editedExercise}
          value={editedValue}
          testKeys={context.testKeys}
          onClose={() => setEditing(null)}
          onApply={applyPrescription}
        />
      ) : null}
      {preview ? (
        <Sheet
          visible
          title={m.nativeBuilder.previewTitle}
          onClose={() => {
            if (!busy) setPreview(false);
          }}
          footer={
            <Button
              label={publishedAt ? m.common.save : m.builder.publish}
              loading={busy}
              disabled={!online || stale}
              onPress={() => void submit(true)}
            />
          }
        >
          <T variant="title2">{form.draft.title}</T>
          <T>
            {form.date} · {form.startTime ?? ""}
          </T>
          <T>{form.assignments.map(audienceName).join(", ")}</T>
          <T>
            {[form.location, duration ? `${duration} min` : null, form.draft.coachNote].filter(Boolean).join(" · ")}
          </T>
          <T>{publishedAt ? m.nativeBuilder.updateConfirm : m.nativeBuilder.publishConfirm}</T>
          {error ? (
            <T tone="danger" accessibilityRole="alert">
              {error}
            </T>
          ) : null}
          {form.draft.blocks.map((b) => (
            <View key={b.ref} style={{ gap: space.sm }}>
              <T variant="bodyStrong">
                {b.name} ·{" "}
                {b.variant === "club"
                  ? m.builder.versionClub
                  : b.variant === "autonomous"
                    ? m.builder.versionAutonomous
                    : m.nativeBuilder.both}
              </T>
              {b.items.map((i) => (
                <View key={i.ref}>
                  <T>
                    {exerciseFor(i)?.name ?? m.common.notFound} · {formatPrescription(i.prescription)}
                  </T>
                  {form.overrides
                    .filter((o) => o.itemRef === i.ref)
                    .map((o) => (
                      <T key={o.athleteId} variant="caption">
                        {audienceName({ targetType: "athlete", targetId: o.athleteId })} ·{" "}
                        {formatPrescription(o.prescription)}
                      </T>
                    ))}
                </View>
              ))}
            </View>
          ))}
        </Sheet>
      ) : null}
    </StackScreen>
  );
};
