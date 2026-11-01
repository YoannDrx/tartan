"use client";

import type { JumpResult } from "@tartan/contracts";
import { planStretch } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Upload } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addJumpAction, createVideoAction } from "./video.action";

type Athlete = { id: string; firstName: string; lastName: string };

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
              ? "bg-white font-semibold text-ink"
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
              ? "bg-white font-semibold text-ink"
              : "border border-card-line bg-card-raised hover:bg-card-line",
          )}
        >
          {key === "pass" ? "–" : key} {label}
        </button>
      ))}
    </fieldset>
  </div>
);

// Garde chaque image d'un ralenti : voir video-stretch. Le fichier d'origine part tel quel si on ne sait pas le lire.
const prepareVideo = async (file: File): Promise<{ file: File; fps: number | null; timeScale: number }> => {
  const plan = await planStretch(
    async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    file.size,
  );
  if (!plan) return { file, fps: null, timeScale: 1 };
  if (!plan.patch) return { file, fps: plan.fps, timeScale: 1 };
  const { offset, bytes } = plan.patch;
  const parts = [file.slice(0, offset), bytes as BlobPart, file.slice(offset + bytes.byteLength)];
  return { file: new File(parts, file.name, { type: file.type }), fps: plan.fps, timeScale: plan.timeScale };
};

export const UploadVideoDialog = ({ athletes, enabled }: { athletes: Athlete[]; enabled: boolean }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [jump, setJump] = useState({ height: "", attemptNo: 1, result: "O" as JumpResult, steps: "" });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { executeAsync, isPending } = useAction(createVideoAction);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Importer un saut"
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
            if (!file) return setError("Choisis une vidéo.");
            const prepared = await prepareVideo(file);
            const res = await executeAsync({
              athleteId,
              fps: prepared.fps,
              timeScale: prepared.timeScale,
              attempt: jump.height
                ? {
                    barHeightCm: Number(jump.height),
                    attemptNo: jump.attemptNo,
                    result: jump.result,
                    approachSteps: jump.steps ? Number(jump.steps) : null,
                  }
                : null,
            });
            if (!res?.data) return setError(res?.serverError ?? m.errors.invalid);
            const { createUpload } = await import("@mux/upchunk");
            const upload = createUpload({ endpoint: res.data.uploadUrl, file: prepared.file, chunkSize: 5120 });
            setProgress(0);
            upload.on("progress", (ev) => setProgress(Math.round(ev.detail)));
            upload.on("error", () => {
              setProgress(null);
              setError("L'envoi a échoué. Vérifie ta connexion et réessaie.");
            });
            upload.on("success", () => {
              setProgress(null);
              setOpen(false);
              toast.ok(m.video.processing);
              router.refresh();
            });
          }}
        >
          <Field label="Athlète">
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
          <Field label="Vidéo">
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
          <JumpFields value={jump} onChange={setJump} />
          {error ? (
            <p role="alert" className="text-alert">
              {error}
            </p>
          ) : null}
          {progress !== null ? (
            <progress value={progress} max={100} className="w-full accent-brand" aria-label="Progression de l'envoi" />
          ) : null}
          <Button type="submit" disabled={isPending || progress !== null}>
            {m.common.send}
          </Button>
        </form>
      )}
    </Dialog>
  );
};

export const JumpEntryDialog = ({ athletes }: { athletes: Athlete[] }) => {
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const [jump, setJump] = useState({ height: "", attemptNo: 1, result: "O" as JumpResult, steps: "" });
  const { execute, isPending } = useAction(addJumpAction, {
    onSuccess: () => {
      toast.ok("Essai noté.");
      setJump((j) => ({ ...j, attemptNo: j.result === "X" ? Math.min(j.attemptNo + 1, 3) : 1 }));
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.video.barSheet}
      description="Note chaque essai, avec ou sans vidéo."
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
          if (!jump.height) return toast.error("Indique la hauteur de la barre.");
          execute({
            athleteId,
            barHeightCm: Number(jump.height),
            attemptNo: jump.attemptNo,
            result: jump.result,
            approachSteps: jump.steps ? Number(jump.steps) : null,
          });
        }}
      >
        <Field label="Athlète">
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
        <JumpFields value={jump} onChange={setJump} />
        <Button type="submit" disabled={isPending}>
          Noter l'essai
        </Button>
      </form>
    </Dialog>
  );
};
