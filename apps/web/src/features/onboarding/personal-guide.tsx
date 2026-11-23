"use client";

import type { OnboardingResponse } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { Check } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LaneNumber } from "@/components/lane-number";
import { Chip } from "@/components/states";
import { TrackLap } from "@/components/track";
import { Button } from "@/components/ui/button";
import { onErr } from "@/features/settings/shared";
import { cn } from "@/lib/cn";
import { FIRST_STEPS_PATH, PERSONAL_STEP_PATH } from "@/lib/onboarding-paths";
import { updateOnboardingAction } from "./onboarding-state.action";

const t = w.personal.guide;
const linkClass = "inline-flex min-h-11 items-center font-semibold text-ctx-link underline underline-offset-4";

export type PersonalGuideData = NonNullable<OnboardingResponse["personal"]> & {
  dismissedAt: string | null;
  templates: { id: string; title: string }[];
  plannerAvailable: boolean;
};

// La carte « Pour démarrer » de l'athlète autonome, sur sa journée et sur sa page des premiers pas : la même mécanique
// que celle du coach (tour de piste, prochaine étape marquée, refermable), avec ses étapes d'athlète.
export const PersonalGuide = ({ data, place }: { data: PersonalGuideData; place: "today" | "page" }) => {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const update = useAction(updateOnboardingAction, {
    onSuccess: () => router.refresh(),
    onError: (error) => {
      setHidden(false);
      onErr(error);
    },
  });
  if (hidden) return null;
  const next = data.steps.find((step) => !step.done)?.key ?? null;
  const lap = t.progress(data.progress.done, data.progress.total);
  return (
    <section aria-labelledby="demarrer-seul" className="on-card overflow-hidden rounded-card bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
        <span className="tartan-band shrink-0 rounded-button px-2 py-2.5">
          <TrackLap value={data.progress.done / data.progress.total} label={lap} className="block w-14 tablet:w-20" />
        </span>
        <div className="flex min-w-32 flex-1 flex-col">
          <h2 id="demarrer-seul" className="t-h2">
            {t.title}
          </h2>
          <p className="t-caption font-normal text-soft">{lap}</p>
        </div>
        {place === "today" ? (
          <Button
            size="sm"
            variant="quiet"
            disabled={update.isPending}
            onClick={() => {
              setHidden(true);
              update.execute({ dismissed: true });
            }}
          >
            {t.dismiss}
          </Button>
        ) : data.dismissedAt ? (
          <Button
            size="sm"
            variant="secondary"
            className="max-tablet:w-full"
            disabled={update.isPending}
            onClick={() => update.execute({ dismissed: false })}
          >
            {t.restore}
          </Button>
        ) : null}
      </div>
      <ol className="mt-2 divide-y divide-card-line">
        {data.steps.map((step, index) => {
          const current = step.key === next;
          const copy = t.steps[step.key];
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className={cn("flex items-start gap-4 px-4 py-3", current && "bg-card-raised")}
            >
              {step.done ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check aria-hidden className="size-5" strokeWidth={3} />
                </span>
              ) : (
                <LaneNumber n={index + 1} className="w-8 text-[32px]" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col">
                  <span className={cn("flex flex-wrap items-center gap-2 font-semibold", step.done && "text-soft")}>
                    {copy.title}
                    {step.done ? <span className="sr-only">{t.done}</span> : null}
                    {current ? <Chip tone="brand">{t.next}</Chip> : null}
                  </span>
                  {!step.done ? <span className="t-caption max-w-prose font-normal text-soft">{copy.body}</span> : null}
                </div>
                {!step.done && step.key === "plan" ? (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {data.templates.map((template) => (
                      <li key={template.id}>
                        <Link href={`/seances/nouvelle?modele=${template.id}`} className={linkClass}>
                          {template.title}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href={PERSONAL_STEP_PATH.plan} className={linkClass}>
                        {t.blank}
                      </Link>
                    </li>
                    {data.plannerAvailable ? (
                      <li>
                        <Link href="/planificateur" className={linkClass}>
                          {t.planner}
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : !step.done && !(place === "today" && step.key === "validate") ? (
                  <div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={PERSONAL_STEP_PATH[step.key]}>{copy.action}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {place === "today" ? (
        <div className="border-t border-card-line px-4 py-3">
          <Link href={FIRST_STEPS_PATH} className={linkClass}>
            {t.pageTitle}
          </Link>
        </div>
      ) : null}
    </section>
  );
};
