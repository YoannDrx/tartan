import type { VideoSummary } from "@tartan/contracts";
import { formatHeight, formatTimecode } from "@tartan/domain";
import { capitalize, m, withFirstOfMonth } from "@tartan/i18n";
import { Play, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { JumpMark } from "@/components/bar-sheet";
import { Sheet } from "@/components/sheet";
import { Chip } from "@/components/states";
import { RefreshWhilePending } from "./refresh-while-pending";

const statusLabel = (v: VideoSummary) =>
  v.status === "uploading"
    ? m.video.uploading
    : v.status === "processing"
      ? m.video.processing
      : v.status === "error"
        ? m.video.failed
        : null;

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

// Journal vidéo par jour ; les métadonnées de saut ne concernent que les essais renseignés.
export const VideoList = ({
  videos,
  basePath,
  showAthlete,
}: {
  videos: VideoSummary[];
  basePath: string;
  showAthlete: boolean;
}) => {
  const days = new Map<string, VideoSummary[]>();
  // Les envois en cours d'abord, puis du plus récent au plus ancien.
  const ordered = [...videos].sort((a, b) => (b.recordedAt ?? "9999").localeCompare(a.recordedAt ?? "9999"));
  for (const v of ordered) {
    const key = v.recordedAt ? capitalize(withFirstOfMonth(dayLabel.format(new Date(v.recordedAt)))) : m.video.noDate;
    days.set(key, [...(days.get(key) ?? []), v]);
  }
  return (
    <Sheet>
      {videos.some((v) => v.status === "uploading" || v.status === "processing") ? <RefreshWhilePending /> : null}
      {[...days.entries()].map(([day, list]) => (
        <section key={day} aria-label={day}>
          <h2 className="t-col border-b border-card-line bg-card-raised px-4 py-1.5 [&:not(:first-child)]:border-t">
            {day}
          </h2>
          <ul className="divide-y divide-card-line">
            {list.map((v) => {
              const status = statusLabel(v);
              return (
                <li key={v.id}>
                  <Link
                    href={`${basePath}/${v.id}`}
                    className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2 text-inherit no-underline hover:bg-raise tablet:grid-cols-[112px_minmax(0,1fr)_minmax(0,auto)]"
                  >
                    <span className="relative row-span-3 flex aspect-video w-full items-center justify-center self-start overflow-hidden rounded-thumb bg-ink-2 text-on-ink tablet:row-span-2">
                      {v.thumbnailUrl ? (
                        <Image src={v.thumbnailUrl} alt="" fill sizes="112px" className="object-cover" unoptimized />
                      ) : v.status === "error" ? (
                        <X aria-hidden className="size-4 text-st-missed tablet:size-5" />
                      ) : (
                        <Play aria-hidden className="size-4 tablet:size-5" />
                      )}
                      {v.durationMs ? (
                        <span className="t-num absolute bottom-1 right-1 rounded bg-ink/80 px-1 text-[12px] leading-4">
                          {formatTimecode(v.durationMs)}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate font-semibold">
                      {showAthlete
                        ? v.athleteName
                        : v.attemptNo
                          ? `${m.video.attempt} ${v.attemptNo}`
                          : m.video.analysis}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 max-tablet:col-start-2 tablet:justify-end">
                      {v.barHeightCm ? (
                        <>
                          <span className="t-num text-[22px] leading-7">{formatHeight(v.barHeightCm)} m</span>
                          {v.result ? <JumpMark result={v.result} /> : null}
                          {v.attemptNo && showAthlete ? (
                            <span className="t-caption font-normal text-soft">
                              {m.video.attempt} {v.attemptNo}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="t-caption font-normal text-soft">{m.video.analysis}</span>
                      )}
                    </span>
                    <span className="col-start-2 col-end-[-1] flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {v.fps ? (
                        <span className="t-caption font-normal text-soft">
                          {m.videoCollaboration.framesPerSecond(v.fps)}
                        </span>
                      ) : null}
                      <span className="t-caption font-normal text-soft">
                        {v.annotationCount ? m.videoCollaboration.remarkCount(v.annotationCount) : ""}
                      </span>
                      <span className="flex items-center">
                        {status ? (
                          <Chip tone={v.status === "error" ? "missed" : "warning"}>{status}</Chip>
                        ) : v.sharedWithGroup ? (
                          <Chip>{m.videoCollaboration.groupShared}</Chip>
                        ) : showAthlete && !v.reviewedAt ? (
                          <Chip tone="warning">{m.videoCollaboration.awaitingReview}</Chip>
                        ) : v.sharedWithAthlete && showAthlete ? (
                          <Chip>{m.video.shared}</Chip>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Sheet>
  );
};
