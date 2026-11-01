"use client";

import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="t-h1">{m.common.genericError}</h1>
      <Button onClick={reset}>{m.common.retry}</Button>
    </div>
  );
}
