// Une image d'un geste du premier moteur, en texte SVG : le matériel, l'athlète, puis ce qui passe devant lui.
// Même empilement que la scène du web (`ExerciseScene`), sans React, pour la comparaison de la planche.
import { athleteRig } from "../../src/athletes";
import type { ExerciseClip, GearPaint, GearShape } from "../../src/exercise";
import { svgProp } from "../../src/props";
import type { AthletePaint } from "../../src/skeleton";
import { svgAthlete, type SvgShape } from "../../src/svg";

const NAMES: Record<string, string> = { strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap" };

const element = ({ tag, ...attributes }: SvgShape) =>
  `<${tag} ${Object.entries(attributes)
    .map(([name, value]) => `${NAMES[name] ?? name}="${value}"`)
    .join(" ")}/>`;

export const v1SceneMarkup = (clip: ExerciseClip, t: number, paint: AthletePaint, gear: GearPaint): string => {
  const { pose, root } = clip.frame(t);
  const shapes = clip.gear(t);
  const draw = (list: GearShape[]) => list.map((shape) => element(svgProp(shape, gear[shape.paint]))).join("");
  const figure = svgAthlete(athleteRig(clip.athlete, clip.face(t), clip.facing), pose, paint, root);
  const body = figure.bones
    .map((bone) => `<g transform="${bone.transform}">${bone.shapes.map(element).join("")}</g>`)
    .join("");
  return (
    draw(shapes.filter((shape) => !shape.front)) +
    `<g transform="${figure.root}">${body}</g>` +
    draw(shapes.filter((shape) => shape.front))
  );
};

export const v1SceneSvg = (clip: ExerciseClip, t: number, paint: AthletePaint, gear: GearPaint): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${clip.view}">${v1SceneMarkup(clip, t, paint, gear)}</svg>`;
