"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type DragPoint = { x: number; y: number };
export type DragBox = { left: number; top: number; width: number; height: number };

export type PointerDrag<Item, Drop> = {
  item: Item;
  /** Où se trouve le pointeur, dans la fenêtre. */
  x: number;
  y: number;
  /** Où le pointeur a saisi l'élément, et la boîte de sa source à cet instant : l'aperçu garde ce décalage. */
  grab: DragPoint;
  origin: DragBox;
  /** La destination lue sous le pointeur, ou rien quand il n'y en a pas. */
  drop: Drop | null;
  touch: boolean;
};

type Options<Item, Drop> = {
  /** La destination sous le pointeur. Lue à chaque mouvement, et après chaque défilement automatique. */
  locate: (point: DragPoint, item: Item) => Drop | null;
  onStart?: (item: Item) => void;
  /** Le pointeur est relâché : `drop` vaut `null` quand il n'y avait aucune destination dessous. */
  onEnd: (item: Item, drop: Drop | null, last: PointerDrag<Item, Drop>) => void;
  /** Échap, ou le navigateur a repris le pointeur. */
  onCancel?: (item: Item) => void;
  /**
   * `immediate` : une poignée dédiée, saisie dès l'appui (elle porte `touch-none`).
   * `deliberate` : une carte entière, qui reste cliquable et laisse défiler la page. La souris saisit après
   * quelques pixels, le doigt après un appui long sans bouger.
   */
  activation?: "immediate" | "deliberate";
};

// La bande qui fait défiler la page, plus haute que la barre d'actions fixée en bas.
const EDGE = 112;
// Seuils de geste, pas des durées d'animation : en dessous, c'est un clic ou un défilement.
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
const HOLD_MS = 350;
// Après un glisser, le clic que le navigateur envoie encore ne doit ouvrir ni lien ni bouton.
const CLICK_GUARD_MS = 400;
const INTERACTIVE = "button, input, select, textarea, [role='menuitem'], [data-no-drag]";

