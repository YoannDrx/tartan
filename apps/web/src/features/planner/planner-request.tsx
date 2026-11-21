"use client";

import {
  createPlannerProposalInput,
  plannerBrief,
  trainingEquipment,
  type CreatePlannerProposalInput,
  type PlannerSelection,
} from "@tartan/contracts";
import { addDays, phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { CheckRow, Field, Input, Textarea } from "@/components/ui/field";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";
import { cn } from "@/lib/cn";
import type { getSessionBuilderContext } from "@/server/session-builder.service";

export type PlannerContext = Awaited<ReturnType<typeof getSessionBuilderContext>>;
import { WebPlannerDictation } from "./web-dictation";

const t = w.planner;
const old = m.aiPlanner;
type Mode = "format" | "propose";
type Level = "beginner" | "intermediate" | "advanced";
const DURATIONS = [20, 30, 45, 60, 75, 90, 120];
const toggle = (values: string[], id: string) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];

/** Une pastille à bascule : 44 px de haut, l'état se lit au contour, à la coche et par `aria-pressed`. */
export const Pill = ({
  pressed,
  onClick,
  disabled,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition-colors duration-(--duration-quick) disabled:opacity-50",
      pressed ? "border-accent bg-accent text-on-accent" : "border-control-line hover:bg-raise",
    )}
  >
    {pressed ? <Check aria-hidden className="size-4" /> : null}
    {children}
  </button>
);

/** Choix du jour : la planification des phases doit être prête pour chaque date avant l'envoi. */
function DayPhase({
  date,
  orgId,
  groupIds,
  athleteIds,
  onReady,
}: {
  date: string;
  orgId: string;
  groupIds: string[];
  athleteIds: string[];
  onReady: (date: string, state: PhasePlanningReadiness) => void;
}) {
  const [state, setState] = useState<PhasePlanningReadiness | null>(null);
  const accept = useCallback(
    (next: PhasePlanningReadiness) => {
      setState(next);
      onReady(date, next);
    },
    [date, onReady],
  );
  const needed = Boolean(state && !state.ready);
  return (
    <details open={needed || undefined} className="rounded-card border border-card-line px-3">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.phases}</summary>
      <PhasePlanningPanel
        organizationId={orgId}
        date={date}
        groupIds={groupIds}
        athleteIds={athleteIds}
        initialChoices={[]}
        onReady={accept}
      />
    </details>
  );
}

export type PlannerRequestValue = {
  groupIds: string[];
  athleteIds: string[];
  date: string;
  span: "day" | "week";
  mode: Mode;
  text: string;
  durationMin: number;
  level: Level;
  equipment: string[];
  startTime: string;
};

export const plannerRequestFrom = (selection: PlannerSelection, equipment: string[]): PlannerRequestValue => ({
  groupIds: selection.groupIds,
  athleteIds: selection.athleteIds,
  date: selection.brief?.date ?? selection.period.from,
  span: selection.period.from === selection.period.to ? "day" : "week",
  mode: selection.mode ?? "format",
  text: selection.brief?.objective ?? "",
  durationMin: selection.brief?.durationMin ?? 45,
  level: selection.brief?.level ?? "intermediate",
  equipment: selection.brief?.equipment ?? equipment,
  startTime: "",
});

