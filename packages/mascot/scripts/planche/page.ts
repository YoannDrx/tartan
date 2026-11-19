// Le code des planches, côté navigateur : il anime les scènes que le script a posées dans la page.
// L'ancien moteur redessine sa scène à chaque image ; le nouveau passe par son lecteur, qui ne touche qu'aux
// attributs. Une scène ne s'anime que lorsqu'elle est à l'écran : une planche de famille en porte une centaine.
import type { GearPaint } from "../../src/exercise";
import { EXERCISE_CLIPS } from "../../src/exercises";
import type { AthletePaint } from "../../src/skeleton";
import { phaseAt } from "../../src/v2/constraints";
import type { ScenePaint } from "../../src/v2/draw-svg";
import { createMotionPlayer, svgSink, type MotionPlayer, type PlayerOptions } from "../../src/v2/player";
import type { GestureView } from "../../src/v2/project";
import { gestureEntry } from "../../src/v2/registry";
import { v1SceneMarkup } from "./v1-scene";

type PageData = {
  athletes: Record<string, AthletePaint>;
  gear: GearPaint;
  scene: Record<string, ScenePaint>;
  // Le libellé de chaque phase, pour les gestes dont la planche l'affiche.
  phases: Record<string, string>;
};
// Le paquet ne charge pas les types du navigateur : la page les prend tels qu'ils viennent.
declare const document: any;
declare const window: any;

const data: PageData = window.__PLANCHE__;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const button = document.querySelector("[data-toggle]");
const rates: any[] = [...document.querySelectorAll("[data-rate]")];

const state = { playing: !reduced.matches, rate: 1 };
type Scene = { svg: any; visible: boolean; player: MotionPlayer | null; options: PlayerOptions; time: number };
const scenes: Scene[] = [...document.querySelectorAll("svg[data-engine]")].map((svg: any) => ({
  svg,
  visible: false,
  player: null,
  options: { rate: 1 },
  time: 0,
}));

// Le lecteur d'une scène du nouveau moteur, créé quand elle arrive à l'écran : un geste relevé l'est à ce moment.
const playerOf = (scene: Scene): MotionPlayer => {
  if (scene.player) return scene.player;
  const { svg } = scene;
  const { clip } = gestureEntry(svg.dataset.key)!;
  const label = svg.closest("section")?.querySelector("[data-phase]");
  let shown = "";
  scene.options.rate = state.rate;
  if (label && svg.dataset.view === svg.closest("section").querySelector("svg[data-engine='v2']").dataset.view)
    // La phase en cours, écrite seulement quand elle change.
    scene.options.onFrame = (t) => {
      const { id } = phaseAt(clip, t);
      if (id !== shown) label.textContent = data.phases[(shown = id)] ?? "";
    };
  const sink = svgSink(document, svg.querySelector("g"), data.scene[clip.athlete]!);
  scene.player = createMotionPlayer(clip, svg.dataset.view as GestureView, sink, scene.options);
  return scene.player;
};

const drawOld = (scene: Scene) => {
  const clip = EXERCISE_CLIPS[scene.svg.dataset.key]!;
  scene.svg.innerHTML = v1SceneMarkup(clip, scene.time, data.athletes[clip.athlete]!, data.gear);
};

let last: number | null = null;
let looping = false;
const tick = (now: number) => {
  if (!state.playing) {
    looping = false;
    return;
  }
  const elapsed = last === null ? 0 : Math.min(100, now - last);
  last = now;
  for (const scene of scenes) {
    if (scene.svg.dataset.engine !== "v1" || !scene.visible) continue;
    scene.time = (scene.time + (state.rate * elapsed) / EXERCISE_CLIPS[scene.svg.dataset.key]!.duration) % 1;
    drawOld(scene);
  }
  window.requestAnimationFrame(tick);
};

const apply = () => {
  button.textContent = state.playing ? "Pause" : "Lecture";
  button.setAttribute("aria-pressed", String(state.playing));
  for (const scene of scenes) {
    if (scene.svg.dataset.engine === "v1") continue;
    scene.options.rate = state.rate;
    if (state.playing && scene.visible) playerOf(scene).play();
    else scene.player?.pause();
  }
  for (const input of rates) input.setAttribute("aria-pressed", String(Number(input.dataset.rate) === state.rate));
  if (state.playing && !looping) {
    looping = true;
    last = null;
    window.requestAnimationFrame(tick);
  }
};

button.addEventListener("click", () => {
  state.playing = !state.playing;
  apply();
});
for (const input of rates)
  input.addEventListener("click", () => {
    state.rate = Number(input.dataset.rate);
    apply();
  });
// Le mouvement réduit coupe la lecture : la page ne montre plus que les frises (voir la feuille de styles).
reduced.addEventListener("change", () => {
  state.playing = !reduced.matches;
  apply();
});

const watcher = new window.IntersectionObserver(
  (entries: any[]) => {
    for (const entry of entries) {
      const scene = scenes.find((candidate) => candidate.svg === entry.target)!;
      scene.visible = entry.isIntersecting;
      // Une scène qui arrive à l'écran montre tout de suite sa première image, même en pause.
      if (scene.visible && scene.svg.dataset.engine === "v1" && !scene.svg.firstChild) drawOld(scene);
      if (scene.visible && scene.svg.dataset.engine === "v2" && !reduced.matches) playerOf(scene);
    }
    apply();
  },
  { rootMargin: "200px" },
);
for (const scene of scenes) watcher.observe(scene.svg);
apply();
