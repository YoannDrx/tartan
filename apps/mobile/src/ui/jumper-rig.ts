import { BODY, type JumperPose } from "@tartan/design-tokens";

const round = (value: number) => Math.round(value * 100) / 100;

// Le même squelette que le film du site (jump-film.tsx) : seule la position dans la scène en moins.
export const jumperTransforms = (p: JumperPose) => ({
  root: `rotate(${round(p.rot)}) scale(${round(p.flip * p.sx)} ${round(p.sy)})`,
  lean: `rotate(${round(p.lean)})`,
  head: `translate(0 ${-BODY.neck}) rotate(${round(p.head)})`,
  shoulder: `translate(0 ${-BODY.shoulder})`,
  armA: `rotate(${round(-p.armA)})`,
  elbowA: `translate(0 ${BODY.arm}) rotate(${round(-p.elbowA)})`,
  armB: `rotate(${round(-p.armB)})`,
  elbowB: `translate(0 ${BODY.arm}) rotate(${round(-p.elbowB)})`,
  legA: `rotate(${round(-p.legA)})`,
  kneeA: `translate(0 ${BODY.thigh}) rotate(${round(p.kneeA)})`,
  legB: `rotate(${round(-p.legB)})`,
  kneeB: `translate(0 ${BODY.thigh}) rotate(${round(p.kneeB)})`,
});
