"use client";

import type { ExerciseFamily } from "@tartan/contracts";
import { SURFACES } from "@tartan/design-tokens/athletes";
import { Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ActivityPicto, FamilyPicto } from "@/components/pictos";
import { familyColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";

const Still = dynamic(() => import("./gesture-still-thumb"), { ssr: false, loading: () => null });

/**
 * La vignette d'une fiche : une image fixe de son geste, sur l'encre. Elle se dessine à l'approche de l'écran,
 * jamais dans le HTML de la page. Une fiche sans geste montre le pictogramme de sa catégorie.
 * Avec sa famille, la vignette en prend la teinte : un cadre autour du geste, qui reste sur l'encre, ou tout le fond
 * derrière le pictogramme de la famille.
 */
export const GestureThumb = ({
  motionKey,
  category,
  className,
  video,
  family,
}: {
  motionKey: string | null | undefined;
  category: string;
  className?: string;
  video?: boolean;
  family?: ExerciseFamily;
}) => {
  const frame = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (video || !motionKey || near) return;
    const watcher = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), {
      rootMargin: "300px",
    });
    watcher.observe(frame.current!);
    return () => watcher.disconnect();
  }, [motionKey, near, video]);
  const tint = family ? familyColors(family) : null;
  const gesture = !video && motionKey;
  return (
    <span
      ref={frame}
      aria-hidden
      data-family={family}
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-thumb",
        tint ? gesture && "p-[3px]" : "border border-card-line",
        className,
      )}
      style={
        tint
          ? { backgroundColor: tint.background, color: tint.text }
          : { backgroundColor: SURFACES.ink, color: SURFACES.chalk }
      }
    >
      {video ? (
        <Play className="size-6" />
      ) : motionKey ? (
        <span
          className={cn("block size-full overflow-hidden", tint && "rounded-[calc(var(--radius-thumb)-3px)]")}
          style={{ backgroundColor: SURFACES.ink }}
        >
          {near ? <Still motionKey={motionKey} /> : null}
        </span>
      ) : family ? (
        <FamilyPicto family={family} className="size-6" />
      ) : (
        <ActivityPicto kind={category} className="size-6" />
      )}
    </span>
  );
};
