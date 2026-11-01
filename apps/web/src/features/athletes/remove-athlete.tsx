"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
    <Dialog
      title={m.athletes.removeTitle(name)}
      description={m.athletes.removeDetail}
      trigger={
        <Button size="sm" variant="danger">
          {m.athletes.remove}
        </Button>
      }
    >
      <Button variant="danger" disabled={remove.isPending} onClick={() => remove.execute({ id })}>
        {m.athletes.removeTitle(name)}
      </Button>
    </Dialog>
  );
};
