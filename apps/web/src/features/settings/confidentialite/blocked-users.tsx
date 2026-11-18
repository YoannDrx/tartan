"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { Rows } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { unblockUserAction } from "@/features/comments/comment.action";

export const BlockedUsers = ({ users }: { users: { id: string; name: string | null }[] }) => {
  const unblock = useAction(unblockUserAction, {
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  if (users.length === 0) return <p className="text-soft">{m.settings.blockedEmpty}</p>;
  return (
    <Rows>
      {users.map((user) => (
        <li key={user.id} className="flex items-center justify-between gap-3 py-2">
          <span className="break-words">{user.name ?? m.settings.blockedUnknown}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={unblock.isPending}
            onClick={() => unblock.execute({ userId: user.id })}
          >
            {m.settings.unblock}
          </Button>
        </li>
      ))}
    </Rows>
  );
};
