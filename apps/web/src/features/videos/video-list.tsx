import type { VideoSummary } from "@tartan/contracts";
import { formatHeight, formatTimecode } from "@tartan/domain";
import { capitalize, m } from "@tartan/i18n";
import { Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { JumpMark } from "@/components/bar-sheet";
import { Sheet } from "@/components/sheet";
import { Chip } from "@/components/states";

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

// Journal de sauts : par jour, la vidéo puis la barre et le résultat, comme sur une feuille de concours.
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
    const key = v.recordedAt ? capitalize(dayLabel.format(new Date(v.recordedAt))) : m.video.noDate;
    days.set(key, [...(days.get(key) ?? []), v]);
  }
  return (
    <Sheet>
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
                    className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2 text-inherit no-underline hover:bg-raise tablet:grid-cols-[112px_minmax(0,1fr)_minmax(0,auto)] desktop:grid-cols-[112px_minmax(0,1fr)_200px_96px_128px_176px]"
                  >
                    <span className="relative row-span-3 flex aspect-video w-full items-center justify-center self-start overflow-hidden rounded-thumb bg-card-raised text-white tablet:row-span-2 desktop:row-span-1 desktop:self-center">
                      {v.thumbnailUrl ? (
                        <Image src={v.thumbnailUrl} alt="" fill sizes="112px" className="object-cover" unoptimized />
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
                      {showAthlete ? v.athleteName : `${m.video.attempt} ${v.attemptNo ?? ""}`.trim()}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 max-tablet:col-start-2 tablet:justify-end desktop:justify-start">
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
                        <span className="t-caption font-normal text-soft desktop:hidden">{m.video.noBar}</span>
                      )}
                    </span>
                    <span className="t-num text-[17px] text-soft max-desktop:hidden">
                      {v.fps ? `${v.fps} i/s` : ""}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 max-desktop:[grid-column:2/-1] desktop:contents">
                      <span className="t-caption font-normal text-soft">
                        {v.annotationCount ? `${v.annotationCount} remarque${v.annotationCount > 1 ? "s" : ""}` : ""}
                      </span>
                      <span className="flex items-center desktop:justify-end">
                        {status ? (
                          <Chip tone="warning">{status}</Chip>
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
