"use client";

import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";

export const OfflineActions = () => (
  <div className="flex flex-wrap gap-2">
    <Button variant="inverse" onClick={() => window.location.reload()}>
      {m.offline.retry}
    </Button>
    <Button asChild variant="secondary">
      <a href="/accueil">{m.offline.today}</a>
    </Button>
  </div>
);
