"use client";

import type { ExerciseFamily, ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { exerciseClip } from "@tartan/mascot/exercises";
import { brokenConstraints, motionLevel, reviewBatch, type ReviewBatch } from "@tartan/mascot/v2/engine";
import { useAction } from "next-safe-action/hooks";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { GuideMotion } from "@/features/exercises/guide-motion";
import { cn } from "@/lib/cn";
import { approveMotionFamilyAction } from "./motion.action";

const t = m.admin.movements;
const v = w.admin.movements;
const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

export type MotionEntry = { key: string; name: string; guide: ExerciseGuide };

const groupOf = (family: ExerciseFamily, batch?: ReviewBatch) => (batch ? `${family}:${batch}` : family);

// Où en est le geste : écrit à la main, relevé, ou à reprendre avec ce qu'il ne respecte pas encore.
const Level = ({ entry }: { entry: MotionEntry }) => {
  const level = motionLevel(entry.key);
  if (!level) return null;
  const broken = brokenConstraints(entry.key).map((name) => v.constraints[name]);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span
        className={cn(
          "rounded-full border border-card-line px-2 py-0.5 font-semibold",
          level === "ecrit" && "border-transparent bg-accent text-on-accent",
        )}
      >
        {v.levels[level]}
      </span>
      {broken.length ? <span className="text-soft">{v.toRedo(broken.join(", "))}</span> : null}
    </p>
  );
};

const Entries = ({ entries, approved, wide }: { entries: MotionEntry[]; approved: boolean; wide?: boolean }) => (
  <ul className={cn("grid gap-3", wide ? "desktop:grid-cols-2" : "tablet:grid-cols-2 desktop:grid-cols-3")}>
    {entries.map((entry) => {
      const clip = exerciseClip(entry.key);
      return (
        <li key={entry.key}>
          <Sheet className="flex h-full flex-col gap-2 p-3">
            <h3 className="font-semibold">{entry.name}</h3>
            <Level entry={entry} />
            {clip ? (
              <GuideMotion
                guide={{
                  ...entry.guide,
                  illustration: { ...entry.guide.illustration, motion: approved ? "approved" : "review" },
                }}
                autoPlay={false}
                bothViews={wide}
              />
            ) : (
              <p className="text-soft">{t.missing}</p>
            )}
          </Sheet>
        </li>
      );
    })}
  </ul>
);

// Une série de gestes à relire, et sa validation.
const Batch = ({
  id,
  title,
  lead,
  status,
  entries,
  approved,
  label,
  pending,
  onToggle,
  wide,
}: {
  id: string;
  title: string;
  lead?: string;
  status: string;
  entries: MotionEntry[];
  approved: boolean;
  label: string;
  pending: boolean;
  onToggle: () => void;
  wide?: boolean;
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 id={id} className="t-h3">
          {title}
        </h3>
        {lead ? <p className="max-w-prose text-soft">{lead}</p> : null}
        <p className="text-soft">
          {t.progress(entries.length, entries.length)} · {status}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={approved ? "secondary" : "primary"}
        disabled={pending}
        onClick={onToggle}
      >
        {label}
      </Button>
    </div>
    <Entries entries={entries} approved={approved} wide={wide} />
  </>
);

// Une famille de gestes à relire : chacun arrêté sur son installation, lu à la demande, puis la validation.
// Les gestes du nouveau moteur forment une série à part, avec leurs deux vues : une famille validée avant eux ne
// les couvre pas. Les gestes à reprendre restent sur l'ancien moteur, dans leur série d'origine.
export const MotionFamily = ({
  family,
  entries,
  approved,
}: {
  family: ExerciseFamily;
  entries: MotionEntry[];
  approved: readonly string[];
}) => {
  const review = useAction(approveMotionFamilyAction, { onError });
  const name = m.exerciseGuide.families[family];
  const of = (batch: ReviewBatch | undefined) => entries.filter((entry) => reviewBatch(entry.key) === batch);
  const [next, first, face] = [of("v2"), of(undefined), of("face")];
  const done = entries.filter((entry) => exerciseClip(entry.key)).length;
  const [nextApproved, firstApproved, faceApproved] = [
    approved.includes(groupOf(family, "v2")),
    approved.includes(groupOf(family)),
    approved.includes(groupOf(family, "face")),
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`famille-${family}`}>
      <div>
        <h2 id={`famille-${family}`} className="t-h2">
          {name}
        </h2>
        <p className="text-soft">{t.progress(done, entries.length)}</p>
      </div>
      {next.length ? (
        <Batch
          id={`famille-${family}-v2`}
          title={v.newBatch}
          lead={v.newBatchLead}
          status={nextApproved ? v.newApproved : t.pending}
          entries={next}
          approved={nextApproved}
          label={nextApproved ? v.reopenNew(name) : v.approveNew(name)}
          pending={review.isPending}
          onToggle={() => review.execute({ family, approved: !nextApproved, batch: "v2" })}
          wide
        />
      ) : null}
      {first.length ? (
        <Batch
          id={`famille-${family}-v1`}
          title={v.oldBatch}
          status={firstApproved ? t.approved : t.pending}
          entries={first}
          approved={firstApproved}
          label={firstApproved ? t.reopen(name) : t.approve(name)}
          pending={review.isPending}
          onToggle={() => review.execute({ family, approved: !firstApproved })}
        />
      ) : null}
      {face.length ? (
        <Batch
          id={`famille-${family}-face`}
          title={t.faceBatch}
          status={faceApproved ? t.faceApproved : t.pending}
          entries={face}
          approved={faceApproved}
          label={faceApproved ? t.reopenFace(name) : t.approveFace(name)}
          pending={review.isPending}
          onToggle={() => review.execute({ family, approved: !faceApproved, batch: "face" })}
        />
      ) : null}
    </section>
  );
};
