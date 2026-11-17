// Le code de la planche, côté navigateur : il anime les scènes que le script a posées dans la page.
// L'ancien moteur redessine sa scène à chaque image ; le nouveau passe par son lecteur, qui ne touche qu'aux attributs.
import type { GearPaint } from "../../src/exercise";
import { EXERCISE_CLIPS } from "../../src/exercises";
import type { AthletePaint } from "../../src/skeleton";
import { phaseAt } from "../../src/v2/constraints";
import type { ScenePaint } from "../../src/v2/draw-svg";
import { GESTURES } from "../../src/v2/gestures";
import { createMotionPlayer, svgSink, type MotionPlayer, type PlayerOptions } from "../../src/v2/player";
import type { GestureView } from "../../src/v2/project";
import { v1SceneMarkup } from "./v1-scene";

type PageData = { athletes: Record<string, AthletePaint>; gear: GearPaint; scene: Record<string, ScenePaint> };
// Le paquet ne charge pas les types du navigateur : la page les prend tels qu'ils viennent.
declare const document: any;
declare const window: any;

const data: PageData = window.__PLANCHE__;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const button = document.querySelector("[data-toggle]");
const rates: any[] = [...document.querySelectorAll("[data-rate]")];

const state = { playing: !reduced.matches, rate: 1 };
const players: { player: MotionPlayer; options: PlayerOptions }[] = [];
const olds: { svg: any; key: string; time: number }[] = [];

for (const svg of document.querySelectorAll("svg[data-engine='v2']")) {
  const clip = GESTURES[svg.dataset.key]!;
  const label = svg.closest("section").querySelector("[data-phase]");
  let shown = "";
  const options: PlayerOptions = {
    rate: state.rate,
    // La phase en cours, écrite seulement quand elle change.
    onFrame:
      svg.dataset.view === "side"
        ? (t) => {
            const { name } = phaseAt(clip, t);
            if (name !== shown) label.textContent = shown = name;
          }
        : undefined,
  };
  const sink = svgSink(document, svg.querySelector("g"), data.scene[clip.athlete]!);
  players.push({ player: createMotionPlayer(clip, svg.dataset.view as GestureView, sink, options), options });
}
for (const svg of document.querySelectorAll("svg[data-engine='v1']")) olds.push({ svg, key: svg.dataset.key, time: 0 });

const drawOld = (old: (typeof olds)[number]) => {
  const clip = EXERCISE_CLIPS[old.key]!;
  old.svg.innerHTML = v1SceneMarkup(clip, old.time, data.athletes[clip.athlete]!, data.gear);
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
  for (const old of olds) {
    old.time = (old.time + (state.rate * elapsed) / EXERCISE_CLIPS[old.key]!.duration) % 1;
    drawOld(old);
  }
  window.requestAnimationFrame(tick);
};

const apply = () => {
  button.textContent = state.playing ? "Pause" : "Lecture";
  button.setAttribute("aria-pressed", String(state.playing));
  for (const { player, options } of players) {
    options.rate = state.rate;
    if (state.playing) player.play();
    else player.pause();
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

olds.forEach(drawOld);
apply();
