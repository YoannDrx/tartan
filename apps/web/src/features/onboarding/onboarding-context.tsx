"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CoachTour } from "./coach-tour";
import { updateOnboardingAction } from "./onboarding-state.action";

type OnboardingContextValue = {
  staff: boolean;
  // Nouveau venu : tour, repères et accueil le concernent.
  guided: boolean;
  plannerAvailable: boolean;
  seenScreens: ReadonlySet<string>;
  markScreenSeen: (screen: string) => void;
  openTour: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => useContext(OnboardingContext);

// L'écran où le tour s'ouvre seul, une fois : l'arrivée du coach.
const TOUR_HOME = "/suivi";

// Ce que les écrans du coach partagent : le tour de piste, rouvrable de partout, et les repères déjà vus.
// L'état vit en base (`onboarding_states`) : il suit le coach d'un navigateur à l'autre.
export const OnboardingProvider = ({
  staff,
  guided,
  tourDue,
  seenScreens,
  plannerAvailable,
  children,
}: {
  staff: boolean;
  guided: boolean;
  tourDue: boolean;
  seenScreens: string[];
  plannerAvailable: boolean;
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const [tourOpen, setTourOpen] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(seenScreens));
  // Le gabarit ne se recharge pas d'une page à l'autre : une fois vu ici, le tour ne revient pas.
  const tourPending = useRef(staff && tourDue);

  useEffect(() => {
    if (!tourPending.current || pathname !== TOUR_HOME) return;
    // Après le premier rendu : l'écran est déjà utilisable sous le dialogue.
    const first = setTimeout(() => {
      tourPending.current = false;
      setTourOpen(true);
    }, 0);
    return () => clearTimeout(first);
  }, [pathname]);

  const seenRef = useRef(seen);
  const markScreenSeen = useCallback((screen: string) => {
    if (seenRef.current.has(screen)) return;
    seenRef.current = new Set([...seenRef.current, screen]);
    setSeen(seenRef.current);
    void updateOnboardingAction({ seenScreen: screen });
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    tourPending.current = false;
    void updateOnboardingAction({ tourSeen: true });
  }, []);

  const value = useMemo(
    () => ({
      staff,
      guided,
      plannerAvailable,
      seenScreens: seen,
      markScreenSeen,
      openTour: () => setTourOpen(true),
    }),
    [staff, guided, plannerAvailable, seen, markScreenSeen],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {staff ? <CoachTour open={tourOpen} onClose={closeTour} plannerAvailable={plannerAvailable} /> : null}
    </OnboardingContext.Provider>
  );
};
