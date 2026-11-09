"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { linkVideoExerciseAction } from "./video.action";

// Rattache la vidéo au mouvement travaillé : c'est ce qui la fait remonter dans « À travailler ».
export const VideoExerciseLink = ({
  videoId,
  current,
  exercises,
}: {
  videoId: string;
  current: string | null;
  exercises: { id: string; name: string }[];
}) => {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const link = useAction(linkVideoExerciseAction, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <label className="flex min-w-0 items-center gap-2 text-[14px]">
      <span className="shrink-0 text-soft">{m.video.exerciseLink}</span>
      <select
        className="min-h-11 min-w-0 max-w-64 flex-1 rounded-button border border-control-line bg-transparent px-2 text-inherit"
        value={value}
        disabled={link.isPending}
        onChange={(e) => {
          setValue(e.target.value);
          link.execute({ videoId, exerciseId: e.target.value || null });
        }}
      >
        <option value="">{m.video.exerciseNone}</option>
        {exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>
    </label>
  );
};
