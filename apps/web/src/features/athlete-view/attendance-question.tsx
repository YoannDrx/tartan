"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toast";
import { attendanceAction } from "./athlete.action";

export const AttendanceQuestion = ({
  sessionId,
  current,
}: {
  sessionId: string;
  current: "present" | "absent" | "unknown";
}) => {
  const { execute, isPending } = useAction(attendanceAction, {
    onSuccess: ({ data, input }) => {
      if (input.status === "absent")
        toast.ok(data?.hasAutonomous ? m.today.switchedAutonomous : "Ton coach est au courant.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="t-caption mb-1">{m.today.attendanceQuestion}</legend>
      {(["present", "absent"] as const).map((status) => (
        <button
          key={status}
          type="button"
          disabled={isPending}
          aria-pressed={current === status}
          onClick={() => execute({ sessionId, status })}
          className={cn(
            "min-h-11 rounded-full px-4 font-medium",
            current === status ? "bg-ink font-semibold text-white" : "border border-border bg-surface text-ink",
          )}
        >
          {status === "present" ? m.today.attendanceYes : m.today.attendanceNo}
        </button>
      ))}
    </fieldset>
  );
};

// Le jour même, la question de la veille n'a plus de sens : reste la bascule en autonomie, plus discrète.
export const TodayAbsence = ({
  sessionId,
  current,
}: {
  sessionId: string;
  current: "present" | "absent" | "unknown";
}) => {
  const absent = current === "absent";
  const { execute, isPending } = useAction(attendanceAction, {
    onSuccess: ({ data, input }) => {
      if (input.status === "absent")
        toast.ok(data?.hasAutonomous ? m.today.switchedAutonomous : "Ton coach est au courant.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => execute({ sessionId, status: absent ? "present" : "absent" })}
      className="min-h-11 self-start text-brand-strong underline"
    >
      {absent ? m.today.comingAfterAll : m.today.notComing}
    </button>
  );
};