type Pending<Item> = {
  item: Item;
  pointerId: number;
  element: HTMLElement;
  start: DragPoint;
  touch: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * Le glisser-déposer au pointeur, commun au constructeur de séance et au planning : souris, stylet et doigt
 * passent par les mêmes événements, la destination se lit sous le pointeur, la page défile près des bords et
 * Échap annule. Le crochet ne dessine rien : l'appelant lit `drag` pour montrer l'aperçu, la source atténuée
 * et la destination. Une alternative sans glisser (boutons, menu) reste obligatoire à côté (WCAG 2.5.7).
 */
export function usePointerDrag<Item, Drop>(options: Options<Item, Drop>) {
  const [drag, setDrag] = useState<PointerDrag<Item, Drop> | null>(null);
  // Les écouteurs de la fenêtre vivent plus longtemps qu'un rendu : ils lisent l'état et les options du moment.
  const live = useRef<PointerDrag<Item, Drop> | null>(null);
  const pending = useRef<Pending<Item> | null>(null);
  const latest = useRef(options);
  const endedAt = useRef(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    latest.current = options;
  });
  const active = drag !== null;
  const deliberate = options.activation === "deliberate";

  // Une carte saisie par appui long laisse la page défiler tant qu'elle n'est pas en main. Une fois en main,
  // le doigt ne doit plus faire défiler : l'écouteur est posé d'avance, car Safari peut ignorer le
  // `preventDefault` d'un écouteur ajouté au milieu d'un geste. Une poignée (`touch-none`) n'en a pas besoin.
  useEffect(() => {
    if (!deliberate) return;
    const onTouchMove = (event: TouchEvent) => {
      if (live.current && event.cancelable) event.preventDefault();
    };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => window.removeEventListener("touchmove", onTouchMove);
  }, [deliberate]);

  const update = (next: PointerDrag<Item, Drop> | null) => {
    live.current = next;
    setDrag(next);
  };

  // Le geste en cours, s'il y en a un : ses écouteurs sont posés à l'appui et retirés à la fin.
  const gesture = useRef<{ stop: () => void } | null>(null);
  const release = () => {
    const waiting = pending.current;
    if (waiting?.timer) clearTimeout(waiting.timer);
    pending.current = null;
    gesture.current?.stop();
    gesture.current = null;
  };
  useEffect(
    () => () => {
      const waiting = pending.current;
      if (waiting?.timer) clearTimeout(waiting.timer);
      gesture.current?.stop();
    },
    [],
  );

  const cancel = () => {
    const current = live.current;
    release();
    if (!current) return;
    update(null);
    latest.current.onCancel?.(current.item);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    // Près d'un bord, la page défile pour atteindre une destination hors de l'écran.
    let frame = 0;
    const scroll = () => {
      const current = live.current;
      if (current) {
        const y = current.y;
        const step =
          y < EDGE ? -(EDGE - y) / 4 : y > window.innerHeight - EDGE ? (y - window.innerHeight + EDGE) / 4 : 0;
        if (step) {
          const before = window.scrollY;
          window.scrollBy(0, step);
          // La page a bougé sous un pointeur immobile : la destination n'est plus la même.
          if (window.scrollY !== before) {
            const drop = latest.current.locate({ x: current.x, y: current.y }, current.item);
            if (drop !== current.drop) update({ ...current, drop });
          }
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
    // `cancel` ne lit que des références : l'effet ne dépend que du glisser en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Une poignée saisie sans bouger ne désigne encore aucune destination : la relâcher ne déplace rien.
  const begin = (waiting: Pending<Item>, point: DragPoint, still = false) => {
    if (waiting.timer) clearTimeout(waiting.timer);
    pending.current = null;
    try {
      waiting.element.setPointerCapture(waiting.pointerId);
    } catch {
      // Le pointeur a déjà été relâché : les écouteurs de la fenêtre suffisent.
    }
    window.getSelection()?.removeAllRanges();
    const source = waiting.element.closest<HTMLElement>("[data-drag-source]") ?? waiting.element;
    const box = source.getBoundingClientRect();
    update({
      item: waiting.item,
      x: point.x,
      y: point.y,
      grab: waiting.start,
      origin: { left: box.left, top: box.top, width: box.width, height: box.height },
      drop: still ? null : latest.current.locate(point, waiting.item),
      touch: waiting.touch,
    });
    latest.current.onStart?.(waiting.item);
  };

  const listen = (pointerId: number) => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const point = { x: event.clientX, y: event.clientY };
      const waiting = pending.current;
      if (waiting) {
        const far = Math.hypot(point.x - waiting.start.x, point.y - waiting.start.y);
        // Le doigt qui part avant la fin de l'appui long fait défiler la page : ce n'est pas un glisser.
        if (waiting.touch) {
          if (far > TOUCH_SLOP) release();
        } else if (far > MOUSE_SLOP) begin(waiting, point);
        return;
      }
      const current = live.current;
      if (!current) return;
      update({ ...current, x: point.x, y: point.y, drop: latest.current.locate(point, current.item) });
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const current = live.current;
      release();
      if (!current) return;
      endedAt.current = performance.now();
      update(null);
      latest.current.onEnd(current.item, current.drop, current);
    };
    const onLost = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      cancel();
    };
    // L'appui long ouvre aussi le menu du navigateur sur un lien : pas pendant un glisser.
    const onMenu = (event: Event) => {
      if (live.current || pending.current?.touch) event.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onLost);
    window.addEventListener("contextmenu", onMenu);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onLost);
      window.removeEventListener("contextmenu", onMenu);
    };
  };

  /** Les écouteurs à poser sur ce qui se saisit : la poignée, ou la carte entière. */
  const handle = (item: Item) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary || live.current || pending.current) return;
      const immediate = (latest.current.activation ?? "immediate") === "immediate";
      const touch = event.pointerType === "touch";
      if (!immediate && (event.target as HTMLElement).closest(INTERACTIVE)) return;
      const waiting: Pending<Item> = {
        item,
        pointerId: event.pointerId,
        element: event.currentTarget,
        start: { x: event.clientX, y: event.clientY },
        touch,
        timer: null,
      };
      pending.current = waiting;
      gesture.current = { stop: listen(event.pointerId) };
      if (immediate) {
        event.preventDefault();
        begin(waiting, waiting.start, true);
      } else if (touch) {
        waiting.timer = setTimeout(() => {
          if (pending.current !== waiting) return;
          navigator.vibrate?.(10);
          begin(waiting, waiting.start);
        }, HOLD_MS);
      }
    },
    // Le clic qui suit un glisser arrive sur la carte : il ne doit pas ouvrir son lien.
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (performance.now() - endedAt.current > CLICK_GUARD_MS) return;
      event.preventDefault();
      event.stopPropagation();
    },
  });

  return { drag, handle, cancel };
}
