"use client";

import type { ExerciseGuide } from "@tartan/contracts";
import { SURFACES } from "@tartan/design-tokens/athletes";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { gestureClip } from "@tartan/mascot/v2/registry";
import { guidePositionAt } from "@tartan/mascot/v2/gesture";
import { createMotionPlayer, svgSink, type MotionPlayer, type PlayerOptions } from "@tartan/mascot/v2/player";
import type { GestureView } from "@tartan/mascot/v2/project";
import { gestureEntry } from "@tartan/mascot/v2/registry";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gesturePaint, GestureStage, GestureStill } from "@/components/exercise-scene";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const t = m.exerciseGuide.motion;

const label = w.exercises.guide.position;

// La ligne de chaque position : la version concise quand le guide en a une, sinon le texte enregistré.
const linesOf = (guide: ExerciseGuide) =>
  guide.concise ? [guide.concise.setup, ...guide.concise.steps] : guide.illustration.positions;

// Une pastille dit sa position : « Mise en place », puis le numéro de l'étape qu'elle montre.
const chipText = (index: number) => (index === 0 ? label(0) : String(index));

const captionOf = (guide: ExerciseGuide) =>
  guide.illustration.motion === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending;

// Une pastille ou un choix de vue : une cible de 44 px, pleine quand elle est choisie.
export const chip = (chosen: boolean) =>
  cn(
    "grid min-h-11 min-w-11 place-items-center rounded-button border border-card-line px-3 text-sm",
    chosen && "border-transparent bg-accent text-on-accent",
  );

// Le geste du guide : il tourne en boucle, une pastille par ligne du guide montre où il en est, et la ligne
// en cours s'affiche dessous. Arrêté, on choisit la position à regarder. En mouvement réduit : la frise des positions.
// Le geste se retrouve ici, côté client, d'après la clé du catalogue : une page serveur ne transmet que le guide.
// Deux vues, et une lecture qui ne passe pas par React. `bothViews` montre les deux vues côte à côte, pour
// l'atelier de relecture.
export const GuideMotion = ({
  guide,
  autoPlay = true,
  bothViews = false,
}: {
  guide: ExerciseGuide;
  autoPlay?: boolean;
  bothViews?: boolean;
}) => (gestureClip(guide.catalogKey) ? <GestureFrame guide={guide} autoPlay={autoPlay} bothViews={bothViews} /> : null);

// Le geste n'est préparé qu'à l'approche de l'écran (un geste relevé se construit à ce moment), et sa lecture
// s'arrête dès qu'il en sort.
const GestureFrame = ({
  guide,
  autoPlay,
  bothViews,
}: {
  guide: ExerciseGuide;
  autoPlay: boolean;
  bothViews: boolean;
}) => {
  const frame = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const watcher = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry!.isIntersecting);
        if (entry!.isIntersecting) setNear(true);
      },
      { rootMargin: "200px" },
    );
    watcher.observe(frame.current!);
    return () => watcher.disconnect();
  }, []);
  return (
    <figure ref={frame} className="flex min-w-0 flex-col gap-2">
      {near ? (
        <Gesture guide={guide} autoPlay={autoPlay} bothViews={bothViews} visible={visible} />
      ) : (
        <div aria-hidden className="aspect-[3/2] w-full rounded-button" style={{ backgroundColor: SURFACES.ink }} />
      )}
    </figure>
  );
};

