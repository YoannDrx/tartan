"use client";

import { celebrationFromResponse } from "@tartan/domain";
import { ConfirmedRecords } from "../progression/confirmed-records";
import type { AthleteSessionDetail, PainInput, StrengthRecordValue } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { StatusIcon } from "@/components/status-cell";
import { Victory } from "@/components/victory";
import { cn } from "@/lib/cn";
import { newClientId, pendingStatusFor, sendValidation } from "./validation-queue";

type Status = "done" | "partial";

const RpeScale = ({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) => (
  <fieldset>
    <legend className="t-caption">{m.validation.rpe}</legend>
    <p className="t-caption mb-2 font-normal text-soft">{m.validation.rpeHint}</p>
    <div className="grid grid-cols-5 gap-1.5 tablet:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`Effort ${n} sur 10`}
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "t-num min-h-11 rounded-button text-[18px]",
            value === n
              ? "bg-accent font-semibold text-on-accent"
              : "border border-card-line bg-card-raised hover:bg-card-line",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  </fieldset>
);

// Un toucher sur « Fait » suffit : tout le reste est facultatif (§ 2.4).
export const QuickValidate = ({
  session,
  organizationId,
  healthConsent,
  sets = [],
  onDark,
}: {
  session: Pick<AthleteSessionDetail, "id" | "variant" | "durationMin" | "sessionVersion" | "logVersion" | "log">;
  organizationId: string;
  healthConsent: boolean;
  sets?: { itemRef: string; setIndex: number; done: boolean }[];
  onDark?: boolean;
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  // Page rouverte hors ligne : ce qui attend d'être envoyé compte déjà comme validé.
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    void pendingStatusFor(session.id).then((pending) => {
      if (pending) setWaiting(true);
    });
  }, [session.id]);
  const version = useRef(session.log?.version ?? session.logVersion ?? 0);
  const busy = useRef(false);
  const [details, setDetails] = useState(false);
  const [rpe, setRpe] = useState<number | null>(session.log?.rpe ?? null);
  const [duration, setDuration] = useState(session.log?.durationMin ? String(session.log.durationMin) : "");
  const [comment, setComment] = useState(session.log?.comment ?? "");
  const [showPain, setShowPain] = useState(Boolean(session.log?.pain));
  const [pain, setPain] = useState<PainInput>(session.log?.pain ?? { bodyArea: "knee", side: "left", intensity: 5 });
  const [sending, setSending] = useState(false);
  const [victory, setVictory] = useState(0);
  const [records, setRecords] = useState<StrengthRecordValue[]>([]);

  const send = async (next: Status, extra: { withDetails: boolean }) => {
    if (busy.current) return false;
    if (session.sessionVersion === undefined) {
      toast.error(m.progression.sessionConflict);
      return false;
    }
    busy.current = true;
    setSending(true);
    const expectedVersion = version.current;
    const res = await sendValidation({
      organizationId,
      sessionId: session.id,
      input: {
        clientId: newClientId(),
        status: next,
        variantDone: session.variant,
        expectedVersion,
        expectedSessionVersion: session.sessionVersion,
        ...(extra.withDetails
          ? {
              writeScope: "feedback" as const,
              ...(rpe !== (session.log?.rpe ?? null) ? { rpe } : {}),
              ...(duration !== (session.log?.durationMin ? String(session.log.durationMin) : "")
                ? { durationMin: duration ? Number(duration) : null }
                : {}),
              ...(comment !== (session.log?.comment ?? "") ? { comment: comment || null } : {}),
              ...(JSON.stringify(showPain ? pain : null) !== JSON.stringify(session.log?.pain ?? null)
                ? { pain: showPain ? pain : null }
                : {}),
            }
          : { writeScope: "status" as const, sets }),
      },
    });
    setSending(false);
    busy.current = false;
    if (res.state === "error") {
      toast.error(res.message);
      return false;
    }
    const celebration = res.state === "sent" ? celebrationFromResponse(res.data) : null;
    if (celebration) {
      setRecords(celebration.records);
      setVictory((old) => old + 1);
    } else if (!extra.withDetails) setRecords([]);
    // Le complément dépend de cette mutation, même si les deux attendent le réseau.
    // Ne jamais remplacer cette version par celle d'un autre appareil après un conflit.
    version.current = expectedVersion + 1;
    // La feuille de détails confirme déjà : le message ne sert qu'à signaler l'attente de réseau.
    if (res.state === "queued") toast.ok(m.validation.queued);
    else if (extra.withDetails) toast.ok("Précisions envoyées à ton coach.");
    return true;
  };

  // La carte se met à jour à la fermeture : rafraîchir plus tôt la démonterait avec ses détails.
  const closeDetails = (open: boolean) => {
    setDetails(open);
    // Hors ligne, rafraîchir renverrait vers une page d'erreur : la carte reste à jour localement.
    if (!open && navigator.onLine) router.refresh();
  };

  const validate = async (value: Status) => {
    if (await send(value, { withDetails: false })) {
      setStatus(value);
      setDetails(true);
    }
  };

  if (waiting) {
    return (
      <p role="status" className="font-semibold">
        {m.validation.waitingSend}
      </p>
    );
  }

  return (
    <>
      <Victory play={victory} recordCount={records.length} />
      <Button size="lg" variant="primary" className="w-full" disabled={sending} onClick={() => validate("done")}>
        {m.today.quickDone}
      </Button>
      <Button size="md" variant="secondary" className="w-full" disabled={sending} onClick={() => validate("partial")}>
        {m.today.quickPartial}
      </Button>
      <Dialog
        open={details}
        onOpenChange={closeDetails}
        title={status === "partial" ? m.today.validatedPartial : m.today.validated}
        description={m.validation.detailsLead}
      >
        <div className="flex flex-col gap-4">
          {status === "partial" ? (
            <StatusIcon status="partial" size={48} className="self-start" />
          ) : (
            <svg aria-hidden width="48" height="48" viewBox="0 0 26 26" className="self-start">
              <circle cx="13" cy="13" r="12" fill="var(--st-done)" />
              <path
                className="validation-check"
                d="M8 13.5l3.2 3.2L18 10"
                fill="none"
                stroke="var(--st-on)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <Button size="lg" onClick={() => closeDetails(false)}>
            {m.validation.finish}
          </Button>
          <ConfirmedRecords records={records} />
          {healthConsent ? <RpeScale value={rpe} onChange={setRpe} /> : null}
          <Field label={m.validation.duration}>
            {(a) => (
              <Input
                {...a}
                type="number"
                inputMode="numeric"
                min={1}
                placeholder={session.durationMin ? String(session.durationMin) : undefined}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            )}
          </Field>
          <Field label={m.validation.comment}>
            {(a) => (
              <Textarea
                {...a}
                className="min-h-11"
                placeholder={m.validation.commentPlaceholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </Field>
          {healthConsent ? (
            <div className="flex flex-col gap-3">
              <Button
                variant={showPain ? "inverse" : "secondary"}
                size="sm"
                aria-pressed={showPain}
                className="self-start"
                onClick={() => setShowPain(!showPain)}
              >
                {m.validation.pain}
              </Button>
              {showPain ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={m.validation.painArea}>
                    {(a) => (
                      <Select
                        {...a}
                        value={pain.bodyArea}
                        onChange={(e) => setPain({ ...pain, bodyArea: e.target.value as PainInput["bodyArea"] })}
                      >
                        {(Object.keys(m.bodyArea) as PainInput["bodyArea"][]).map((k) => (
                          <option key={k} value={k}>
                            {m.bodyArea[k]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={m.validation.painSide}>
                    {(a) => (
                      <Select
                        {...a}
                        value={pain.side}
                        onChange={(e) => setPain({ ...pain, side: e.target.value as PainInput["side"] })}
                      >
                        {(Object.keys(m.bodySide) as PainInput["side"][]).map((k) => (
                          <option key={k} value={k}>
                            {m.bodySide[k]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={`${m.validation.painIntensity} (1 à 10)`} className="col-span-2">
                    {(a) => (
                      <Input
                        {...a}
                        type="number"
                        min={1}
                        max={10}
                        value={pain.intensity}
                        onChange={(e) => setPain({ ...pain, intensity: Number(e.target.value) || 1 })}
                      />
                    )}
                  </Field>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="t-caption font-normal text-soft">{m.validation.healthDisabled}</p>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={sending}
            onClick={async () => {
              if (await send(status ?? "done", { withDetails: true })) closeDetails(false);
            }}
          >
            {m.validation.addDetails}
          </Button>
        </div>
      </Dialog>
    </>
  );
};
