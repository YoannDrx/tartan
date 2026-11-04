"use client";

import { Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { m } from "@tartan/i18n";
import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteJumpAction } from "@/features/videos/video.action";
import { deleteCompetitionAction } from "@/features/sessions/session.action";
import { deleteNoteAction, deletePerformanceAction, deleteTestAction } from "./athlete.action";

const actions = {
  test: deleteTestAction,
  performance: deletePerformanceAction,
  note: deleteNoteAction,
  jump: deleteJumpAction,
  competition: deleteCompetitionAction,
};

// Retirer une saisie : une faute de frappe se corrige en supprimant puis en ressaisissant.
export const DeleteRow = ({ kind, id, label }: { kind: keyof typeof actions; id: string; label: string }) => {
  const router = useRouter();
  const { execute, isPending } = useAction(actions[kind], {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <ConfirmDialog
      trigger={
        <IconButton label={`${m.common.delete} : ${label}`} disabled={isPending}>
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      }
      title={m.athletes.deleteEntry}
      description={m.athletes.deleteEntryDetail(label)}
      onConfirm={() => execute({ id })}
    />
  );
};
