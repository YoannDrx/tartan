"use client";

import { m } from "@tartan/i18n";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { TrackTile } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/features/onboarding/onboarding-context";
import { markInstallOpportunity } from "@/features/shell/install-opportunity";
import { cn } from "@/lib/cn";
import { RUBRIC_ATHLETE } from "@/lib/rubric-athlete";

const t = m.athleteWelcome;

const PANELS = [
  { key: "session", rubric: "aujourdhui" },
  { key: "progress", rubric: "progres" },
  { key: "videos", rubric: "videos" },
] as const;

// Trois choses à savoir, chacune avec l'athlète de sa rubrique. Une liste dans une carte, pas trois cartes.
const Panels = ({ coach }: { coach: string }) => (
  <ul
    aria-label={t.panelsLabel}
    className="flex flex-col divide-y divide-card-line tablet:flex-row tablet:divide-x tablet:divide-y-0"
  >
    {PANELS.map((panel) => {
      const copy = t.panels[panel.key];
      return (
        <li
          key={panel.key}
          className="flex flex-1 items-start gap-3 py-3 tablet:px-4 tablet:py-1 tablet:first:pl-0 tablet:last:pr-0"
        >
          <TrackTile athlete={RUBRIC_ATHLETE[panel.rubric]} pose="run" className="size-12 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{copy.title}</span>
            <span className="t-caption font-normal text-soft">
              {typeof copy.body === "function" ? copy.body(coach) : copy.body}
            </span>
          </span>
        </li>
      );
    })}
  </ul>
);

// L'arrivée d'un athlète dans le groupe : qui l'a invité, puis trois choses à savoir, refermées d'un geste.
// Elle ne retarde jamais la séance : un jour de séance, elle se réduit à une ligne « Découvrir Tartan », sous la
// carte de séance, qui s'ouvre à la demande. L'état est gardé sur le compte (`welcomeSeenAt`) : refermée, elle ne
// revient sur aucun appareil. L'installation et les notifications se proposent dès maintenant, même un jour de séance.
export const AthleteWelcome = ({ mode, group, coach }: { mode: "panels" | "line"; group: string; coach: string }) => {
  const onboarding = useOnboarding();
  const [closed, setClosed] = useState(false);
  const [expanded, setExpanded] = useState(mode === "panels");
  const titleId = useId();
  const panelsId = useId();

  useEffect(() => {
    markInstallOpportunity();
  }, []);

  if (closed) return null;
  const close = () => {
    setClosed(true);
    onboarding?.save({ welcomeSeen: true });
  };

  if (mode === "line" && !expanded) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls={panelsId}
        onClick={() => setExpanded(true)}
        className="on-card flex min-h-11 w-full items-center justify-between gap-3 rounded-card bg-card px-4 py-2 text-left font-semibold hover:bg-card-raised"
      >
        {t.discover}
        <ChevronDown aria-hidden className="size-5 shrink-0" />
      </button>
    );
  }

  return (
    <section
      id={panelsId}
      aria-labelledby={titleId}
      className={cn("on-card flex flex-col gap-3 rounded-card bg-card p-4 tablet:p-5")}
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="t-h2 text-balance">
          {t.title(group)}
        </h2>
        <p className="max-w-prose">{t.body(coach)}</p>
      </div>
      <Panels coach={coach} />
      <div>
        <Button type="button" variant="secondary" size="md" onClick={close}>
          {t.dismiss}
        </Button>
      </div>
    </section>
  );
};
