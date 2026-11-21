"use client";

import type { ExerciseFamily } from "@tartan/contracts";
import { normalizeExerciseTerm } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Search } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { catalogVideoUploadAction, removeCatalogVideoAction } from "./catalog-video.action";

const t = w.admin.catalogVideos;
const VIEWS = ["side", "front"] as const;
type View = (typeof VIEWS)[number];
type Status = keyof typeof t.status;

export type CatalogEntry = { key: string; name: string; family: ExerciseFamily };
export type CatalogMediaState = { catalogKey: string; view: string; status: string };

const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

// Une vue d'une fiche : son état, l'envoi d'un fichier, et le retrait de la vidéo.
const ViewSlot = ({
  entry,
  view,
  status,
  enabled,
}: {
  entry: CatalogEntry;
  view: View;
  status: Status;
  enabled: boolean;
}) => {
  const router = useRouter();
  const label = m.exerciseGuide.motion.views[view];
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useAction(catalogVideoUploadAction, { onError });
  const remove = useAction(removeCatalogVideoAction, {
    onSuccess: () => {
      toast.ok(t.removed);
      router.refresh();
    },
    onError,
  });
  const send = async (file: File) => {
    const res = await upload.executeAsync({ catalogKey: entry.key, view });
    if (!res?.data) return;
    const { createUpload } = await import("@mux/upchunk");
    const sending = createUpload({ endpoint: res.data.uploadUrl, file, chunkSize: 5120 });
    setProgress(0);
    sending.on("progress", (event) => setProgress(Math.round(event.detail)));
    sending.on("error", () => {
      setProgress(null);
      toast.error(t.failed);
      router.refresh();
    });
    sending.on("success", () => {
      setProgress(null);
      toast.ok(t.sent);
      router.refresh();
    });
  };
  const busy = upload.isPending || progress !== null;
  return (
    <div className="flex min-w-0 flex-col gap-2" data-catalog-view={view} data-status={status}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className={cn(status === "error" ? "text-danger" : "text-soft")}>{t.status[status]}</span>
      </p>
      {progress !== null ? (
        <progress
          max={100}
          value={progress}
          aria-label={t.progress(entry.name, label)}
          className="w-full accent-brand"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-card-line px-4 text-[15px] font-semibold hover:bg-raise focus-within:outline-2 focus-within:outline-offset-2",
            (!enabled || busy) && "pointer-events-none opacity-50",
          )}
        >
          {status === "none" ? t.choose(label) : t.replace(label)}
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            disabled={!enabled || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void send(file);
            }}
          />
        </label>
        {status === "none" ? null : (
          <ConfirmDialog
            title={t.removeTitle(entry.name, label)}
            description={t.removeBody}
            confirmLabel={t.remove(label)}
            onConfirm={() => remove.execute({ catalogKey: entry.key, view })}
            trigger={
              <Button size="sm" variant="quiet" disabled={remove.isPending}>
                {t.remove(label)}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

// Les fiches communes du catalogue, cherchées par leur nom, avec l'état de leurs deux vidéos.
export const CatalogVideoBoard = ({
  entries,
  media,
  enabled,
}: {
  entries: CatalogEntry[];
  media: CatalogMediaState[];
  enabled: boolean;
}) => {
  const [query, setQuery] = useState("");
  const states = useMemo(
    () => new Map(media.map((row) => [`${row.catalogKey}:${row.view}`, row.status as Status])),
    [media],
  );
  const shown = useMemo(() => {
    const term = normalizeExerciseTerm(query);
    return term ? entries.filter((entry) => normalizeExerciseTerm(entry.name).includes(term)) : entries;
  }, [entries, query]);
  const ready = media.filter((row) => row.status === "ready").length;
  return (
    <div className="flex flex-col gap-4">
      {enabled ? null : <p className="rounded-card bg-card p-4 on-card">{t.disabled}</p>}
      <div className="flex flex-col gap-2 tablet:flex-row tablet:items-end tablet:justify-between">
        <label className="flex w-full max-w-md flex-col gap-1">
          <span className="text-sm font-semibold">{t.search}</span>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" />
          </span>
        </label>
        <p className="text-sm text-soft" aria-live="polite">
          {t.count(shown.length, entries.length)} · {t.withVideo(ready)}
        </p>
      </div>
      {shown.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
          {shown.map((entry) => (
            <li key={entry.key} data-catalog-key={entry.key}>
              <Sheet className="flex h-full flex-col gap-3 p-4">
                <div>
                  <h2 className="font-semibold">{entry.name}</h2>
                  <p className="text-sm text-soft">{m.exerciseGuide.families[entry.family]}</p>
                </div>
                {VIEWS.map((view) => (
                  <ViewSlot
                    key={view}
                    entry={entry}
                    view={view}
                    status={states.get(`${entry.key}:${view}`) ?? "none"}
                    enabled={enabled}
                  />
                ))}
              </Sheet>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
