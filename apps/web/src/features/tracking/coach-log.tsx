"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { coachLogAction } from "./tracking.action";

export const CoachLog = ({ sessionId, athleteId }: { sessionId: string; athleteId: string }) => {
  const router = useRouter();
  const { execute, isPending } = useAction(coachLogAction, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <div className="flex gap-1">
      {(["done", "partial"] as const).map((status) => (
        <Button
          key={status}
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => execute({ sessionId, athleteId, status })}
        >
          {m.status[status]}
        </Button>
      ))}
    </div>
  );
};
