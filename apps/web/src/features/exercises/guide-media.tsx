"use client";

import type { CatalogVideo, ExerciseGuide } from "@tartan/contracts";
import { guideMediaModes } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { chip, GuideMotion } from "./guide-motion";

const t = m.exerciseGuide.media;
const views = m.exerciseGuide.motion.views;

// La vidéo de la fiche commune, une vue à la fois. Sans adresse de lecture, la fiche le dit.
const CatalogVideoPlayer = ({ guide, videos }: { guide: ExerciseGuide; videos: CatalogVideo[] }) => {
  const [view, setView] = useState(videos[0]!.view);
  const video = videos.find((item) => item.view === view) ?? videos[0]!;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {video.streamUrl ? (
        <video
          key={video.view}
          src={video.streamUrl}
          poster={video.posterUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-card bg-ink"
          aria-label={t.videoOf(guide.illustration.alt, views[video.view])}
        />
      ) : (
        <p className="rounded-card bg-card-raised p-4" role="status">
          {t.videoUnavailable}
        </p>
      )}
      {videos.length > 1 ? (
        <div role="group" aria-label={m.exerciseGuide.motion.view} className="flex gap-1">
          {videos.map((item) => (
            <button
              key={item.view}
              type="button"
              aria-pressed={view === item.view}
              onClick={() => setView(item.view)}
              className={cn(chip(view === item.view), "font-semibold")}
            >
              {views[item.view]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// Une fiche commune qui a sa vidéo : le geste animé d'abord, la vidéo au choix. Sans geste animé, la vidéo seule.
export const GuideMedia = ({ guide, motion }: { guide: ExerciseGuide; motion: boolean }) => {
  const videos = guide.illustration.videos?.filter((video) => video.streamUrl) ?? [];
  const photo = guide.illustration.photo;
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const modes = guideMediaModes(guide, motion, Boolean(photo && failedPhoto !== photo.path));
  const [selected, setMode] = useState(modes[0]);
  const mode = selected && modes.includes(selected) ? selected : modes[0];
  return (
    <div className="flex min-w-0 flex-col gap-3" data-guide-media={mode}>
      {modes.length > 1 && (
        <div role="group" aria-label={t.choice} className="flex flex-wrap gap-1">
          {modes.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn(chip(mode === option), "font-semibold")}
            >
              {t[option]}
            </button>
          ))}
        </div>
      )}
      {mode === "motion" && <GuideMotion guide={guide} />}
      {mode === "photo" && photo && (
        <img
          src={photo.path}
          alt={photo.alt}
          width={488}
          height={488}
          loading="lazy"
          onError={() => setFailedPhoto(photo.path)}
          className="h-auto max-w-full rounded-card"
        />
      )}
      {mode === "video" && <CatalogVideoPlayer guide={guide} videos={videos} />}
      {!mode && <p role="status">{m.exerciseGuide.illustrationUnavailable}</p>}
    </div>
  );
};
