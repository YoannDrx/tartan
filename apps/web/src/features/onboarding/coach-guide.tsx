"use client";

import type { CoachOptionalStepKeyValue, CoachStepKeyValue, OnboardingResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Check, ChevronDown } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LaneNumber } from "@/components/lane-number";
import { Chip } from "@/components/states";
import { TrackLap } from "@/components/track";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { onErr } from "@/features/settings/shared";
import { cn } from "@/lib/cn";
import {
  COACH_OPTIONAL_PATH,
  COACH_STEP_PATH,
  DEMO_SPACE_ENABLED,
  DEMO_SPACE_PATH,
  FIRST_STEPS_PATH,
} from "@/lib/onboarding-paths";
import { InvitePanel } from "./invite-panel";
import { updateOnboardingAction } from "./onboarding-state.action";

const t = w.onboarding.guide;

export type GuideData = Pick<OnboardingResponse, "steps" | "optionalSteps" | "progress" | "dismissedAt"> & {
  group: { id: string; name: string } | null;
  templates: { id: string; title: string }[];
  plannerAvailable: boolean;
};

const linkClass = "font-semibold text-ctx-link underline underline-offset-4";

const StepActions = ({
  step,
  data,
  invite,
  setInvite,
}: {
  step: CoachStepKeyValue;
  data: GuideData;
  invite: "link" | "qr" | null;
  setInvite: (value: "link" | "qr" | null) => void;
}): ReactNode => {
  const copy = t.steps;
  switch (step) {
    case "profile":
      return (
        <Button asChild size="sm" variant="secondary">
          <Link href={COACH_STEP_PATH.profile}>{copy.profile.action}</Link>
        </Button>
      );
    case "invite":
      return data.group ? (
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={invite === "link"}
          onClick={() => setInvite(invite === "link" ? null : "link")}
        >
          {invite === "link" ? copy.invite.hide : copy.invite.action}
        </Button>
      ) : null;
    case "create":
      return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {data.templates.map((template) => (
            <li key={template.id}>
              <Link
                href={`/seances/nouvelle?modele=${template.id}`}
                className={cn(linkClass, "inline-flex min-h-11 items-center")}
              >
                {copy.create.template(template.title)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={COACH_STEP_PATH.create} className={cn(linkClass, "inline-flex min-h-11 items-center")}>
              {copy.create.blank}
            </Link>
          </li>
          {data.plannerAvailable ? (
            <li>
              <Link href="/planificateur" className={cn(linkClass, "inline-flex min-h-11 items-center")}>
                {copy.create.planner}
              </Link>
            </li>
          ) : null}
        </ul>
      );
    case "publish":
      return (
        <Button asChild size="sm" variant="secondary">
          <Link href={COACH_STEP_PATH.publish}>{copy.publish.action}</Link>
        </Button>
      );
    case "validate":
      return data.group ? (
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={invite === "qr"}
          onClick={() => setInvite(invite === "qr" ? null : "qr")}
        >
          {copy.validate.action}
        </Button>
      ) : null;
  }
};

// Les étapes facultatives : faites d'après les faits, écartées ou reprises d'un geste.
// Sur le suivi, elles restent repliées : la carte garde les étapes obligatoires sous les yeux.
const OptionalSteps = ({ steps, folded }: { steps: GuideData["optionalSteps"]; folded: boolean }) => {
  const router = useRouter();
  const [local, setLocal] = useState<Partial<Record<CoachOptionalStepKeyValue, boolean>>>({});
  const update = useAction(updateOnboardingAction, { onSuccess: () => router.refresh(), onError: onErr });
  const done = steps.filter((step) => step.done).length;
  return (
    <section aria-labelledby="pour-aller-plus-loin" className="border-t border-card-line px-4">
      <details open={!folded} className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
          <h3 id="pour-aller-plus-loin" className="t-section">
            {t.optionalTitle}
          </h3>
          <span className="flex items-center gap-2 t-caption font-normal text-soft">
            {t.optionalCount(done, steps.length)}
            <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <ul className="divide-y divide-card-line pb-2">
          {steps.map((step) => {
            const skipped = local[step.key] ?? step.skipped;
            const title = m.firstSteps.optional[step.key];
            return (
              <li key={step.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="flex min-w-48 flex-1 flex-col">
                  <span className={cn("flex items-center gap-2 font-semibold", (step.done || skipped) && "text-soft")}>
                    {step.done ? <Check aria-hidden className="size-4 shrink-0" /> : null}
                    {title}
                    {step.done ? <span className="sr-only">{t.done}</span> : null}
                    {skipped ? <Chip>{t.skipped}</Chip> : null}
                  </span>
                  <span className="t-caption font-normal text-soft">{w.onboarding.guide.optional[step.key]}</span>
                </span>
                {!step.done ? (
                  <span className="flex items-center gap-1">
                    {!skipped ? (
                      <Button asChild size="sm" variant="quiet">
                        <Link href={COACH_OPTIONAL_PATH[step.key]} aria-label={t.goTo(title)}>
                          {t.go}
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="quiet"
                      aria-label={skipped ? t.unskipLabel(title) : t.skipLabel(title)}
                      disabled={update.isPending}
                      onClick={() => {
                        setLocal({ ...local, [step.key]: !skipped });
                        update.execute(skipped ? { unskip: step.key } : { skip: step.key });
                      }}
                    >
                      {skipped ? t.unskip : t.skip}
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
};

// La carte « Pour démarrer » : la part courue en tour de piste et en toutes lettres, la prochaine étape marquée,
// chaque étape faisable sur place ou à un lien. Refermable sur le suivi ; toujours entière sur la page des premiers pas.
export const CoachGuide = ({ data, place }: { data: GuideData; place: "suivi" | "page" }) => {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [invite, setInvite] = useState<"link" | "qr" | null>(null);
  const close = useAction(updateOnboardingAction, {
    onSuccess: () => toast.ok(t.closed),
    onError: (error) => {
      setHidden(false);
      onErr(error);
    },
  });
  const reopen = useAction(updateOnboardingAction, {
    onSuccess: () => {
      toast.ok(t.reopened);
      router.refresh();
    },
    onError: onErr,
  });
  if (hidden) return null;
  const next = data.steps.find((step) => !step.done)?.key ?? null;
  const lap = t.lap(data.progress.done, data.progress.total);

  return (
    <section aria-labelledby="demarrer" className="on-card overflow-hidden rounded-card bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
        {/* Le tour de piste sur son bout de piste : les lignes blanches se lisent sur l'encre comme sur la craie. */}
        <span className="tartan-band shrink-0 rounded-button px-2 py-2.5">
          <TrackLap value={data.progress.done / data.progress.total} label={lap} className="block w-14 tablet:w-20" />
        </span>
        <div className="flex min-w-32 flex-1 flex-col">
          <h2 id="demarrer" className="t-h2">
            {m.home.guidedTitle}
          </h2>
          <p className="t-caption font-normal text-soft">{lap}</p>
        </div>
        {place === "suivi" ? (
          <Button
            size="sm"
            variant="quiet"
            aria-label={t.closeLabel}
            disabled={close.isPending}
            onClick={() => {
              setHidden(true);
              close.execute({ dismissed: true });
            }}
          >
            {t.close}
          </Button>
        ) : data.dismissedAt ? (
          <Button
            size="sm"
            variant="secondary"
            className="max-tablet:w-full"
            disabled={reopen.isPending}
            onClick={() => reopen.execute({ dismissed: false })}
          >
            {t.reopen}
          </Button>
        ) : null}
      </div>
      <ol className="mt-2 divide-y divide-card-line">
        {data.steps.map((step, index) => {
          const current = step.key === next;
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className={cn("flex flex-col gap-3 px-4 py-3", current && "bg-card-raised")}
            >
              <div className="flex items-start gap-4">
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
                      {m.firstSteps.steps[step.key]}
                      {step.done ? <span className="sr-only">{t.done}</span> : null}
                      {current ? <Chip tone="brand">{t.next}</Chip> : null}
                    </span>
                    {!step.done ? (
                      <span className="t-caption max-w-prose font-normal text-soft">{t.steps[step.key].detail}</span>
                    ) : null}
                  </div>
                  {!step.done ? (
                    <div>
                      <StepActions step={step.key} data={data} invite={invite} setInvite={setInvite} />
                    </div>
                  ) : null}
                </div>
              </div>
              {data.group &&
              ((step.key === "invite" && invite === "link") || (step.key === "validate" && invite === "qr")) ? (
                <div className="pl-12">
                  <InvitePanel groupId={data.group.id} groupName={data.group.name} qrOpen={invite === "qr"} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <OptionalSteps steps={data.optionalSteps} folded={place === "suivi"} />
      {place === "suivi" ? (
        <div className="flex flex-col border-t border-card-line px-4 py-3">
          <Link href={FIRST_STEPS_PATH} className={cn(linkClass, "inline-flex min-h-11 items-center")}>
            {t.all}
          </Link>
          {/* Tant qu'aucun athlète n'a validé, voir Tartan rempli aide à savoir ce qu'on va proposer au groupe. */}
          {DEMO_SPACE_ENABLED && !data.steps.find((step) => step.key === "validate")?.done ? (
            <Link href={DEMO_SPACE_PATH} className={cn(linkClass, "inline-flex min-h-11 items-center")}>
              {w.demoSpace.intro.cardLink}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