const Gesture = ({
  guide,
  autoPlay,
  bothViews,
  visible,
}: {
  guide: ExerciseGuide;
  autoPlay: boolean;
  bothViews: boolean;
  visible: boolean;
}) => {
  const reduced = useReducedMotion();
  const entry = useMemo(() => gestureEntry(guide.catalogKey)!, [guide.catalogKey]);
  const { clip } = entry;
  const [view, setView] = useState<GestureView>(entry.native);
  const [playing, setPlaying] = useState(autoPlay);
  const [current, setCurrent] = useState(0);
  // L'instant de la boucle et les lecteurs vivent hors de React : une image ne provoque aucun rendu.
  const time = useRef(clip.positions[0]!.still);
  const position = useRef(0);
  const main = useRef<MotionPlayer | null>(null);
  const groups = useRef(new Map<GestureView, SVGGElement>());
  const running = playing && !reduced;
  const lines = linesOf(guide);
  // En mouvement réduit, une seule vue à la fois : la frise prend toute la largeur.
  const shown = bothViews && !reduced ? entry.views.slice(0, 2) : [view];
  const layout = shown.join(" ");

  useEffect(() => {
    if (reduced) return;
    const paint = gesturePaint(clip);
    const [first, ...rest] = layout.split(" ") as GestureView[];
    const others = rest.map((other) =>
      createMotionPlayer(clip, other, svgSink(document, groups.current.get(other)!, paint), { start: time.current }),
    );
    const options: PlayerOptions = {
      start: time.current,
      onFrame: (now) => {
        time.current = now;
        for (const other of others) other.seek(now);
        // La pastille et la ligne du guide ne changent qu'avec la position : quelques rendus par boucle.
        const at = guidePositionAt(clip, now);
        if (at !== position.current) setCurrent((position.current = at));
      },
    };
    const player = createMotionPlayer(clip, first!, svgSink(document, groups.current.get(first!)!, paint), options);
    main.current = player;
    const drawn = [...groups.current.values()];
    return () => {
      player.dispose();
      main.current = null;
      for (const group of drawn) group.replaceChildren();
    };
  }, [clip, reduced, layout]);

  useEffect(() => {
    if (running && visible) main.current?.play();
    else main.current?.pause();
  }, [running, visible, clip, layout]);

  const viewChoice =
    entry.views.length > 1 && (!bothViews || reduced) ? (
      <div role="group" aria-label={t.view} className="flex gap-1">
        {entry.views.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={cn(chip(view === option), "font-semibold")}
          >
            {t.views[option]}
          </button>
        ))}
      </div>
    ) : null;

  if (reduced)
    return (
      <>
        <ol aria-label={t.positions} className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
          {clip.positions.map((step) => (
            <li key={step.guide} className="flex min-w-0 flex-col gap-1">
              <GestureStage
                gesture={clip}
                view={view}
                role="img"
                aria-label={lines[step.guide] ?? guide.illustration.alt}
                className="w-full rounded-button"
              >
                <GestureStill gesture={clip} t={step.still} view={view} />
              </GestureStage>
              <span className="t-caption text-soft">{label(step.guide)}</span>
            </li>
          ))}
        </ol>
        {viewChoice}
        <figcaption className="t-caption text-soft">
          {t.reduced} {captionOf(guide)}
        </figcaption>
      </>
    );

  const step = clip.positions[current]!;
  return (
    <>
      <div className={cn("grid gap-2", shown.length > 1 && "grid-cols-2")}>
        {shown.map((option) => (
          <GestureStage
            key={option}
            gesture={clip}
            view={option}
            role="img"
            aria-label={shown.length > 1 ? `${guide.illustration.alt} (${t.views[option]})` : guide.illustration.alt}
            className="w-full rounded-button"
          >
            <g
              ref={(group) => {
                if (group) groups.current.set(option, group);
                else groups.current.delete(option);
              }}
            />
          </GestureStage>
        ))}
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label={running ? t.pause : t.play}
          onClick={() => setPlaying(!running)}
        >
          {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </Button>
        <div role="group" aria-label={t.positions} className="flex gap-1">
          {clip.positions.map((option, index) => (
            <button
              key={option.guide}
              type="button"
              aria-label={option.guide === 0 ? undefined : label(option.guide)}
              aria-pressed={!running && current === index}
              onClick={() => {
                setPlaying(false);
                main.current?.seek(option.still);
              }}
              className={cn(chip(current === index), option.guide === 0 ? "font-semibold" : "t-num px-0")}
            >
              {chipText(option.guide)}
            </button>
          ))}
        </div>
        {viewChoice}
      </div>
      {/* Lue seulement une fois le geste arrêté : en lecture, la ligne change toutes les secondes. */}
      <p aria-live={running ? "off" : "polite"} className="min-h-12">
        <span className="font-semibold">{label(step.guide)} : </span>
        {lines[step.guide]}
      </p>
      <figcaption className="t-caption text-soft">{captionOf(guide)}</figcaption>
    </>
  );
};
