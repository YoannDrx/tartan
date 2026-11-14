"use client";

import type { ExerciseFamily, ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { exerciseClip } from "@tartan/mascot/exercises";
import { useAction } from "next-safe-action/hooks";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { GuideMotion } from "@/features/exercises/guide-motion";
import { approveMotionFamilyAction } from "./motion.action";

const t = m.admin.movements;
const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

export type MotionEntry = { key: string; name: string; guide: ExerciseGuide };

// Une famille de gestes à relire : chacun arrêté sur son installation, lu à la demande, puis la validation.
export const MotionFamily = ({
  family,
  entries,
  approved,
}: {
  family: ExerciseFamily;
  entries: MotionEntry[];
  approved: boolean;
}) => {
  const review = useAction(approveMotionFamilyAction, { onError });
  const name = m.exerciseGuide.families[family];
  const done = entries.filter((entry) => exerciseClip(entry.key)).length;
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`famille-${family}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`famille-${family}`} className="t-h2">
            {name}
          </h2>
          <p className="text-soft">
            {t.progress(done, entries.length)} · {approved ? t.approved : t.pending}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={approved ? "secondary" : "primary"}
          disabled={review.isPending || done === 0}
          onClick={() => review.execute({ family, approved: !approved })}
        >
          {approved ? t.reopen(name) : t.approve(name)}
        </Button>
      </div>
      <ul className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
        {entries.map((entry) => {
          const clip = exerciseClip(entry.key);
          return (
            <li key={entry.key}>
              <Sheet className="flex h-full flex-col gap-2 p-3">
                <h3 className="font-semibold">{entry.name}</h3>
                {clip ? (
                  <GuideMotion
                    guide={{ ...entry.guide, illustration: { ...entry.guide.illustration, motion: approved ? "approved" : "review" } }}
                    autoPlay={false}
                  />
                ) : (
                  <p className="text-soft">{t.missing}</p>
                )}
              </Sheet>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
