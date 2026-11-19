"use client";

import { w } from "@tartan/i18n/web";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./onboarding-context";

// Le tour de piste se revoit à la demande, depuis la page des premiers pas.
export const ReopenTour = () => {
  const onboarding = useOnboarding();
  if (!onboarding) return null;
  return (
    <Button size="sm" variant="secondary" onClick={onboarding.openTour}>
      {w.onboarding.tour.reopen}
    </Button>
  );
};
