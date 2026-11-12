"use client";

import { absenceReason, type AbsenceReason } from "@tartan/contracts";
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
  const [reason, setReason] = useState<AbsenceReason | null>(null);
  const [isPending, setPending] = useState(false);
  const answer = async (status: "present" | "absent", chosen?: AbsenceReason) => {
    setPending(true);
    const res = await submitOp({
      id: crypto.randomUUID(),
      kind: "attendance",
      target: sessionId,
      path: `/orgs/${organizationId}/sessions/${sessionId}/attendance`,
      body: chosen ? { status, reason: chosen } : { status },
    });
    setPending(false);
    if (res.state === "error") return toast.error(res.message);
    setCurrent(status);
    setReason(status === "absent" ? (chosen ?? null) : null);
    if (res.state === "queued") return toast.ok(m.offline.attendanceQueued);
    if (chosen) toast.ok(m.today.absenceReasonSaved);
    else if (status === "absent") {
      const { hasAutonomous } = (res.data ?? {}) as { hasAutonomous?: boolean };
      toast.ok(hasAutonomous ? m.today.switchedAutonomous : m.today.coachInformed);
    }
    router.refresh();
  };
  return { current, reason, isPending, answer };
};

// Une fois l'absence déclarée, l'athlète peut dire pourquoi, d'un geste de plus. Jamais une donnée de santé.
const AbsenceReasons = ({
  reason,
  isPending,
  choose,
}: {
  reason: AbsenceReason | null;
  isPending: boolean;
  choose: (reason: AbsenceReason) => void;
}) => (
  <fieldset className="flex flex-wrap items-center gap-2">
    <legend className="t-caption mb-1">{m.today.absenceReasonLegend}</legend>
    {absenceReason.options.map((option) => (
      <button
        key={option}
        type="button"
        disabled={isPending}
        aria-pressed={reason === option}
        onClick={() => choose(option)}
        className={cn(
          "min-h-11 rounded-full px-4 font-medium",
          reason === option
            ? "bg-accent font-semibold text-on-accent"
            : "border border-pill-line bg-pill-off text-inherit hover:bg-raise",
        )}
      >
        {m.today.absenceReasons[option]}
      </button>
    ))}
  </fieldset>
);

export const AttendanceQuestion = ({ sessionId, current: initial }: { sessionId: string; current: Attendance }) => {
  const { current, reason, isPending, answer } = useAttendance(sessionId, initial);
  return (
    <div className="flex flex-col gap-3">
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
              ? "bg-accent font-semibold text-on-accent"
              : "border border-pill-line bg-pill-off text-inherit hover:bg-raise",
          )}
        >
          {status === "present" ? m.today.attendanceYes : m.today.attendanceNo}
        </button>
      ))}
    </fieldset>
    {current === "absent" ? (
      <AbsenceReasons reason={reason} isPending={isPending} choose={(chosen) => answer("absent", chosen)} />
    ) : null}
    </div>
  );
};

// Le jour même, la question de la veille n'a plus de sens : reste la bascule en autonomie, plus discrète.
export const TodayAbsence = ({ sessionId, current: initial }: { sessionId: string; current: Attendance }) => {
  const { current, reason, isPending, answer } = useAttendance(sessionId, initial);
  const absent = current === "absent";
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => answer(absent ? "present" : "absent")}
        className="min-h-11 self-start text-ctx-link underline"
      >
        {absent ? m.today.comingAfterAll : m.today.notComing}
      </button>
      {absent ? (
        <AbsenceReasons reason={reason} isPending={isPending} choose={(chosen) => answer("absent", chosen)} />
      ) : null}
    </div>
  );
};
