"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (notify) => {
      const media = matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => matchMedia(query).matches,
    () => false,
  );

// En paysage ou sur un écran large, l'éditeur tient à droite de l'image ; en portrait étroit, c'est une feuille en bas.
const SIDE = "(orientation: landscape), (min-width: 1024px)";
// Le vrai plein écran du navigateur sert là où il y a une souris et un clavier. Sur téléphone, Safari ne l'accorde
// qu'à l'élément vidéo : l'analyse s'y déploie en surcouche, comme partout où l'API manque ou refuse.
const POINTER = "(hover: hover) and (pointer: fine)";

type Viewport = { height: number; top: number };

// Le plein écran de l'analyse : toute la fenêtre (et tout l'écran quand le navigateur l'accorde) pour l'image et
// son éditeur. C'est la page entière qui passe en plein écran, pas le seul conteneur : les dialogues et les
// messages vivent dans des portails hors du conteneur, ils disparaîtraient sinon.
export const useImmersive = () => {
  const [on, setOn] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const side = useMediaQuery(SIDE);
  const scroll = useRef(0);
  const owned = useRef(false);

  const enter = useCallback(() => {
    scroll.current = window.scrollY;
    setOn(true);
    if (!document.fullscreenEnabled || !matchMedia(POINTER).matches) return;
    owned.current = true;
    // Un refus (permission, cadre intégré) laisse la surcouche, qui suffit.
    document.documentElement.requestFullscreen().catch(() => {
      owned.current = false;
    });
  }, []);

  const exit = useCallback(() => {
    setOn(false);
    if (owned.current && document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    owned.current = false;
  }, []);

  // Échap, géré par le navigateur en vrai plein écran : la surcouche suit.
  useEffect(() => {
    const sync = () => {
      if (document.fullscreenElement || !owned.current) return;
      owned.current = false;
      setOn(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (owned.current && document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // La surcouche suit la partie visible de la fenêtre : quand le clavier du téléphone s'ouvre, l'image reste dessus.
  useEffect(() => {
    if (!on) return;
    const visual = window.visualViewport;
    if (!visual) return;
    const sync = () =>
      setViewport((current) => {
        const next = { height: Math.round(visual.height), top: Math.round(visual.offsetTop) };
        return current && current.height === next.height && current.top === next.top ? current : next;
      });
    sync();
    visual.addEventListener("resize", sync);
    visual.addEventListener("scroll", sync);
    return () => {
      visual.removeEventListener("resize", sync);
      visual.removeEventListener("scroll", sync);
      setViewport(null);
      // La page reprend là où on l'avait laissée.
      window.scrollTo({ top: scroll.current, behavior: "instant" });
    };
  }, [on]);

  return { on, side, viewport, enter, exit };
};
