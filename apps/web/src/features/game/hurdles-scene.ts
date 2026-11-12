import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import {
  APEX_TICK,
  FINISH_X,
  FLIGHT_TICKS,
  HURDLE_COUNT,
  HURDLE_HEIGHT_MM,
  hurdleX,
  isHurdleDown,
  jumpHeight,
  type HurdlesState,
} from "@tartan/game/events/hurdles";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { HURDLE_PX_PER_M, hurdlerHipAbove, hurdlerPose } from "@tartan/mascot/hurdles";

// Le dessin d'une image de la course : une fonction de l'état de la simulation, sans rien garder entre deux images.
// La caméra suit Inès, au tiers gauche ; la piste défile dessous.

const UNITS_PER_M = 1_200_000;
const PAINT = athletePaint("hurdles", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("hurdles", "neutral"),
  effort: athleteRig("hurdles", "effort"),
  joy: athleteRig("hurdles", "joy"),
};

export type SceneSize = { width: number; height: number };

// Combien de pixels pour un mètre : une dizaine de mètres à l'écran, quelle que soit la largeur.
export const pixelsPerMetre = ({ width }: SceneSize) => Math.min(70, Math.max(32, width / 10));

export const drawHurdles = (
  ctx: CanvasRenderingContext2D,
  size: SceneSize,
  state: HurdlesState,
  label: (metres: number) => string,
  // La famille de police lue sur la page : un canvas ne résout pas les variables CSS.
  family: string,
) => {
  const { width, height } = size;
  const ppm = pixelsPerMetre(size);
  const scale = ppm / HURDLE_PX_PER_M;
  // La première ligne du couloir est le sol : les pieds et les haies s'y posent.
  const lane = Math.round(height * 0.78);
  const ground = lane;
  const metres = state.x / UNITS_PER_M;
  const camera = metres - (width * 0.3) / ppm;
  const toX = (m: number) => (m - camera) * ppm;

  // La piste, et les deux lignes blanches du couloir.
  ctx.fillStyle = tokens.band.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = tokens.band.lane;
  ctx.fillRect(0, lane, width, 3);
  ctx.fillRect(0, lane + Math.round(ppm * 0.9), width, 3);

  // Les repères tous les dix mètres, comme les marques au bord de la piste.
  ctx.font = `600 ${Math.round(Math.max(12, ppm * 0.3))}px ${family}`;
  for (let mark = Math.ceil(camera / 10) * 10; mark < camera + width / ppm + 10; mark += 10) {
    if (mark <= 0 || mark >= 110) continue;
    const x = toX(mark);
    // Le repère court entre les deux lignes du couloir, sa distance écrite à côté.
    ctx.fillRect(x - 1, lane, 2, Math.round(ppm * 0.9));
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label(mark), x + 6, lane + Math.round(ppm * 0.45));
  }

  // L'arrivée : une large bande blanche.
  const finish = toX(FINISH_X / UNITS_PER_M);
  if (finish > -20 && finish < width + 20) ctx.fillRect(finish - 4, lane - 2, 8, Math.round(ppm * 0.9) + 5);

  // Les haies : la latte à 1,067 m, ses deux montants. Renversée, elle est couchée sur la piste.
  const barY = ground - (HURDLE_HEIGHT_MM / 1000) * ppm;
  for (let index = 0; index < HURDLE_COUNT; index += 1) {
    const x = toX(hurdleX(index) / UNITS_PER_M);
    if (x < -ppm || x > width + ppm) continue;
    const down = isHurdleDown(state.hurdles[index] ?? 0);
    ctx.strokeStyle = PROPS.post;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, ppm * 0.06);
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x - ppm * 0.1, ground - 2);
      ctx.lineTo(x + ppm * 0.9, ground - 2);
    } else {
      ctx.moveTo(x, ground);
      ctx.lineTo(x, barY);
      ctx.moveTo(x - ppm * 0.3, ground);
      ctx.lineTo(x, ground);
    }
    ctx.stroke();
    ctx.strokeStyle = PROPS.hurdle;
    ctx.lineWidth = Math.max(4, ppm * 0.12);
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x + ppm * 0.1, ground - ppm * 0.08);
      ctx.lineTo(x + ppm * 0.7, ground - ppm * 0.08);
    } else {
      ctx.moveTo(x - ppm * 0.08, barY);
      ctx.lineTo(x + ppm * 0.08, barY);
    }
    ctx.stroke();
  }

  // Inès : la foulée suit la distance parcourue, le saut suit le pas de vol de la simulation.
  const stage = metres * HURDLE_PX_PER_M;
  const flying = state.air > 0;
  const lift = flying ? (jumpHeight(state.air) / 1000) * ppm : 0;
  const face = state.finished ? "joy" : flying && Math.abs(state.air - APEX_TICK) < 6 ? "effort" : "neutral";
  const pose = hurdlerPose(stage, flying ? state.air / FLIGHT_TICKS : null);
  // Le pied le plus bas touche la piste ; en l'air, il est à la hauteur du saut que calcule la simulation.
  drawMascot(ctx, pose, {
    paint: PAINT,
    bones: BONES[face],
    at: { x: toX(metres), y: ground - hurdlerHipAbove(pose) * scale - lift },
    scale,
  });
};
