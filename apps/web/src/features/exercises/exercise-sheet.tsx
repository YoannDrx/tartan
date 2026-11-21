"use client";

import type { ExerciseList, ExerciseMediaSnapshot, ExerciseSheet, ExerciseSummary } from "@tartan/contracts";
import { formatPrescription, instagramUrl } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Copy, Link2, Pencil, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { deleteExerciseAction, personalizeExerciseAction } from "./exercise.action";
import { MovementGuide, type GuideVariants } from "./exercise-guide";
import { ExerciseForm } from "./exercise-form";
import { FavoriteButton, FileButton, FileDialog, useExerciseLists } from "./exercise-lists-ui";
import { ExternalVideo } from "./exercise-video";

const t = w.exercises;
type Media = ExerciseMediaSnapshot & { streamUrl?: string };

const sourceLink = (media: Media | null) => {
  if (media?.kind === "instagram") return { service: "Instagram", href: instagramUrl(media.instagramCode) };
  if (media?.kind === "youtube") return { service: "YouTube", href: `https://youtu.be/${media.youtubeId}` };
  return null;
};

/** Le contenu d'une fiche : le geste d'abord (ou la vidéo du coach), le guide concis, puis la prescription. */
export const ExerciseDetail = ({ exercise, variants }: { exercise: ExerciseSummary; variants?: GuideVariants }) => {
  const media = exercise.media as Media | null;
  const source = sourceLink(media);
  const prescription = formatPrescription(exercise.defaultPrescription);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {exercise.guide ? <MovementGuide guide={exercise.guide} variants={variants} /> : null}
      {media?.kind === "youtube" || media?.kind === "instagram" ? (
        <ExternalVideo media={media} title={exercise.name} />
      ) : media?.kind === "upload" && media.streamUrl ? (
        <video
          src={media.streamUrl}
          controls
          playsInline
          className="aspect-video w-full rounded-card bg-ink"
          aria-label={exercise.name}
        />
      ) : null}
      {prescription ? <p className="t-num text-[20px]">{prescription}</p> : null}
      {/* Les qualités travaillées, seulement quand la fiche les nomme : rien n'est déduit. */}
      {exercise.tags.length > 0 ? (
        <p>
          <span className="font-semibold">{m.exercises.tags} : </span>
          {exercise.tags.join(", ")}
        </p>
      ) : null}
      {exercise.cues.length > 0 ? (
        <section>
          <h3 className="t-section">{m.exercises.cues}</h3>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {exercise.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {source ? (
        <p className="t-caption flex flex-wrap items-center justify-between gap-x-4 font-normal text-soft">
          {media && "author" in media && media.author ? <span>{m.exercises.videoBy(media.author)}</span> : null}
          <a href={source.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">
            {m.exercises.watchOn(source.service)}
          </a>
        </p>
      ) : null}
    </div>
  );
};

/** Les gestes du coach sur une fiche : étoile, listes, personnaliser une fiche commune, modifier la sienne. */
export const SheetActions = ({
  exercise,
  lists: initialLists,
  videoEnabled,
  openEdit = false,
}: {
  exercise: ExerciseSheet;
  lists: ExerciseList[];
  videoEnabled: boolean;
  /** « Compléter la fiche », après une création rapide : le formulaire complet s'ouvre à l'arrivée. */
  openEdit?: boolean;
}) => {
  const router = useRouter();
  const state = useExerciseLists(initialLists);
  const [filing, setFiling] = useState(false);
  // Seule une fiche de l'espace se modifie.
  const [editing, setEditing] = useState(openEdit && !exercise.shared);
  const personalize = useAction(personalizeExerciseAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      toast.ok(data.created ? t.sheet.personalized : t.sheet.alreadyPersonalized);
      router.push(`/exercices/${data.id}`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const remove = useAction(deleteExerciseAction, {
    onSuccess: () => router.push("/exercices"),
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  // Avant la première étoile, la fiche dit ce que le serveur sait.
  const favorite = state.favorites ? state.isFavorite(exercise.id) : exercise.favorite;
  return (
    <>
      {/* Seule une fiche du catalogue se personnalise : la copie garde son guide et son geste. */}
      {exercise.shared ? (
        exercise.motionKey ? (
          <Button size="sm" onClick={() => personalize.execute({ id: exercise.id })} disabled={personalize.isPending}>
            <Copy aria-hidden className="size-4" />
            {t.sheet.personalize}
          </Button>
        ) : null
      ) : (
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden className="size-4" />
          {m.common.edit}
        </Button>
      )}
      <span className="on-card inline-flex rounded-full bg-card">
        <FavoriteButton
          name={exercise.name}
          active={favorite}
          onToggle={() => void state.toggleFavorite(exercise.id)}
        />
        <FileButton name={exercise.name} onClick={() => setFiling(true)} />
        <IconButton
          label={t.sheet.share}
          onClick={async () => {
            await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
            toast.ok(t.sheet.linkCopied);
          }}
        >
          <Link2 aria-hidden className="size-5" />
        </IconButton>
        {exercise.shared ? null : (
          <ConfirmDialog
            title={m.exercises.deleteTitle(exercise.name)}
            description={m.exercises.deleteNotice}
            onConfirm={() => remove.execute({ id: exercise.id })}
            trigger={
              <IconButton label={`${m.common.delete} ${exercise.name}`}>
                <Trash2 aria-hidden className="size-5" />
              </IconButton>
            }
          />
        )}
      </span>
      <FileDialog exercise={filing ? exercise : null} state={state} onClose={() => setFiling(false)} />
      <Dialog open={editing} onOpenChange={setEditing} title={exercise.name} wide>
        {editing ? (
          <ExerciseForm
            exercise={exercise}
            videoEnabled={videoEnabled}
            onDone={() => {
              setEditing(false);
              // Arrivée par « Compléter la fiche », la page reprend son adresse : la recharger ne rouvre rien.
              if (openEdit) router.replace(`/exercices/${exercise.id}`);
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
};
