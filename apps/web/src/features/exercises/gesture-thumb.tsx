"use client";

import { SURFACES } from "@tartan/design-tokens/athletes";
import { Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ActivityPicto } from "@/components/pictos";
import { cn } from "@/lib/cn";

const Still = dynamic(() => import("./gesture-still-thumb"), { ssr: false, loading: () => null });

/**
 * La vignette d'une fiche : une image fixe de son geste, sur l'encre. Elle se dessine à l'approche de l'écran,
 * jamais dans le HTML de la page. Une fiche sans geste montre le pictogramme de sa catégorie.
 */
export const GestureThumb = ({
  motionKey,
  category,
  className,
  video,
}: {
  motionKey: string | null | undefined;
  category: string;
  className?: string;
  video?: boolean;
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
  return (
    <span
      ref={frame}
      aria-hidden
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-thumb border border-card-line",
        className,
      )}
      style={{ backgroundColor: SURFACES.ink, color: SURFACES.chalk }}
    >
      {video ? (
        <Play className="size-6" />
      ) : motionKey ? (
        near ? (
          <Still motionKey={motionKey} />
        ) : null
      ) : (
        <ActivityPicto kind={category} className="size-6" />
      )}
    </span>
  );
};
