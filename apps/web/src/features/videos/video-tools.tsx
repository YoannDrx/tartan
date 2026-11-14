"use client";

import type { JumpResult } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useSpaceId } from "@/features/offline/offline-provider";
import { submitOp } from "@/features/offline/op-queue";
import { enqueueVideo, prepareVideo } from "./upload-queue";

type Athlete = { id: string; firstName: string; lastName: string };
export type LinkableSession = { id: string; label: string; today: boolean; exercises?: { id: string; name: string }[] };

const JumpFields = ({
  value,
  onChange,
}: {
  value: { height: string; attemptNo: number; result: JumpResult; steps: string };
  onChange: (v: { height: string; attemptNo: number; result: JumpResult; steps: string }) => void;
}) => (
  <div className="grid grid-cols-2 gap-3">
    <Field label={`${m.video.bar} (cm)`}>
      {(a) => (
        <Input
          {...a}
          type="number"
          inputMode="numeric"
          min={50}
          max={700}
          value={value.height}
          onChange={(e) => onChange({ ...value, height: e.target.value })}
        />
      )}
    </Field>
    <Field label={m.video.approachSteps}>
      {(a) => (
        <Input
          {...a}
          type="number"
          inputMode="numeric"
          min={1}
          value={value.steps}
          onChange={(e) => onChange({ ...value, steps: e.target.value })}
        />
      )}
    </Field>
    <fieldset className="col-span-2 flex flex-wrap items-center gap-2">
      <legend className="t-caption mb-1">{m.video.attempt}</legend>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value.attemptNo === n}
          onClick={() => onChange({ ...value, attemptNo: n })}
          className={cn(
            "t-num size-11 rounded-button text-[18px]",
            value.attemptNo === n
              ? "bg-accent font-semibold text-on-accent"
              : "border border-card-line bg-card-raised hover:bg-card-line",
          )}
        >
          {n}
        </button>
      ))}
    </fieldset>
    <fieldset className="col-span-2 flex flex-wrap items-center gap-2">
      <legend className="t-caption mb-1">{m.video.result}</legend>
      {(
        [
          ["O", m.video.cleared],
          ["X", m.video.failedJump],
          ["pass", m.video.passed],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value.result === key}
          onClick={() => onChange({ ...value, result: key })}
          className={cn(
            "min-h-11 rounded-full px-4 font-semibold",
            value.result === key
              ? "bg-accent font-semibold text-on-accent"
              : "border border-card-line bg-card-raised hover:bg-card-line",
          )}
        >
          {key === "pass" ? "–" : key} {label}
        </button>
      ))}
    </fieldset>
  </div>
);

