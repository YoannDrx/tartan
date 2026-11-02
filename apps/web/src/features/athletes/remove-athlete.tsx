"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { removeAthleteAction } from "@/features/settings/settings.action";

export const RemoveAthlete = ({ id, name }: { id: string; name: string }) => {
  const router = useRouter();
  const remove = useAction(removeAthleteAction, {
    onSuccess: () => {
      toast.ok(m.athletes.removed(name));
      router.push("/athletes");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <ConfirmDialog
      title={m.athletes.removeTitle(name)}
      description={m.athletes.removeDetail}
      confirmLabel={m.athletes.removeTitle(name)}
      onConfirm={() => remove.execute({ id })}
      trigger={
        <Button size="sm" variant="danger" disabled={remove.isPending}>
          {m.athletes.remove}
        </Button>
      }
    />
  );
};
