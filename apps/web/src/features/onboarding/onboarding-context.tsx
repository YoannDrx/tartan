"use client";

import type { OnboardingPatch } from "@tartan/contracts";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToastShown } from "@/components/ui/toast";
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
  // Garde un geste (tour vu, accueil refermé, carte refermée, fête jouée) même si la page part aussitôt.
  save: (patch: OnboardingPatch) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => useContext(OnboardingContext);

// L'écran où le tour s'ouvre seul, une fois : l'arrivée du coach.
const TOUR_HOME = "/suivi";

// L'écriture d'un geste (tour refermé, accueil ou carte refermés, fête jouée) part en `keepalive` sur l'API des
// premiers pas : un rechargement ou un changement de page juste après ne l'annule pas. La réponse est lue jusqu'au
// bout : une requête dont le corps reste en attente compte comme encore en cours. Un échec ne bloque rien.
const send = (organizationId: string, patch: OnboardingPatch) =>
  fetch(`/api/v1/orgs/${organizationId}/onboarding`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
    credentials: "same-origin",
    keepalive: true,
  })
    .then((response) => response.text())
    .catch(() => undefined);

// Ce que les écrans partagent : le tour de piste, rouvrable de partout, les repères déjà vus, et l'écriture des gestes.
// L'état vit en base (`onboarding_states`) : il suit la personne d'un navigateur à l'autre.
export const OnboardingProvider = ({
  organizationId,
  staff,
  guided,
  tourDue,
  seenScreens,
  plannerAvailable,
  children,
}: {
  organizationId: string;
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

  const save = useCallback((patch: OnboardingPatch) => void send(organizationId, patch), [organizationId]);

  // Un message encore affiché (« 2 invitations envoyées ») confirme ce qui vient d'être fait : le tour attend qu'il
  // soit parti plutôt que de le recouvrir ou de le couper. Il ne retarde rien, l'écran dessous est déjà là.
  const toastShown = useToastShown();
  useEffect(() => {
    if (!tourPending.current || pathname !== TOUR_HOME || toastShown) return;
    // Après le premier rendu : l'écran est déjà utilisable sous le dialogue.
    const first = setTimeout(() => {
      tourPending.current = false;
      setTourOpen(true);
    }, 0);
    return () => clearTimeout(first);
  }, [pathname, toastShown]);

  const seenRef = useRef(seen);
  const markScreenSeen = useCallback((screen: string) => {
    if (seenRef.current.has(screen)) return;
    seenRef.current = new Set([...seenRef.current, screen]);
    setSeen(seenRef.current);
    // Noté à l'arrivée sur l'écran, pas par un geste : l'action serveur suffit. Quitter l'écran aussitôt ne coûte
    // au pire que de revoir le repère une fois.
    void updateOnboardingAction({ seenScreen: screen });
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    tourPending.current = false;
    save({ tourSeen: true });
  }, [save]);

  const value = useMemo(
    () => ({
      staff,
      guided,
      plannerAvailable,
      seenScreens: seen,
      markScreenSeen,
      openTour: () => setTourOpen(true),
      save,
    }),
    [staff, guided, plannerAvailable, seen, markScreenSeen, save],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {staff ? <CoachTour open={tourOpen} onClose={closeTour} plannerAvailable={plannerAvailable} /> : null}
    </OnboardingContext.Provider>
  );
};