/** La demande, en un seul écran et un seul envoi : destinataires, date, mode, consigne ou objectif. */
export function PlannerRequest({
  orgId,
  context,
  value,
  onChange,
  busy,
  exhausted,
  onSubmit,
}: {
  orgId: string;
  context: PlannerContext;
  value: PlannerRequestValue;
  onChange: (value: PlannerRequestValue) => void;
  busy: boolean;
  exhausted: boolean;
  onSubmit: (input: CreatePlannerProposalInput) => void;
}) {
  const [phases, setPhases] = useState<Record<string, PhasePlanningReadiness>>({});
  const [dictating, setDictating] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState("");
  const set = (patch: Partial<PlannerRequestValue>) => onChange({ ...value, ...patch });
  const acceptPhase = useCallback((date: string, state: PhasePlanningReadiness) => {
    setPhases((current) =>
      JSON.stringify(current[date]) === JSON.stringify(state) ? current : { ...current, [date]: state },
    );
  }, []);
  const propose = value.mode === "propose";
  const to = value.span === "week" ? addDays(value.date, 6) : value.date;
  const dates = value.date
    ? Array.from({ length: value.span === "week" ? 7 : 1 }, (_, i) => addDays(value.date, i))
    : [];
  // Mode « Proposer » : une seule séance, ce jour-là.
  const phaseDates = propose ? dates.slice(0, 1) : dates;
  const hasAudience = value.groupIds.length + value.athleteIds.length > 0;
  const phasesReady =
    !context.phasesEnabled ||
    phaseDates.every(
      (date) => phases[date]?.ready && phases[date]?.key === phasePlanningKey(date, value.groupIds, value.athleteIds),
    );
  const verified = context.exercises.some((exercise) => exercise.guide?.technicalReview === "approved");
  const limit = propose ? 1000 : 12000;
  const selection: PlannerSelection = {
    mode: value.mode,
    period: { from: value.date, to: propose ? value.date : to },
    groupIds: value.groupIds,
    athleteIds: value.athleteIds,
    exerciseIds: [],
    phaseChoices: [],
    phaseChoicesByDate: context.phasesEnabled
      ? phaseDates.map((date) => ({ date, choices: phases[date]?.review?.choices ?? [] }))
      : [],
    ...(propose
      ? {
          brief: {
            objective: value.text.trim(),
            date: value.date,
            durationMin: value.durationMin,
            level: value.level,
            equipment: value.equipment,
          },
        }
      : {}),
  };
  const draft = createPlannerProposalInput.safeParse({
    id: "00000000-0000-4000-8000-000000000000",
    requestedAt: new Date(0).toISOString(),
    selection,
    text: value.text.trim(),
    reviewed: true,
    // Cet écran sait afficher les nouveaux points « À vérifier » ; pas encore les emplacements à compléter.
    accepts: ["checks"],
    ...(propose && value.startTime ? { startTime: value.startTime } : {}),
  });
  const ready =
    draft.success &&
    hasAudience &&
    phasesReady &&
    !exhausted &&
    !dictating &&
    value.text.length <= limit &&
    (!propose || (verified && plannerBrief.safeParse(selection.brief).success));
  const athletes = context.athletes.filter((a) =>
    `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.trim().toLocaleLowerCase("fr")),
  );
  return (
    <form
      className="flex min-w-0 flex-col gap-6"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || busy || !draft.success) return;
        onSubmit({ ...draft.data, id: crypto.randomUUID(), requestedAt: new Date().toISOString() });
      }}
    >
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <legend className="t-section mb-1">{t.who}</legend>
        <p className="t-caption text-soft">{t.whoHint}</p>
        {!context.groups.length && !context.athletes.length ? (
          <p role="status">
            {old.noRecipients}{" "}
            <Link href="/athletes" className="underline underline-offset-4">
              {old.addRecipients}
            </Link>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {context.groups.map((group) => (
            <Pill
              key={group.id}
              pressed={value.groupIds.includes(group.id)}
              onClick={() => set({ groupIds: toggle(value.groupIds, group.id) })}
            >
              {group.name}
            </Pill>
          ))}
        </div>
        {context.athletes.length ? (
          <details className="rounded-card border border-card-line px-3">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              {t.athletes(value.athleteIds.length)}
            </summary>
            <Field label={m.trainingPhases.searchTarget}>
              {(a) => (
                <Input {...a} type="search" value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} />
              )}
            </Field>
            <div className="grid gap-x-4 pb-2 tablet:grid-cols-2">
              {athletes.slice(0, 50).map((athlete) => (
                <CheckRow
                  key={athlete.id}
                  label={`${athlete.firstName} ${athlete.lastName}`}
                  checked={value.athleteIds.includes(athlete.id)}
                  onChange={() => set({ athleteIds: toggle(value.athleteIds, athlete.id) })}
                />
              ))}
            </div>
            {athletes.length > 50 ? <p className="t-caption pb-3 text-soft">{old.refineSearch}</p> : null}
          </details>
        ) : null}
      </fieldset>

      <fieldset disabled={busy} className="grid min-w-0 gap-3 tablet:grid-cols-2">
        <legend className="t-section mb-1">{t.when}</legend>
        <Field label={t.day}>
          {(a) => <DateInput {...a} required value={value.date} onChange={(e) => set({ date: e.target.value })} />}
        </Field>
        {propose ? (
          <Field label={t.time}>
            {(a) => (
              <Input {...a} type="time" value={value.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            )}
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="t-caption">{t.span}</span>
            <div className="flex flex-wrap gap-2">
              {(["day", "week"] as const).map((span) => (
                <Pill key={span} pressed={value.span === span} onClick={() => set({ span })}>
                  {t.spans[span]}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <legend className="t-section mb-1">{t.how}</legend>
        <div role="radiogroup" aria-label={t.how} className="grid gap-3 tablet:grid-cols-2">
          {(["format", "propose"] as const).map((mode) => (
            <label
              key={mode}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col gap-1 rounded-card border-2 p-4 transition-colors duration-(--duration-quick) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                value.mode === mode ? "border-accent bg-card-raised" : "border-card-line hover:bg-raise",
              )}
            >
              <input
                type="radio"
                name="planner-mode"
                className="sr-only"
                checked={value.mode === mode}
                onChange={() => set({ mode })}
              />
              <span className="flex items-center justify-between gap-2 font-semibold">
                {t.modes[mode].title}
                {value.mode === mode ? <Check aria-hidden className="size-5 shrink-0 text-accent" /> : null}
              </span>
              <span className="t-caption text-soft">{t.modes[mode].detail}</span>
            </label>
          ))}
        </div>
        {propose && !verified ? <p role="status">{old.verifiedCatalogRequired}</p> : null}
      </fieldset>

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">{propose ? t.objective : t.instructions}</legend>
        <Field label={propose ? t.objective : t.instructions} hint={propose ? t.objectiveHint : t.instructionsHint}>
          {(a) => (
            <Textarea
              {...a}
              rows={propose ? 3 : 6}
              value={value.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          )}
        </Field>
        {value.text.length > limit ? <p role="alert">{old.textLimit(value.text.length, limit)}</p> : null}
        <WebPlannerDictation
          orgId={orgId}
          disabled={busy}
          onBusyChange={setDictating}
          onText={(text) => set({ text: value.text.trim() ? `${value.text}\n${text}` : text })}
        />
      </fieldset>

      {propose ? (
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">{t.modes.propose.title}</legend>
          <div className="flex flex-col gap-1.5">
            <span className="t-caption">{t.duration}</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((min) => (
                <Pill key={min} pressed={value.durationMin === min} onClick={() => set({ durationMin: min })}>
                  {t.durationValue(min)}
                </Pill>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-caption">{t.level}</span>
            <div className="flex flex-wrap gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <Pill key={level} pressed={value.level === level} onClick={() => set({ level })}>
                  {old.proposalLevels[level]}
                </Pill>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-caption">{t.equipment}</span>
            <span className="t-caption text-soft">{t.equipmentHint}</span>
            <div className="flex flex-wrap gap-2">
              {trainingEquipment.options.map((key) => (
                <Pill
                  key={key}
                  pressed={value.equipment.includes(key)}
                  onClick={() => set({ equipment: toggle(value.equipment, key) })}
                >
                  {m.trainingProfile.equipment[key]}
                </Pill>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      {context.phasesEnabled && hasAudience
        ? phaseDates.map((date) => (
            <DayPhase
              key={`${date}:${value.groupIds.join(",")}:${value.athleteIds.join(",")}`}
              date={date}
              orgId={orgId}
              groupIds={value.groupIds}
              athleteIds={value.athleteIds}
              onReady={acceptPhase}
            />
          ))
        : null}

      {/* Sur téléphone, l'action reste à portée de pouce : une seule, au bas de l'écran. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-card-line bg-card px-4 py-3 desktop:static desktop:mx-0 desktop:border-0 desktop:p-0">
        <Button type="submit" className="w-full tablet:w-auto" disabled={!ready || busy}>
          {busy ? t.preparing : t.prepare}
        </Button>
      </div>
    </form>
  );
}
