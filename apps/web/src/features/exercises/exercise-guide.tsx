import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { exerciseClip } from "@tartan/mascot/exercises";
import { GuideMedia } from "./guide-media";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { GuideMotion } from "./guide-motion";

const t = w.exercises.guide;

export type GuideVariants = {
  easier: { id: string; name: string } | null;
  harder: { id: string; name: string } | null;
};

const Illustration = ({ guide }: { guide: ExerciseGuide }) => {
  const motion = Boolean(exerciseClip(guide.catalogKey));
  // La fiche commune a sa vidéo : on choisit entre le geste animé et la vidéo.
  if (guide.illustration.videos?.length) return <GuideMedia guide={guide} motion={motion} />;
  if (motion) return <GuideMotion guide={guide} />;
  return guide.illustration.status === "ready" ? (
    <figure className="min-w-0">
      {/* Versioned local SVGs remain available with the downloaded session. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={guide.illustration.path}
        alt={guide.illustration.alt}
        width={960}
        height={480}
        className="h-auto w-full"
      />
      <figcaption className="mt-2 text-sm text-soft">
        {guide.technicalReview === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending}
      </figcaption>
    </figure>
  ) : (
    <p className="text-sm text-soft">{m.exerciseGuide.illustrationNotReady}</p>
  );
};

// Ce que la fiche affiche : la version concise du catalogue, sinon le texte enregistré (celui qu'un coach a écrit).
const shownText = (guide: ExerciseGuide) =>
  guide.concise ?? {
    objective: guide.objective,
    setup: guide.setup.join(" "),
    steps: guide.steps,
    mistakes: guide.mistakes,
    easier: guide.easier ? { text: guide.easier, catalogKey: null } : null,
    harder: guide.progression ? { text: guide.progression, catalogKey: null } : null,
  };

const Lines = ({ title, lines, ordered }: { title: string; lines: readonly string[]; ordered?: boolean }) => {
  const List = ordered ? "ol" : "ul";
  return (
    <div className="min-w-0">
      <h3 className="t-section">{title}</h3>
      <List className={ordered ? "mt-2 flex flex-col gap-2" : "mt-2 flex list-disc flex-col gap-1.5 pl-5"}>
        {lines.map((line, index) => (
          <li key={index} className={ordered ? "flex gap-3" : undefined}>
            {ordered ? (
              // Le numéro de l'étape est celui de sa pastille, sous le geste.
              <span aria-hidden className="t-num grid size-7 shrink-0 place-items-center rounded-full bg-card-raised">
                {index + 1}
              </span>
            ) : null}
            <span className="min-w-0 pt-0.5">{line}</span>
          </li>
        ))}
      </List>
    </div>
  );
};

/**
 * La fiche d'un geste, la même partout (fiche, aperçu du constructeur, guide de l'athlète en séance) : le geste
 * d'abord, une phrase d'objectif, la mise en place en une ligne, les étapes numérotées comme les pastilles du
 * geste, les erreurs à éviter, puis les variantes. Le texte complet reste sous « Détail ».
 */
export const MovementGuide = ({ guide, variants }: { guide: ExerciseGuide; variants?: GuideVariants }) => {
  const text = shownText(guide);
  const concise = guide.concise;
  const variantRows = (
    [
      [t.easier, text.easier, variants?.easier],
      [t.harder, text.harder, variants?.harder],
    ] as const
  ).filter(([, variant]) => variant);
  return (
    // Assez large (la fiche sur ordinateur), le geste tient à gauche et le texte se lit à côté ; plus étroit (téléphone,
    // aperçu du constructeur, séance de l'athlète), le geste passe au-dessus.
    <section aria-label={m.exerciseGuide.title} className="@container min-w-0">
      <div className="grid gap-5 @3xl:grid-cols-2 @3xl:items-start @3xl:gap-8">
        <div className="min-w-0 @3xl:sticky @3xl:top-24">
          <Illustration guide={guide} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <p className="text-[17px] font-semibold leading-snug">{text.objective}</p>
          <div className="min-w-0">
            <h3 className="t-section">{t.setup}</h3>
            <p className="mt-1">{text.setup}</p>
          </div>
          <Lines title={t.steps} lines={text.steps} ordered />
          <Lines title={t.mistakes} lines={text.mistakes} />
          {variantRows.length > 0 ? (
            <dl className="flex flex-col divide-y divide-card-line border-y border-card-line">
              {variantRows.map(([label, variant, link]) => (
                <div key={label} className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                  <dt className="w-32 shrink-0 font-semibold">{label}</dt>
                  <dd className="min-w-0 flex-1">
                    {link ? (
                      <Link
                        href={`/exercices/${link.id}`}
                        className="inline-flex min-h-11 items-center gap-1 font-semibold underline"
                      >
                        {link.name}
                        <ChevronRight aria-hidden className="size-4" />
                      </Link>
                    ) : (
                      variant!.text
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <details className="min-w-0 border-b border-card-line">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t.detail}</summary>
            <div className="flex flex-col gap-4 pb-4">
              {concise && concise.review === "review" ? (
                <>
                  <p className="t-caption text-soft">{t.detailHint}</p>
                  <p>{guide.objective}</p>
                  <Lines title={t.setup} lines={guide.setup} />
                  <Lines title={t.steps} lines={guide.steps} ordered />
                  <Lines title={t.mistakes} lines={guide.mistakes} />
                  {(
                    [
                      [t.easier, guide.easier],
                      [t.harder, guide.progression],
                    ] as const
                  ).map(([title, line]) =>
                    line ? (
                      <div key={title}>
                        <h3 className="t-section">{title}</h3>
                        <p className="mt-1">{line}</p>
                      </div>
                    ) : null,
                  )}
                </>
              ) : null}
              {(
                [
                  [t.breathing, guide.breathing],
                  [t.counting, guide.counting.explanation],
                  [t.load, guide.loadExplanation],
                ] as const
              ).map(([title, line]) =>
                line ? (
                  <div key={title}>
                    <h3 className="t-section">{title}</h3>
                    <p className="mt-1">{line}</p>
                  </div>
                ) : null,
              )}
            </div>
          </details>
          <p className="t-caption text-soft">
            {guide.author === "coach"
              ? t.coach
              : guide.technicalReview === "approved"
                ? m.exerciseGuide.approved
                : m.exerciseGuide.pending}{" "}
            {m.exerciseGuide.families[guide.family]}, {m.exerciseGuide.levels[guide.level].toLowerCase()}.
          </p>
        </div>
      </div>
    </section>
  );
};

export const MovementGuideDisclosure = ({ guide }: { guide: ExerciseGuide }) => (
  <details className="min-w-0 border-t border-card-line">
    <summary className="min-h-11 cursor-pointer py-3 font-semibold">{m.exerciseGuide.open}</summary>
    <div className="pb-4">
      <MovementGuide guide={guide} />
    </div>
  </details>
);
