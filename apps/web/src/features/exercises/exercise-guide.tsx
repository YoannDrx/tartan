import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";

export const MovementGuide = ({ guide }: { guide: ExerciseGuide }) => (
  <section aria-label={m.exerciseGuide.title} className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-soft">
      <span>{m.exerciseGuide.families[guide.family]}</span>
      <span>{m.exerciseGuide.levels[guide.level]}</span>
      <span>{m.exerciseGuide.version(guide.version)}</span>
    </div>
    <p className="border-l-4 border-accent pl-3 font-semibold">
      {guide.technicalReview === "approved" ? m.exerciseGuide.approved : m.exerciseGuide.pending}
    </p>
    <p>{guide.objective}</p>
    {guide.illustration.status === "ready" ? (
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
    )}
    {(
      [
        [m.exerciseGuide.setup, guide.setup],
        [m.exerciseGuide.steps, guide.steps],
        [m.exerciseGuide.mistakes, guide.mistakes],
      ] as const
    ).map(([title, lines]) => (
      <div key={title}>
        <h3 className="t-section">{title}</h3>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </div>
    ))}
    {(
      [
        [m.exerciseGuide.breathing, guide.breathing],
        [m.exerciseGuide.counting, guide.counting.explanation],
        [m.exerciseGuide.load, guide.loadExplanation],
        [m.exerciseGuide.easier, guide.easier],
        [m.exerciseGuide.progression, guide.progression],
      ] as const
    ).map(([title, text]) =>
      text ? (
        <div key={title}>
          <h3 className="t-section">{title}</h3>
          <p className="mt-1">{text}</p>
        </div>
      ) : null,
    )}
  </section>
);

export const MovementGuideDisclosure = ({ guide }: { guide: ExerciseGuide }) => (
  <details className="min-w-0 border-t border-card-line">
    <summary className="min-h-11 cursor-pointer py-3 font-semibold">{m.exerciseGuide.open}</summary>
    <div className="pb-4">
      <MovementGuide guide={guide} />
    </div>
  </details>
);
