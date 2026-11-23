"use client";

import type { ExerciseFamily, ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { exerciseClip } from "@tartan/mascot/exercises";
import { motionLevel } from "@tartan/mascot/v2/engine";
import { ChevronDown } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
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

// La série de relecture du moteur actuel, telle que la console l'enregistre (motion-review.service.ts).
const groupOf = (family: ExerciseFamily) => `${family}:v2`;

// Où en est le geste : écrit à la main, ou relevé d'un geste du premier moteur.
const Level = ({ entry }: { entry: MotionEntry }) => {
  const level = motionLevel(entry.key);
  if (!level) return null;
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
    </p>
  );
};

const Entries = ({ entries, approved, wide }: { entries: MotionEntry[]; approved: boolean; wide?: boolean }) => (
  <ul className={cn("grid gap-3", wide ? "desktop:grid-cols-2" : "tablet:grid-cols-2 desktop:grid-cols-3")}>
    {entries.map((entry) => (
      <li key={entry.key}>
        <Sheet className="flex h-full flex-col gap-2 p-3">
          <h3 className="font-semibold">{entry.name}</h3>
          <Level entry={entry} />
          <GuideMotion
            guide={{
              ...entry.guide,
              illustration: { ...entry.guide.illustration, motion: approved ? "approved" : "review" },
            }}
            autoPlay={false}
            bothViews={wide}
          />
        </Sheet>
      </li>
    ))}
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
// Les gestes du moteur actuel forment une série à part, avec leurs deux vues : une famille validée sur le premier
// moteur ne les couvre pas. Les familles sont repliées : l'atelier se lit d'abord comme une liste de familles et de
// leur état, et les gestes d'une famille ne se construisent qu'à son ouverture (68 000 px à 390 px sinon).
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
  const next = entries.filter((entry) => exerciseClip(entry.key));
  const nextApproved = approved.includes(groupOf(family));
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby={`famille-${family}`}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group">
        <summary className="on-card flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-card bg-card px-4 py-3">
          <span className="min-w-0">
            <h2 id={`famille-${family}`} className="t-h2">
              {name}
            </h2>
            <span className="block text-soft">
              {t.progress(next.length, entries.length)} · {nextApproved ? v.newApproved : t.pending}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-5 shrink-0 group-open:rotate-180" />
        </summary>
        {open && next.length ? (
          <div className="mt-3 flex flex-col gap-3">
            <Batch
              id={`famille-${family}-v2`}
              title={v.newBatch}
              lead={v.newBatchLead}
              status={nextApproved ? v.newApproved : t.pending}
              entries={next}
              approved={nextApproved}
              label={nextApproved ? v.reopenNew(name) : v.approveNew(name)}
              pending={review.isPending}
              onToggle={() => review.execute({ family, approved: !nextApproved })}
              wide
            />
          </div>
        ) : null}
      </details>
    </section>
  );
};