const SessionField = ({
  sessions,
  value,
  onChange,
}: {
  sessions: LinkableSession[];
  value: string;
  onChange: (id: string) => void;
}) =>
  sessions.length > 0 ? (
    <Field label={m.video.linkedSession}>
      {(a) => (
        <Select {...a} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{m.video.noLinkedSession}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  ) : null;

export const UploadVideoDialog = ({
  athletes,
  sessions,
  enabled,
  self = false,
  exercises = [],
}: {
  athletes: Athlete[];
  sessions: LinkableSession[];
  enabled: boolean;
  self?: boolean;
  exercises?: { id: string; name: string }[];
}) => {
  const organizationId = useSpaceId();
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(sessions.find((s) => s.today)?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [exerciseId, setExerciseId] = useState("");
  const availableExercises = self ? (sessions.find((s) => s.id === sessionId)?.exercises ?? []) : exercises;
  const [jump, setJump] = useState({ height: "", attemptNo: 1, result: "O" as JumpResult, steps: "" });
  const [isPending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.video.importTitle}
      description={m.video.slowHint}
      trigger={
        <Button size="sm">
          <Upload aria-hidden className="size-5" />
          {m.video.import}
        </Button>
      }
    >
      {!enabled ? (
        <p role="status">{m.errors.videoDisabled}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (submitting.current) return;
            if (!file) return setError(m.videoCollaboration.chooseFile);
            if (!file.type.startsWith("video/") || file.size > 1_000_000_000)
              return setError(m.videoCollaboration.invalidFile);
            submitting.current = true;
            setPending(true);
            try {
              const video = await prepareVideo(file);
              if ("tooLongSeconds" in video) {
                setPending(false);
                return setError(m.video.tooLong(video.tooLongSeconds));
              }
              await enqueueVideo(
                organizationId,
                {
                  athleteId: self ? undefined : athleteId,
                  exerciseId: exerciseId || null,
                  scheduledSessionId: sessionId || null,
                  recordedAt: new Date().toISOString(),
                  attempt: jump.height
                    ? {
                        barHeightCm: Number(jump.height),
                        attemptNo: jump.attemptNo,
                        result: jump.result,
                        approachSteps: jump.steps ? Number(jump.steps) : null,
                      }
                    : null,
                },
                video,
              );
              setPending(false);
              setOpen(false);
              setFile(null);
              toast.ok(m.offline.uploadQueued);
            } catch {
              setError(m.common.genericError);
            } finally {
              submitting.current = false;
              setPending(false);
            }
          }}
        >
          {self ? (
            <p className="text-soft">{m.videoCollaboration.private}</p>
          ) : (
            <Field label={m.videoCollaboration.athlete}>
              {(a) => (
                <Select {...a} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
                  {athletes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.firstName} {x.lastName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label={m.videoCollaboration.file}>
            {(a) => (
              <Input
                {...a}
                type="file"
                accept="video/*"
                className="py-2"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={camera}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              aria-label={m.video.capture}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" size="sm" onClick={() => camera.current?.click()}>
              {m.video.capture}
            </Button>
            {file ? <span className="min-w-0 break-all text-sm">{file.name}</span> : null}
          </div>
          <SessionField
            sessions={sessions}
            value={sessionId}
            onChange={(id) => {
              setSessionId(id);
              setExerciseId("");
            }}
          />
          {availableExercises.length ? (
            <Field label={m.video.exerciseLink}>
              {(a) => (
                <Select {...a} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                  <option value="">{m.video.exerciseNone}</option>
                  {availableExercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          {/* La barre ne concerne que les sauteurs, et seul l'encadrement la note : repliée, jamais côté athlète. */}
          {self ? null : (
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">
                {m.video.barFields}
              </summary>
              <JumpFields value={jump} onChange={setJump} />
            </details>
          )}
          {error ? (
            <p role="alert" className="text-alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {m.common.send}
          </Button>
        </form>
      )}
    </Dialog>
  );
};

export const JumpEntryDialog = ({ athletes, sessions }: { athletes: Athlete[]; sessions: LinkableSession[] }) => {
  const organizationId = useSpaceId();
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(sessions.find((s) => s.today)?.id ?? "");
  const [jump, setJump] = useState({ height: "", attemptNo: 1, result: "O" as JumpResult, steps: "" });
  const [isPending, setPending] = useState(false);
  // Le coach note les barres au bord de la piste, réseau ou pas.
  const note = async () => {
    setPending(true);
    const clientId = crypto.randomUUID();
    const res = await submitOp({
      id: clientId,
      kind: "attempt",
      target: athleteId,
      path: `/orgs/${organizationId}/jump-attempts`,
      body: {
        clientId,
        athleteId,
        scheduledSessionId: sessionId || null,
        barHeightCm: Number(jump.height),
        attemptNo: jump.attemptNo,
        result: jump.result,
        approachSteps: jump.steps ? Number(jump.steps) : null,
      },
    });
    setPending(false);
    if (res.state === "error") return toast.error(res.message);
    toast.ok(res.state === "queued" ? m.offline.attemptQueued : m.videoCollaboration.attemptSaved);
    setJump((j) => ({ ...j, attemptNo: j.result === "X" ? Math.min(j.attemptNo + 1, 3) : 1 }));
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.video.barSheet}
      description={m.videoCollaboration.attemptDescription}
      trigger={
        <Button size="sm" variant="secondary">
          {m.video.barSheet}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!jump.height) return toast.error(m.videoCollaboration.heightRequired);
          void note();
        }}
      >
        <Field label={m.videoCollaboration.athlete}>
          {(a) => (
            <Select {...a} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              {athletes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.firstName} {x.lastName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <SessionField sessions={sessions} value={sessionId} onChange={setSessionId} />
        <JumpFields value={jump} onChange={setJump} />
        <Button type="submit" disabled={isPending}>
          {m.videoCollaboration.noteAttempt}
        </Button>
      </form>
    </Dialog>
  );
};
