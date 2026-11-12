import type { GameEvent, SimState } from "@tartan/game";
import type { SceneSize } from "./hurdles-scene";

// Ce que le moteur de partie (game-runner.tsx) attend d'une épreuve : sa simulation, son dessin, son bandeau et ses
// résultats. Une épreuve ne connaît rien de la boucle, du clavier ni du stockage.
export type Item = { label: string; value: string };

export type EventUi<S extends SimState> = {
  id: string;
  sim: GameEvent<S>;
  // Clé du record gardé sur l'appareil.
  recordKey: string;
  // Le grand bouton du pouce.
  action: string;
  canvasLabel: string;
  draw: (ctx: CanvasRenderingContext2D, size: SceneSize, state: S, family: string) => void;
  hud: (state: S) => Item[];
  // La phrase annoncée à l'arrivée, et le détail de l'essai.
  headline: (state: S) => string;
  details: (state: S) => Item[];
  formatScore: (score: number) => string;
  // Un essai mordu (score nul) ne peut pas être un record.
  counts: (score: number) => boolean;
  // Le ralenti : la part du temps réel donnée à la simulation, 1 par défaut. Il ne change que l'affichage : le journal
  // des appuis est daté en pas de simulation, et le serveur rejoue la même partie.
  timeScale?: (state: S) => number;
};
