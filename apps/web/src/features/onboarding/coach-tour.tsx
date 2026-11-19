"use client";

import { w } from "@tartan/i18n/web";
import { exerciseClip } from "@tartan/mascot/exercises";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ExerciseScene } from "@/components/exercise-scene";
import { LaneNumber } from "@/components/lane-number";
import { TrackTile } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { RUBRIC_ATHLETE } from "@/lib/rubric-athlete";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { FEATURES, type Feature } from "./tour-features";

const t = w.onboarding.tour;

// Le vrai guide animé d'une fiche du catalogue. En mouvement réduit : la position la plus parlante, immobile.
const GuidePreview = ({ catalogKey, label }: { catalogKey: string; label: string }) => {
  const clip = exerciseClip(catalogKey);
  const reduced = useReducedMotion();
  const [time, setTime] = useState(clip?.stills[1] ?? 0);
  useEffect(() => {
    if (!clip || reduced) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - last;
      last = now;
      setTime((current) => (current + elapsed / clip.duration) % 1);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [clip, reduced]);
  if (!clip) return null;
  return <ExerciseScene gesture={clip} t={time} role="img" aria-label={label} className="h-full w-auto" />;
};

const Visual = ({ feature }: { feature: Feature }) => {
  const copy = t.features[feature.key];
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="flex h-52 items-center justify-center overflow-hidden rounded-card bg-ink p-2 tablet:h-72">
        {feature.visual.kind === "capture" ? (
          <Image
            src={feature.visual.image}
            alt={copy.alt}
            sizes="(min-width: 768px) 672px, 100vw"
            className={cn("h-full w-auto max-w-full rounded-button object-contain")}
          />
        ) : (
          <GuidePreview catalogKey={feature.visual.catalogKey} label={copy.alt} />
        )}
      </div>
      <figcaption className="t-caption font-normal text-soft">
        {feature.visual.kind === "capture" ? t.capture : t.preview}
      </figcaption>
    </figure>
  );
};

// Le tour de piste : une étape par grande fonction, ce qu'elle apporte en une phrase, et le produit tel qu'il est.
// Refermable à tout moment (Échap, la croix, « Commencer »), rouvrable depuis l'aide et la page des premiers pas.
// Le dialogue garde le focus ; les flèches du clavier passent d'une étape à l'autre.
export const CoachTour = ({
  open,
  onClose,
  plannerAvailable,
}: {
  open: boolean;
  onClose: () => void;
  plannerAvailable: boolean;
}) => {
  const [index, setIndex] = useState(0);
  const feature = FEATURES[index]!;
  const copy = t.features[feature.key];
  const last = index === FEATURES.length - 1;
  const canGo = feature.gated !== "planner" || plannerAvailable;

  const go = (target: number) => setIndex(Math.max(0, Math.min(FEATURES.length - 1, target)));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else return;
    event.preventDefault();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        onClose();
        setIndex(0);
      }}
      title={t.title}
      description={t.description}
      wide
    >
      <div onKeyDown={onKeyDown} className="flex flex-col gap-4">
        <div key={feature.key} className="tour-step flex flex-col gap-4">
          <Visual feature={feature} />
          <div className="flex items-start gap-3">
            <LaneNumber n={index + 1} className="text-[48px]" />
            <TrackTile athlete={RUBRIC_ATHLETE[feature.rubric]} pose="run" className="size-14 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="t-h2 text-balance">{copy.title}</h3>
              <p className="max-w-prose">{copy.body}</p>
            </div>
          </div>
        </div>

        <nav aria-label={t.stepsLabel}>
          <ol className="flex gap-1">
            {FEATURES.map((entry, position) => (
              <li key={entry.key} className="flex-1">
                <button
                  type="button"
                  aria-label={t.goToStep(position + 1, t.features[entry.key].title)}
                  aria-current={position === index ? "step" : undefined}
                  onClick={() => go(position)}
                  className="flex h-11 w-full items-center rounded-button px-0.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block h-1.5 w-full rounded-full transition-colors",
                      position === index ? "bg-accent" : position < index ? "bg-fg" : "bg-card-line",
                    )}
                  />
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p role="status" className="t-caption font-normal text-soft">
          {t.progress(index + 1, FEATURES.length)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>
            {t.previous}
          </Button>
          {canGo ? (
            <Button asChild variant="quiet" size="sm">
              <Link href={feature.path} onClick={onClose} aria-label={w.onboarding.guide.goTo(copy.title)}>
                {t.go}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" className="ml-auto" onClick={last ? onClose : () => go(index + 1)}>
            {last ? t.finish : t.next}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
