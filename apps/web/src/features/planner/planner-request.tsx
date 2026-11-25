"use client";

import {
  createPlannerProposalInput,
  plannerEquipment,
  type CreatePlannerProposalInput,
  type PlannerSelection,
} from "@tartan/contracts";
import { plannerWeekDays, phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Check, ChevronDown, Mic, Square, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PlannerSolo } from "./planner-solo";
import { Button, IconButton } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";
import { cn } from "@/lib/cn";
import type { getSessionBuilderContext } from "@/server/session-builder.service";
import { usePlannerDictation } from "./web-dictation";

export type PlannerContext = Awaited<ReturnType<typeof getSessionBuilderContext>>;

const t = w.planner;
type Level = "beginner" | "intermediate" | "advanced";
export type PlannerEquipment = (typeof plannerEquipment.options)[number];
type Equipment = PlannerEquipment;
const DURATIONS = [20, 30, 45, 60, 75, 90, 120];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const TEXT_LIMIT = 12000;
const toggle = <V extends string>(values: V[], id: V) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

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

const foldSummary =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold [&::-webkit-details-marker]:hidden";
/** Un repli de l'écran : son titre, ce qu'il contient déjà, et le chevron qui dit qu'il s'ouvre. */
export const Fold = ({
  title,
  detail,
  open,
  bare,
  children,
  onToggle,
}: {
  title: ReactNode;
  detail?: ReactNode;
  open?: boolean;
  /** Sans contour : ce qu'il contient a déjà le sien. */
  bare?: boolean;
  children: ReactNode;
  onToggle?: (open: boolean) => void;
}) => (
  <details
    open={open}
    onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}
    className={cn("group min-w-0", !bare && "rounded-card border border-card-line px-3")}
  >
    <summary className={foldSummary}>
      <span className="min-w-0 break-words">{title}</span>
      <span className="flex shrink-0 items-center gap-2 t-caption font-normal text-soft">
        {detail}
        <ChevronDown
          aria-hidden
          className="size-5 transition-transform duration-(--duration-quick) group-open:rotate-180"
        />
      </span>
    </summary>
    <div className="flex min-w-0 flex-col gap-4 pb-3">{children}</div>
  </details>
);

/** La phase du jour choisi : demandée ici, une seule fois, et seulement quand un destinataire est choisi. */
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
  // Un choix manque (un athlète suit deux phases) : le repli s'ouvre seul, sinon il reste fermé. Le temps de la
  // lecture des phases n'est pas un choix à faire : le repli ne s'ouvre pas pour un simple chargement.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Fold bare title={t.phases} open={(settled && Boolean(state && !state.ready)) || undefined}>
      <PhasePlanningPanel
        organizationId={orgId}
        date={date}
        groupIds={groupIds}
        athleteIds={athleteIds}
        initialChoices={[]}
        onReady={accept}
      />
    </Fold>
  );
}

export type PlannerRequestValue = {
  groupIds: string[];
  athleteIds: string[];
  date: string;
  week?: boolean;
  days?: string[];
  discipline?: string;
  text: string;
  // Précisions facultatives : rien n'est supposé tant que le coach ne les touche pas.
  startTime: string;
  durationMin: number | null;
  level: Level | null;
  equipment: Equipment[];
};

export const plannerRequestFrom = (selection: PlannerSelection, equipment: Equipment[]): PlannerRequestValue => ({
  groupIds: selection.groupIds,
  athleteIds: selection.athleteIds,
  date: selection.period.from,
  ...(selection.period.from !== selection.period.to ? { week: true } : {}),
  text: "",
  startTime: "",
  durationMin: null,
  level: null,
  equipment,
});

/**
 * La demande : pour qui, quand, puis un seul champ. Le coach y décrit sa séance, donne un objectif ou mêle les
 * deux, à l'écrit ou à la voix ; le planificateur comprend seul. Durée, niveau, matériel et heure sont des
 * précisions repliées, jamais requises.
 */
