"use client";

import { useSyncExternalStore } from "react";

// Vrai quand la requête média correspond. Côté serveur, on ne le sait pas encore : `serverValue`, faux par défaut,
// ou null pour ne rien rendre avant l'hydratation.
export const useMediaQuery = <S extends boolean | null = false>(query: string, serverValue: S = false as S) =>
  useSyncExternalStore(
    (notify) => {
      const media = matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => matchMedia(query).matches,
    (): boolean | S => serverValue,
  );

// Le seuil `desktop` de la feuille de styles.
export const DESKTOP = "(min-width: 1024px)";
