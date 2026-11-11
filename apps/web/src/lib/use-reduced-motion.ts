"use client";

import { useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const watch = (notify: () => void) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

// Vrai quand l'appareil demande moins de mouvement. Côté serveur, on ne le sait pas encore : faux.
export const useReducedMotion = () =>
  useSyncExternalStore(
    watch,
    () => matchMedia(REDUCED).matches,
    () => false,
  );
