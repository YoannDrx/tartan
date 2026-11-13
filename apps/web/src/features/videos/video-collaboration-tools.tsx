"use client";

import type { VideoDetail } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteVideoAction, markVideoReviewedAction, shareVideoAction } from "./video.action";

export function VideoCollaborationTools({
  video,
  staff,
  backHref,
}: {
  video: VideoDetail;
  staff: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(video.sharedGroupIds ?? []);
  const share = useAction(shareVideoAction, {
    onSuccess: () => {
      toast.ok(m.videoCollaboration.shareSaved);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const review = useAction(markVideoReviewedAction, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const remove = useAction(deleteVideoAction, {
    onSuccess: () => {
      router.push(backHref);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  if (!staff && !video.canShareGroups && !video.canManage) return null;
  return (
    <section className="space-y-3 rounded-card border border-card-line p-3">
      {staff ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{video.reviewedAt ? m.videoCollaboration.reviewed : m.videoCollaboration.awaitingReview}</span>
          {!video.reviewedAt && video.status === "ready" && video.canAnnotate ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={review.isPending}
              onClick={() => review.execute({ videoId: video.id })}
            >
              {m.videoCollaboration.review}
            </Button>
          ) : null}
        </div>
      ) : null}
      {video.canShareGroups ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{m.videoCollaboration.shareGroups}</summary>
          <p className="mb-3 text-sm text-soft">{m.videoCollaboration.shareNotice}</p>
          <fieldset disabled={share.isPending} className="space-y-2">
            <legend className="sr-only">{m.videoCollaboration.groups}</legend>
            {(video.availableShareGroups ?? []).map((group) => (
              <CheckRow
                key={group.id}
                label={group.name}
                checked={selected.includes(group.id)}
                onChange={(event) =>
                  setSelected(event.target.checked ? [...selected, group.id] : selected.filter((id) => id !== group.id))
                }
              />
            ))}
            <ConfirmDialog
              title={m.videoCollaboration.shareNotice}
              tone="neutral"
              confirmLabel={m.videoCollaboration.saveShare}
              onConfirm={() =>
                share.execute({
                  videoId: video.id,
                  withAthlete: true,
                  withGroup: selected.length > 0,
                  groupIds: selected,
                })
              }
              trigger={
                <Button variant="secondary" size="sm">
                  {m.videoCollaboration.saveShare}
                </Button>
              }
            />
          </fieldset>
        </details>
      ) : null}
      {video.canManage ? (
        <ConfirmDialog
          title={m.videoCollaboration.deleteConfirm}
          onConfirm={() => remove.execute({ videoId: video.id })}
          trigger={
            <Button variant="quiet" size="sm" disabled={remove.isPending}>
              {m.common.delete}
            </Button>
          }
        />
      ) : null}
    </section>
  );
}