export function PlannerRequest({
  orgId,
  context,
  spaceEquipment,
  value,
  onChange,
  busy,
  exhausted,
  onSubmit,
}: {
  orgId: string;
  context: PlannerContext;
  /** Le matériel du profil de l'espace : celui que le serveur retient quand rien n'est précisé. */
  spaceEquipment: Equipment[];
  value: PlannerRequestValue;
  onChange: (value: PlannerRequestValue) => void;
  busy: boolean;
  exhausted: boolean;
  onSubmit: (input: CreatePlannerProposalInput) => void;
}) {
  const [phases, setPhases] = useState<Record<string, PhasePlanningReadiness>>({});
  const [athleteSearch, setAthleteSearch] = useState("");
  const solo = useContext(PlannerSolo);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  const set = (patch: Partial<PlannerRequestValue>) => onChange({ ...value, ...patch });
  // La dictée s'ajoute à ce qui est déjà écrit : le coach relit et corrige avant d'envoyer.
  const dictation = usePlannerDictation(
    orgId,
    useCallback(
      (text: string) => {
        const current = latest.current;
        onChange({ ...current, text: current.text.trim() ? `${current.text.trimEnd()}\n${text}` : text });
      },
      [onChange],
    ),
  );
  const acceptPhase = useCallback((date: string, state: PhasePlanningReadiness) => {
    setPhases((current) =>
      JSON.stringify(current[date]) === JSON.stringify(state) ? current : { ...current, [date]: state },
    );
  }, []);
  const hasAudience = value.groupIds.length + value.athleteIds.length > 0;
  const hasRecipients = context.groups.length + context.athletes.length > 0;
  const askPhases = context.phasesEnabled && hasAudience && Boolean(value.date);
  const phasesReady =
    !askPhases ||
    Boolean(
      phases[value.date]?.ready &&
      phases[value.date]?.key === phasePlanningKey(value.date, value.groupIds, value.athleteIds),
    );
  const equipmentChanged = !sameSet(value.equipment, spaceEquipment);
  const hints = {
    ...(value.durationMin ? { durationMin: value.durationMin } : {}),
    ...(value.level ? { level: value.level } : {}),
    ...(equipmentChanged ? { equipment: value.equipment } : {}),
  };
  const precisions = [
    ...(value.startTime ? [value.startTime] : []),
    ...(value.durationMin ? [t.durationValue(value.durationMin)] : []),
    ...(value.level ? [t.levels[value.level]] : []),
    ...(equipmentChanged ? [t.equipment] : []),
  ];
  const draft = createPlannerProposalInput.safeParse({
    id: "00000000-0000-4000-8000-000000000000",
    requestedAt: new Date(0).toISOString(),
    // Ni mode ni brief : le serveur comprend seul ce que la demande décrit et ce qu'elle laisse composer.
    selection: {
      period: { from: value.date, to: value.week ? (plannerWeekDays(value.date).at(-1) ?? value.date) : value.date },
      groupIds: value.groupIds,
      athleteIds: value.athleteIds,
      exerciseIds: [],
      phaseChoices: [],
      phaseChoicesByDate: askPhases ? [{ date: value.date, choices: phases[value.date]?.review?.choices ?? [] }] : [],
    } satisfies PlannerSelection,
    text:
      value.text.trim() &&
      [
        ...new Set([
          value.text.trim(),
          ...(value.week ? [m.aiPlanner.weeklyInstruction] : []),
          ...(value.week && value.days?.length ? [m.aiPlanner.daysInstruction([...value.days].sort())] : []),
          ...(value.discipline ? [m.aiPlanner.disciplineInstruction(value.discipline)] : []),
        ]),
      ].join("\n"),
    reviewed: true,
    // Cet écran sait montrer les emplacements à compléter et les points « À vérifier ».
    accepts: ["slots", "checks"],
    ...(value.startTime ? { startTime: value.startTime } : {}),
    ...(Object.keys(hints).length ? { hints } : {}),
  });
  const tooLong = value.text.length > TEXT_LIMIT;
  const ready = draft.success && hasRecipients && phasesReady && !exhausted && !dictation.busy && !tooLong;
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
      <fieldset disabled={busy} hidden={solo} className="flex min-w-0 flex-col gap-3">
        <legend className="t-section mb-1">{t.who}</legend>
        <p className="t-caption font-normal text-soft">{t.whoHint}</p>
        {!hasRecipients ? (
          <p role="status">
            {t.noRecipients}{" "}
            <Link href="/athletes" className="font-semibold underline underline-offset-4">
              {t.addRecipients}
            </Link>
          </p>
        ) : null}
        {context.groups.length ? (
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
        ) : null}
        {context.athletes.length ? (
          <Fold title={t.athletes(value.athleteIds.length)}>
            <Field label={t.searchAthlete}>
              {(a) => (
                <Input {...a} type="search" value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} />
              )}
            </Field>
            <div className="grid gap-x-4 tablet:grid-cols-2">
              {athletes.slice(0, 50).map((athlete) => (
                <CheckRow
                  key={athlete.id}
                  label={`${athlete.firstName} ${athlete.lastName}`}
                  checked={value.athleteIds.includes(athlete.id)}
                  onChange={() => set({ athleteIds: toggle(value.athleteIds, athlete.id) })}
                />
              ))}
            </div>
            {athletes.length > 50 ? <p className="t-caption font-normal text-soft">{t.moreAthletes}</p> : null}
          </Fold>
        ) : null}
      </fieldset>

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <legend className="t-section mb-1">{t.when}</legend>
        <div className="flex flex-wrap gap-2">
          {[false, true].map((week) => (
            <Pill key={Number(week)} pressed={week === Boolean(value.week)} onClick={() => set({ week, days: [] })}>
              {week ? m.aiPlanner.sevenDays : m.aiPlanner.oneSession}
            </Pill>
          ))}
        </div>
        {value.week && (
          <Fold title={m.aiPlanner.availableDays} detail={value.days?.map(historyDate).join(" · ")}>
            <div className="flex flex-wrap gap-2">
              {plannerWeekDays(value.date).map((day) => (
                <Pill
                  key={day}
                  pressed={value.days?.includes(day) ?? false}
                  onClick={() => set({ days: toggle(value.days ?? [], day) })}
                >
                  {historyDate(day)}
                </Pill>
              ))}
            </div>
          </Fold>
        )}
        <Field label={t.day} hint={t.dayHint} className="tablet:max-w-sm">
          {(a) => (
            <DateInput {...a} required value={value.date} onChange={(e) => set({ date: e.target.value, days: [] })} />
          )}
        </Field>
      </fieldset>

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-2">
        <label htmlFor={fieldId} className="t-section text-balance">
          {t.field}
        </label>
        {/* Le champ et son micro ne font qu'un : le contour entoure les deux, le focus du texte l'éclaire. */}
        <div
          className={cn(
            "flex min-w-0 flex-col rounded-[10px] border border-control-line hover:border-fg-muted has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-(--ctx-focus)",
            (tooLong || dictation.error) && "border-st-missed",
          )}
        >
          <textarea
            id={fieldId}
            ref={field}
            rows={5}
            value={value.text}
            aria-describedby={`${fieldId}-hint ${fieldId}-state`}
            aria-invalid={tooLong || undefined}
            onChange={(e) => set({ text: e.target.value })}
            className="block min-h-32 w-full resize-y bg-transparent px-3 pt-3 text-[16px] text-inherit outline-none placeholder:text-fg-muted disabled:opacity-60"
          />
          {/* Pendant l'enregistrement, sur téléphone, la durée a sa ligne : les deux boutons passent dessous. */}
          <div className="flex min-h-13 flex-wrap items-center justify-end gap-x-2 gap-y-1 py-1 pl-3 pr-1">
            <p
              id={`${fieldId}-state`}
              role="status"
              className={cn(
                "min-w-0 flex-1 break-words t-caption font-normal",
                dictation.recording ? "max-tablet:basis-full" : "text-soft",
              )}
            >
              {dictation.status}
            </p>
            {dictation.recording ? (
              <Button size="sm" onClick={dictation.stop}>
                <Square aria-hidden className="size-4" fill="currentColor" />
                {t.dictation.stop}
              </Button>
            ) : null}
            {dictation.canRecover ? (
              <Button size="sm" variant="secondary" onClick={dictation.recover}>
                {t.dictation.recover}
              </Button>
            ) : null}
            {dictation.busy ? (
              <IconButton label={t.dictation.cancel} onClick={dictation.cancel}>
                <X aria-hidden className="size-5" />
              </IconButton>
            ) : (
              <IconButton label={t.dictation.start} tone="darkRound" onClick={dictation.start}>
                <Mic aria-hidden className="size-5" />
              </IconButton>
            )}
          </div>
        </div>
        {dictation.error ? (
          <p role="alert" className="t-caption text-alert">
            {dictation.error}
          </p>
        ) : null}
        {tooLong ? (
          <p role="alert" className="t-caption text-alert">
            {t.textLimit(value.text.length, TEXT_LIMIT)}
          </p>
        ) : null}
        <p id={`${fieldId}-hint`} className="t-caption font-normal text-soft">
          {t.fieldHint} {t.dictation.limit}
        </p>
        {/* Trois usages, visibles tant que le champ est vide : une séance décrite, un objectif, un mélange. */}
        {!value.text.trim() && !dictation.busy ? (
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <p className="t-caption font-normal text-soft">{t.examplesTitle}</p>
            <ul className="flex min-w-0 flex-col divide-y divide-card-line">
              {t.examples.map((example) => (
                <li key={example.kind}>
                  <button
                    type="button"
                    onClick={() => {
                      set({ text: example.text });
                      field.current?.focus();
                    }}
                    className="flex min-h-11 w-full min-w-0 flex-col gap-0.5 rounded-button py-2 text-left hover:bg-raise"
                  >
                    <span className="t-caption">{example.kind}</span>
                    <span className="break-words text-soft">{example.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </fieldset>

      <fieldset disabled={busy} className="min-w-0">
        <Fold
          title={
            <>
              {t.precise} <span className="t-caption font-normal text-soft">({t.preciseOptional})</span>
            </>
          }
          detail={precisions.length ? precisions.join(" · ") : undefined}
        >
          <p className="t-caption font-normal text-soft">{t.preciseHint}</p>
          <Field label={t.time} className="tablet:max-w-40">
            {(a) => (
              <Input {...a} type="time" value={value.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            )}
          </Field>
          <Field label={m.aiPlanner.discipline}>
            {(a) => (
              <select
                {...a}
                value={value.discipline ?? ""}
                className="min-h-11 rounded border border-control-line bg-card px-2"
                onChange={(e) => set({ discipline: e.target.value })}
              >
                <option value="">{m.exerciseClassification.unknown}</option>
                {Object.values(m.disciplines).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
          </Field>
          <div role="group" aria-label={t.duration} className="flex flex-col gap-1.5">
            <span className="t-caption">{t.duration}</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((min) => (
                <Pill
                  key={min}
                  pressed={value.durationMin === min}
                  onClick={() => set({ durationMin: value.durationMin === min ? null : min })}
                >
                  {t.durationValue(min)}
                </Pill>
              ))}
            </div>
          </div>
          <div role="group" aria-label={t.level} className="flex flex-col gap-1.5">
            <span className="t-caption">{t.level}</span>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <Pill
                  key={level}
                  pressed={value.level === level}
                  onClick={() => set({ level: value.level === level ? null : level })}
                >
                  {t.levels[level]}
                </Pill>
              ))}
            </div>
          </div>
          <div role="group" aria-label={t.equipment} className="flex flex-col gap-1.5">
            <span className="t-caption">{t.equipment}</span>
            <span className="t-caption font-normal text-soft">{t.equipmentHint}</span>
            <div className="flex flex-wrap gap-2">
              {plannerEquipment.options.map((key) => (
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
        </Fold>
      </fieldset>

      {askPhases ? (
        <fieldset disabled={busy} className="min-w-0">
          <DayPhase
            key={`${value.date}:${value.groupIds.join(",")}:${value.athleteIds.join(",")}`}
            date={value.date}
            orgId={orgId}
            groupIds={value.groupIds}
            athleteIds={value.athleteIds}
            onReady={acceptPhase}
          />
        </fieldset>
      ) : null}

      {/* Sur téléphone, l'action reste à portée de pouce : une seule, au bas de l'écran. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-card-line bg-card px-4 py-3 desktop:static desktop:mx-0 desktop:border-0 desktop:p-0">
        <Button type="submit" className="w-full tablet:w-auto" disabled={!ready || busy}>
          {busy ? t.preparing : t.prepare}
        </Button>
      </div>
    </form>
  );
}
