"use client";

import { w } from "@tartan/i18n/web";
import { Lightbulb, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { screenHintFor } from "@/features/help/screen-help";
import { useOnboarding } from "./onboarding-context";

const t = w.onboarding.hint;

// Le repère de première visite : une phrase d'aide sous le bandeau, la première fois qu'un nouveau coach ouvre
// l'écran. Il ne recouvre rien, se referme d'un geste, et ne revient sur aucun appareil (`seenScreens`).
export const ScreenHint = () => {
  const onboarding = useOnboarding();
  const pathname = usePathname();
  const hint = onboarding?.staff && onboarding.guided ? screenHintFor(pathname, true) : null;
  // Vu dès qu'il s'affiche : la décision se prend une fois, à l'arrivée sur l'écran.
  const [due] = useState(() => Boolean(hint && !onboarding?.seenScreens.has(hint.screen)));
  const [closed, setClosed] = useState(false);
  const markScreenSeen = onboarding?.markScreenSeen;
  const screen = hint?.screen;

  useEffect(() => {
    if (due && screen) markScreenSeen?.(screen);
  }, [due, screen, markScreenSeen]);

  if (!due || closed || !hint) return null;
  return (
    <aside
      aria-label={t.label}
      className="on-card flex items-start gap-3 rounded-card border border-card-line bg-card py-2 pl-4 pr-1"
    >
      <Lightbulb aria-hidden className="mt-2.5 size-5 shrink-0 text-link" />
      <p className="min-w-0 flex-1 py-2">{hint.tip}</p>
      <button
        type="button"
        aria-label={t.close}
        onClick={() => setClosed(true)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-raise"
      >
        <X aria-hidden className="size-5" />
      </button>
    </aside>
  );
};
