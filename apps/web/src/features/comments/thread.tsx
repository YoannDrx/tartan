"use client";

import type { CommentEntity, CommentItem } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Ban, Flag } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useSpaceId } from "@/features/offline/offline-provider";
import { submitOp } from "@/features/offline/op-queue";
import { blockUserAction, reportContentAction } from "./comment.action";

export const CommentThread = ({
  entityType,
  entityId,
  comments,
  currentUserId,
  path,
  dark,
}: {
  entityType: CommentEntity;
  entityId: string;
  comments: CommentItem[];
  currentUserId: string;
  path: string;
  dark?: boolean;
}) => {
  const [body, setBody] = useState("");
  const router = useRouter();
  const organizationId = useSpaceId();
  const [sending, setSending] = useState(false);
  const add = async (text: string) => {
    setSending(true);
    const clientId = crypto.randomUUID();
    const res = await submitOp({
      id: clientId,
      kind: "comment",
      target: entityId,
      path: `/orgs/${organizationId}/comments`,
      body: { entityType, entityId, body: text, clientId },
    });
    setSending(false);
    if (res.state === "error") return toast.error(res.message);
    setBody("");
    if (res.state === "queued") toast.ok(m.offline.commentQueued);
    else router.refresh();
  };
  const report = useAction(reportContentAction, { onSuccess: () => toast.ok(m.comments.reported) });
  const block = useAction(blockUserAction, { onSuccess: () => toast.ok("Utilisateur bloqué.") });
  return (
    <section
      aria-label={m.comments.title}
      className={cn("flex flex-col gap-3", !dark && "on-card rounded-card bg-card p-4")}
    >
      <h2 className="t-section">{m.comments.title}</h2>
      {comments.length === 0 ? <p className="text-soft">{m.comments.empty}</p> : null}
      <ul className="flex flex-col gap-2">
        {comments.map((c) => (
          <li key={c.id} className={cn("flex items-start gap-2 rounded-card p-3", "bg-card-raised")}>
            <div className="min-w-0 flex-1">
              <p className="t-caption text-soft">{c.authorName}</p>
              <p className="break-words">{c.body}</p>
            </div>
            {c.authorId !== currentUserId ? (
              <div className="flex">
                <IconButton
                  label={m.comments.report}
                  tone="plain"
                  onClick={() => report.execute({ entityType: "comment", entityId: c.id, reason: "inappropriate" })}
                >
                  <Flag aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  label={m.comments.block}
                  tone="plain"
                  onClick={() => block.execute({ userId: c.authorId, path })}
                >
                  <Ban aria-hidden className="size-4" />
                </IconButton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) void add(body);
        }}
      >
        <label className="sr-only" htmlFor={`comment-${entityId}`}>
          {m.comments.placeholder}
        </label>
        <Textarea
          id={`comment-${entityId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={m.comments.placeholder}
          className="min-h-11"
        />
        <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={sending || !body.trim()}>
          {m.common.send}
        </Button>
      </form>
    </section>
  );
};
