// Les briques communes aux gestes d'exercice : les prises de barre, et un réglage qui pose un second appui au sol.
import { POSES } from "../poses";
import { jointPositions, type Anchor, type Pose, type View } from "../skeleton";

export type PosePatch = Partial<Pose>;

// Les deux bras ensemble ; le bras du fond suit le bras devant, à peine décalé pour qu'on le devine.
export const arms = (arm: number, elbow: number, spread = 4): PosePatch => ({
  armA: arm,
  elbowA: elbow,
  armB: arm - spread,
  elbowB: elbow,
});
export const legs = (leg: number, knee: number, spread = 4): PosePatch => ({
  legA: leg,
  kneeA: knee,
  legB: leg - spread,
  kneeB: knee,
});

// Les bras qui tombent à la verticale, quelle que soit l'inclinaison du buste : une barre tenue bras tendus.
export const hanging = (lean: number, rot = 0, elbow = 0): PosePatch => arms(lean + rot, elbow, 2);
// La barre sur les trapèzes : les coudes en arrière, les mains au ras des épaules.
export const backRack: PosePatch = arms(-100, 175, 2);
// La barre devant les épaules, les coudes hauts.
export const frontRack: PosePatch = arms(45, 125, 2);
// Les bras tendus au-dessus de la tête, la barre à l'aplomb de la nuque.
export const overhead = (lean: number): PosePatch => arms(176 + lean, 0, 2);

// Règle une valeur de la pose pour que l'appui `moving` arrive à `dy` sous l'appui `fixed` (positif : plus bas).
// `build` fabrique la pose pour une valeur donnée. Une bissection suffit : sur la plage, l'écart varie dans un seul sens.
export const settle = (
  build: (value: number) => PosePatch,
  range: readonly [number, number],
  fixed: Anchor,
  moving: Anchor,
  dy = 0,
  view: View = "side",
): PosePatch => {
  const gap = (value: number) => {
    const at = jointPositions({ ...POSES.stand, ...build(value) }, undefined, view);
    return at[moving].y - at[fixed].y - dy;
  };
  let [low, high] = range;
  const rising = gap(high) > gap(low);
  for (let i = 0; i < 48; i += 1) {
    const middle = (low + high) / 2;
    if (gap(middle) > 0 === rising) high = middle;
    else low = middle;
  }
  return build((low + high) / 2);
};
