// Le lecteur d'un geste, hors de React : à chaque image, il calcule les nœuds et les pose là où on le lui dit.
// Aucun rendu de composant pendant la lecture : sur le web, des attributs SVG mis à jour directement.
import { drawClip, propElement, shapeElement, type DrawNode, type DrawOptions, type ScenePaint } from "./draw-svg";
import type { MotionClip } from "./gesture";
import type { GestureView } from "./project";

// Là où une image se pose. Les nœuds arrivent du fond vers le devant.
export type MotionSink = { render(nodes: readonly DrawNode[]): void };

// L'horloge de l'hôte : `requestAnimationFrame` dans un navigateur, autre chose ailleurs (un test, le mobile).
export type Ticker = { request(callback: (now: number) => void): number; cancel(handle: number): void };

export type PlayerOptions = DrawOptions & {
  ticker?: Ticker;
  // La vitesse de lecture : 1 pour la vitesse réelle.
  rate?: number;
  // L'instant de départ dans la boucle, de 0 à 1.
  start?: number;
  // Appelée après chaque image posée, avec l'instant de la boucle.
  onFrame?: (t: number) => void;
};

export type MotionPlayer = {
  play(): void;
  pause(): void;
  // Montre l'instant `t` de la boucle, sans changer l'état de lecture.
  seek(t: number): void;
  readonly time: number;
  readonly playing: boolean;
  // Arrête la lecture pour de bon.
  dispose(): void;
};

type Animated = {
  requestAnimationFrame?: (callback: (now: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};
const hostTicker = (): Ticker => {
  const host = globalThis as Animated;
  if (!host.requestAnimationFrame || !host.cancelAnimationFrame)
    throw new Error("Aucune horloge d'animation : donner un `ticker` au lecteur.");
  return {
    request: (callback) => host.requestAnimationFrame!(callback),
    cancel: (handle) => host.cancelAnimationFrame!(handle),
  };
};

// Le lecteur pose tout de suite l'image de départ, puis attend `play()`.
export const createMotionPlayer = (
  clip: MotionClip,
  view: GestureView,
  sink: MotionSink,
  options: PlayerOptions = {},
): MotionPlayer => {
  let time = (((options.start ?? 0) % 1) + 1) % 1;
  let handle: number | null = null;
  let last: number | null = null;
  let ticker: Ticker | null = options.ticker ?? null;

  const show = () => {
    sink.render(drawClip(clip, time, view, options));
    options.onFrame?.(time);
  };
  const tick = (now: number) => {
    if (handle === null) return;
    // Un onglet resté en arrière-plan ne fait pas sauter le geste : au plus un dixième de seconde par image.
    const elapsed = last === null ? 0 : Math.min(100, Math.max(0, now - last));
    last = now;
    time = (time + ((options.rate ?? 1) * elapsed) / clip.duration) % 1;
    show();
    handle = ticker!.request(tick);
  };

  show();
  return {
    play() {
      if (handle !== null) return;
      ticker ??= hostTicker();
      last = null;
      handle = ticker.request(tick);
    },
    pause() {
      if (handle === null) return;
      ticker!.cancel(handle);
      handle = null;
    },
    seek(t) {
      time = ((t % 1) + 1) % 1;
      show();
    },
    get time() {
      return time;
    },
    get playing() {
      return handle !== null;
    },
    dispose() {
      this.pause();
    },
  };
};

// Ce qu'il faut d'un document et d'un élément SVG pour y poser un geste : le navigateur les fournit tels quels.
// `E` : le type d'élément de l'hôte (un `Element` du DOM, un faux élément dans un test).
export type SvgElementLike<E> = {
  setAttribute(name: string, value: string): void;
  appendChild(child: E): unknown;
  replaceChildren(...children: E[]): void;
};
export type SvgDocumentLike<E> = { createElementNS(namespace: string, tag: string): E };

const SVG = "http://www.w3.org/2000/svg";

// Pose un geste dans un groupe SVG. Les éléments sont créés une fois ; ensuite seuls changent le tracé d'un aplat,
// le placement de la tête ou du dossard, la forme d'un accessoire, et l'ordre d'empilement quand un membre passe
// devant un autre. Un élément absent d'une image (un repère sorti du cadre) est masqué, pas détruit.
export const svgSink = <E extends SvgElementLike<E>>(
  document: SvgDocumentLike<E>,
  parent: E,
  paint: ScenePaint,
): MotionSink => {
  type Entry = { element: E; value: string; content: string; shown: boolean; seen: number };
  const elements = new Map<string, Entry>();
  let order = "";
  let frame = 0;
  return {
    render(nodes) {
      frame += 1;
      for (const node of nodes) {
        let entry = elements.get(node.id);
        if (!entry) {
          const tag = node.kind === "path" ? "path" : node.kind === "group" ? "g" : propElement(node.geometry, "").tag;
          const element = document.createElementNS(SVG, tag);
          if (node.kind === "path") element.setAttribute("fill", paint[node.paint]);
          entry = { element, value: "", content: "", shown: true, seen: 0 };
          elements.set(node.id, entry);
        }
        entry.seen = frame;
        if (!entry.shown) {
          entry.shown = true;
          entry.element.setAttribute("visibility", "visible");
        }
        if (node.kind === "path") {
          if (entry.value !== node.d) entry.element.setAttribute("d", (entry.value = node.d));
          continue;
        }
        if (node.kind === "prop") {
          const { attributes } = propElement(node.geometry, paint[node.paint]);
          const value = JSON.stringify(attributes);
          if (entry.value !== value) {
            entry.value = value;
            for (const [name, text] of Object.entries(attributes)) entry.element.setAttribute(name, text);
          }
          continue;
        }
        if (entry.content !== node.content) {
          entry.content = node.content;
          entry.element.replaceChildren(
            ...node.shapes.map((shape) => {
              const { tag, attributes } = shapeElement(shape, paint);
              const child = document.createElementNS(SVG, tag);
              for (const [name, value] of Object.entries(attributes)) child.setAttribute(name, value);
              return child;
            }),
          );
        }
        if (entry.value !== node.transform) entry.element.setAttribute("transform", (entry.value = node.transform));
      }
      for (const entry of elements.values())
        if (entry.shown && entry.seen !== frame) {
          entry.shown = false;
          entry.element.setAttribute("visibility", "hidden");
        }
      const wanted = nodes.map((node) => node.id).join(" ");
      if (wanted !== order) {
        order = wanted;
        for (const node of nodes) parent.appendChild(elements.get(node.id)!.element);
      }
    },
  };
};
