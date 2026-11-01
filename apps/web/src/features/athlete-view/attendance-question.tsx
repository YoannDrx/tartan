"use client";

import { m } from "@tartan/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toast";
import { useSpaceId } from "@/features/offline/offline-provider";
import { submitOp } from "@/features/offline/op-queue";

type Attendance = "present" | "absent" | "unknown";

// Répondre marche sans réseau : la réponse part au retour de la connexion.
const useAttendance = (sessionId: string, initial: Attendance) => {
  const router = useRouter();
  const organizationId = useSpaceId();
  const [current, setCurrent] = useState(initial);
  const [isPending, setPending] = useState(false);
  const answer = async (status: "present" | "absent") => {
    setPending(true);
    const res = await submitOp({
      id: crypto.randomUUID(),
      kind: "attendance",
      target: sessionId,
      path: `/orgs/${organizationId}/sessions/${sessionId}/attendance`,
      body: { status },
    });
    setPending(false);
    if (res.state === "error") return toast.error(res.message);
    setCurrent(status);
    if (res.state === "queued") return toast.ok(m.offline.attendanceQueued);
    if (status === "absent") {
      const { hasAutonomous } = (res.data ?? {}) as { hasAutonomous?: boolean };
      toast.ok(hasAutonomous ? m.today.switchedAutonomous : "Ton coach est au courant.");
    }
    router.refresh();
  };
  return { current, isPending, answer };
};

export const AttendanceQuestion = ({ sessionId, current: initial }: { sessionId: string; current: Attendance }) => {
  const { current, isPending, answer } = useAttendance(sessionId, initial);
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="t-caption mb-1">{m.today.attendanceQuestion}</legend>
      {(["present", "absent"] as const).map((status) => (
        <button
          key={status}
          type="button"
          disabled={isPending}
          aria-pressed={current === status}
          onClick={() => answer(status)}
          className={cn(
            "min-h-11 rounded-full px-4 font-medium",
            current === status
              ? "bg-white font-semibold text-ink"
              : "border border-pill-line bg-pill-off text-inherit hover:bg-raise",
          )}
        >
          {status === "present" ? m.today.attendanceYes : m.today.attendanceNo}
        </button>
      ))}
    </fieldset>
  );
};

// Le jour même, la question de la veille n'a plus de sens : reste la bascule en autonomie, plus discrète.
export const TodayAbsence = ({ sessionId, current: initial }: { sessionId: string; current: Attendance }) => {
  const { current, isPending, answer } = useAttendance(sessionId, initial);
  const absent = current === "absent";
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => answer(absent ? "present" : "absent")}
      className="min-h-11 self-start text-ctx-link underline"
    >
      {absent ? m.today.comingAfterAll : m.today.notComing}
    </button>
  );
};
