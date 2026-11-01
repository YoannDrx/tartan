"use client";

import { m } from "@tartan/i18n";
import { LaneArcs } from "@/components/pictos";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-card on-card bg-card p-6 pr-20">
      <LaneArcs className="pointer-events-none absolute inset-y-0 right-0 h-full w-40 text-card-raised" />
      <h1 className="t-h1 relative text-balance">{m.common.genericError}</h1>
      <Button className="relative" onClick={reset}>
        {m.common.retry}
      </Button>
    </div>
  );
}
