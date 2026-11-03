"use client";

import { m } from "@tartan/i18n";
import { Jumper } from "@/components/jumper";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-card on-card bg-card p-6 pr-20">
      <Jumper pose="landing" className="pointer-events-none absolute -right-4 bottom-0 size-36" />
      <h1 className="t-h1 relative text-balance">{m.common.genericError}</h1>
      <Button className="relative" onClick={reset}>
        {m.common.retry}
      </Button>
    </div>
  );
}
