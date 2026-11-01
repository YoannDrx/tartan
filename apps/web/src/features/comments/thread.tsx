"use client";

import type { CommentEntity, CommentItem } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Ban, Flag } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addCommentAction, blockUserAction, reportContentAction } from "./comment.action";

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
  const add = useAction(addCommentAction, {
    onSuccess: () => setBody(""),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const report = useAction(reportContentAction, { onSuccess: () => toast.ok(m.comments.reported) });
  const block = useAction(blockUserAction, { onSuccess: () => toast.ok("Utilisateur bloqué.") });
  return (
    <section aria-label={m.comments.title} className="flex flex-col gap-3">
      <h2 className={cn("t-section", dark && "text-muted-on-ink")}>{m.comments.title}</h2>
      {comments.length === 0 ? <p className={dark ? "text-muted-on-ink" : "text-muted"}>{m.comments.empty}</p> : null}
      <ul className="flex flex-col gap-2">
        {comments.map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex items-start gap-2 rounded-card p-3",
              dark ? "bg-ink-2" : "border border-border bg-surface",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn("t-caption", dark ? "text-muted-on-ink" : "text-muted")}>{c.authorName}</p>
              <p className="break-words">{c.body}</p>
            </div>
            {c.authorId !== currentUserId ? (
              <div className="flex">
                <IconButton
                  label={m.comments.report}
                  tone={dark ? "dark" : "plain"}
                  onClick={() => report.execute({ entityType: "comment", entityId: c.id, reason: "inappropriate" })}
                >
                  <Flag aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  label={m.comments.block}
                  tone={dark ? "dark" : "plain"}
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
          if (body.trim()) add.execute({ entityType, entityId, body, path });
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
          className={dark ? "min-h-11 border-ink-3 bg-ink text-white placeholder:text-muted-on-ink" : "min-h-11"}
        />
        <Button
          type="submit"
          size="sm"
          variant={dark ? "darkSecondary" : "secondary"}
          className="self-start"
          disabled={add.isPending || !body.trim()}
        >
          {m.common.send}
        </Button>
      </form>
    </section>
  );
};
