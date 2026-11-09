"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 15_000;

// Mux finit l'encodage après l'envoi : l'écran se met à jour tout seul, uniquement quand il est visible.
export const RefreshWhilePending = () => {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
};
