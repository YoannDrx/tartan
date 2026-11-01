import type { VideoSummary } from "@tartan/contracts";
import { formatHeight, formatTimecode } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Chip } from "@/components/states";

const statusLabel = (v: VideoSummary) =>
  v.status === "uploading"
    ? m.video.uploading
    : v.status === "processing"
      ? m.video.processing
      : v.status === "error"
        ? m.video.failed
        : null;

export const VideoList = ({
  videos,
  basePath,
  showAthlete,
}: {
  videos: VideoSummary[];
  basePath: string;
  showAthlete: boolean;
}) => (
  <ul className="divide-y divide-border rounded-block border border-border bg-surface">
    {videos.map((v) => (
      <li key={v.id}>
        <Link
          href={`${basePath}/${v.id}`}
          className="flex min-h-11 items-center gap-3 p-3 text-ink no-underline hover:bg-bg"
        >
          <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-thumb bg-surface-sunk">
            {v.thumbnailUrl ? (
              <Image src={v.thumbnailUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
            ) : (
              <Video aria-hidden className="size-5" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">
              {showAthlete
                ? v.athleteName
                : v.recordedAt
                  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
                      new Date(v.recordedAt),
                    )
                  : "Saut"}
            </span>
            <span className="t-caption font-normal text-muted">
              {[
                v.barHeightCm ? `${formatHeight(v.barHeightCm)} m, ${v.result === "pass" ? "–" : v.result}` : null,
                v.durationMs ? formatTimecode(v.durationMs) : null,
                v.fps ? `${v.fps} i/s` : null,
                v.annotationCount ? `${v.annotationCount} remarque${v.annotationCount > 1 ? "s" : ""}` : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </span>
          {statusLabel(v) ? (
            <Chip tone="warning">{statusLabel(v)}</Chip>
          ) : v.sharedWithAthlete && showAthlete ? (
            <Chip>{m.video.shared}</Chip>
          ) : null}
        </Link>
      </li>
    ))}
  </ul>
);
