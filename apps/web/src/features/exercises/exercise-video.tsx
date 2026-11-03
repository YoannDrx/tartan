"use client";

import type { ExerciseMediaSnapshot } from "@tartan/contracts";
import { instagramEmbedUrl, instagramUrl, youtubeEmbedUrl } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Play } from "lucide-react";
import { useState } from "react";

const InstagramPlayer = ({ code, title }: { code: string; title: string }) => {
  // Instagram n'est appelé qu'à la demande : rien ne part chez Meta à l'ouverture de la fiche.
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <iframe
        title={title}
        src={instagramEmbedUrl(code)}
        allow="autoplay; encrypted-media; picture-in-picture"
        className="mx-auto h-[min(78dvh,650px)] w-full max-w-[360px] rounded-card bg-white"
      />
    );
  }
  return (
    <div className="mx-auto flex aspect-[4/5] w-full max-w-[280px] flex-col items-center justify-center gap-3 rounded-card bg-card-raised p-5 text-center">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white hover:bg-brand-strong"
      >
        <Play aria-hidden className="size-5" />
        {m.exercises.instagramPlay}
      </button>
      <p className="t-caption font-normal text-soft">{m.exercises.instagramNotice}</p>
    </div>
  );
};

export const ExternalVideo = ({
  media,
  title,
}: {
  media: Extract<ExerciseMediaSnapshot, { kind: "youtube" | "instagram" }>;
  title: string;
}) =>
  media.kind === "instagram" ? (
    media.embeddable === false ? (
      <div className="rounded-card bg-card-raised p-5 text-center">
        <p>{m.exercises.instagramBlocked}</p>
        <a
          href={instagramUrl(media.instagramCode)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-11 items-center font-semibold"
        >
          {m.exercises.watchOn("Instagram")}
        </a>
      </div>
    ) : (
      <InstagramPlayer code={media.instagramCode} title={media.title ?? title} />
    )
  ) : (
    <iframe
      title={media.title ?? title}
      src={youtubeEmbedUrl(media)}
      allow="encrypted-media; picture-in-picture"
      className="aspect-video w-full rounded-card bg-card-raised"
    />
  );
