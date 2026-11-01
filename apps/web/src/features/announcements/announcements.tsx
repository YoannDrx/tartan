"use client";

import type { AnnouncementItem } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Flag, Pin, PinOff, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Chip, EmptyState } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { CheckRow, Field, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { reportContentAction } from "@/features/comments/comment.action";
import { deleteAnnouncementAction, pinAnnouncementAction, publishAnnouncementAction } from "./announcement.action";

const dateLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export const AnnouncementComposer = ({ groups }: { groups: { id: string; name: string }[] }) => {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const { execute, isPending } = useAction(publishAnnouncementAction, {
    onSuccess: () => {
      setBody("");
      setPinned(false);
      toast.ok("Annonce publiée. Ton groupe est prévenu.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  return (
    <form
      className="flex flex-col gap-3 rounded-block border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim() && groupId) execute({ groupId, body, pinned });
      }}
    >
      <h2 className="t-h2">{m.announcements.new}</h2>
      <Field label="Message">
        {(a) => (
          <Textarea
            {...a}
            placeholder={m.announcements.placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Groupe" className="min-w-48">
          {(a) => (
            <Select {...a} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <CheckRow label={m.announcements.pin} checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <Button type="submit" size="sm" className="ml-auto" disabled={isPending || !body.trim()}>
          {m.announcements.publish}
        </Button>
      </div>
    </form>
  );
};

export const AnnouncementList = ({ items, canManage }: { items: AnnouncementItem[]; canManage: boolean }) => {
  const pin = useAction(pinAnnouncementAction);
  const remove = useAction(deleteAnnouncementAction);
  const report = useAction(reportContentAction, { onSuccess: () => toast.ok(m.comments.reported) });
  if (items.length === 0) return <EmptyState>{m.announcements.empty}</EmptyState>;
  return (
    <ul className="divide-y divide-border rounded-block border border-border bg-surface">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-2 p-4">
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-line break-words">{a.body}</p>
            <p className="t-caption mt-1 flex flex-wrap items-center gap-2 font-normal text-muted">
              {a.authorName}, {a.groupName}, {dateLabel.format(new Date(a.createdAt))}
              {a.pinned ? <Chip tone="brand">{m.announcements.pinned}</Chip> : null}
            </p>
          </div>
          {canManage ? (
            <div className="flex">
              <IconButton
                label={a.pinned ? "Désépingler" : m.announcements.pin}
                onClick={() => pin.execute({ id: a.id, pinned: !a.pinned })}
              >
                {a.pinned ? <PinOff aria-hidden className="size-4" /> : <Pin aria-hidden className="size-4" />}
              </IconButton>
              <IconButton
                label={m.common.delete}
                onClick={() => window.confirm("Supprimer cette annonce ?") && remove.execute({ id: a.id })}
              >
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            </div>
          ) : (
            <IconButton
              label={m.comments.report}
              onClick={() => report.execute({ entityType: "announcement", entityId: a.id, reason: "inappropriate" })}
            >
              <Flag aria-hidden className="size-4" />
            </IconButton>
          )}
        </li>
      ))}
    </ul>
  );
};
