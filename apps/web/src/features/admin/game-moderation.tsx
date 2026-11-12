"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Confirm } from "./console-actions";
import { banGameDeviceAction, hideGameScoreAction } from "./game.action";

const t = m.admin.game;
const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

// Masquer un score, ou bannir l'appareil qui l'a envoyé : tous ses scores disparaissent du classement.
export const GameModeration = ({ id, hidden }: { id: string; hidden: boolean }) => {
  const hide = useAction(hideGameScoreAction, { onError });
  const ban = useAction(banGameDeviceAction, { onSuccess: () => toast.ok(t.banned), onError });
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={hide.isPending}
        onClick={() => hide.execute({ id, hidden: !hidden })}
      >
        {hidden ? t.show : t.hide}
      </Button>
      <Confirm label={t.ban} detail={t.banDetail} disabled={ban.isPending} onConfirm={() => ban.execute({ id })} />
    </div>
  );
};
