// Un geste : une suite de clés, chacune avec la transition qui y mène, jouée en boucle par un athlète du groupe.
// Une seule description sert au profil et à la face : le corps est résolu en trois dimensions, puis projeté.
// Aucun texte ici : les positions et les phases portent des identifiants, et les libellés affichés viennent du
// guide de la fiche au moment du rendu, comme pour le premier moteur.
import type { AthleteId } from "../athletes";
import type { Face } from "../rig";
import { FIGURE } from "./body";
import { STAND, type Controls, type ControlPatch } from "./pose";
import type { Prop } from "./props";
import { skin } from "./skin";
import { SIDES, solve, type Rig, type Side, type Solved } from "./solve";
import { timeline, type Curve } from "./timeline";

export type KeyDraft = {
  // L'identifiant de la position.
  id: string;
  // Ce qui change par rapport à la base du geste.
  set?: ControlPatch;
  // La durée de la tenue, en millisecondes. Absente : une traversée, le corps y passe sans s'arrêter.
  hold?: number;
  // La transition qui mène à cette clé : sa durée, sa courbe, et l'identifiant de la phase du geste qu'elle porte.
  // `cut` : pas de transition, la lecture reprend ici d'un coup (un geste qui finit ailleurs qu'il ne commence).
  move: { ms: number; curve: Curve; phase: string; cut?: boolean };
  face?: Face;
  // Les pieds en l'air à cette clé. Les autres sont en appui : ils ne bougent pas tant qu'ils le restent.
  air?: readonly Side[];
  // Une traversée qui mérite sa place dans la frise des positions. Une tenue y figure toujours.
  still?: boolean;
  // La ligne du guide de la fiche que cette position illustre : 0 pour l'installation, puis chaque étape.
  guide?: number;
};

export type GestureDraft = {
  key: string;
  athlete: AthleteId;
  rig: Rig;
  // La position de référence du geste, par rapport à la station debout.
  base?: ControlPatch;
  keys: readonly KeyDraft[];
  // Le matériel posé dans la scène ou tenu, à chaque image.
  props?: (t: number, body: Solved) => Prop[];
  // Le sol repousse le corps à chaque image : ce qui passerait dessous entre deux clés (un genou, un dos, la
  // pointe d'un pied libre) remonte de ce qui manque. Pour un geste relevé, dont les clés ne sont pas écrites
  // à la main ; un geste écrit n'en a pas besoin.
  floor?: boolean;
};

// Un tronçon de la boucle, de `from` à `to` (de 0 à 1) : une tenue ou une phase du geste.
export type Phase = {
  // L'identifiant de la position tenue, ou celui de la phase.
  id: string;
  from: number;
  to: number;
  hold: boolean;
  // La lecture saute ce tronçon : le geste ne boucle pas.
  cut: boolean;
  // La clé tenue, ou celle où mène la transition.
  key: number;
  // Les pieds en appui du début à la fin du tronçon.
  planted: readonly Side[];
};

export type MotionClip = {
  key: string;
  athlete: AthleteId;
  rig: Rig;
  // La durée d'une boucle à vitesse réelle, en millisecondes.
  duration: number;
  // Faux pour un geste qui finit ailleurs qu'il ne commence : la lecture repart du début d'un coup.
  loop: boolean;
  phases: readonly Phase[];
  // Une plage de temps par ligne du guide illustrée, dans l'ordre : la ligne (0 : l'installation), la plage,
  // et l'instant à montrer quand la lecture est arrêtée sur elle.
  positions: readonly { guide: number; from: number; to: number; still: number }[];
  // Les positions de la frise : l'instant à montrer, son identifiant, et la ligne du guide qu'elle illustre.
  stills: readonly { t: number; id: string; guide?: number }[];
  // Le corps à l'instant `t` de la boucle, de 0 à 1.
  pose(t: number): Solved;
  face(t: number): Face;
  props(t: number, body: Solved): Prop[];
};

// La position du guide où en est la lecture à l'instant `t` : son rang dans `clip.positions`.
export const guidePositionAt = (clip: Pick<MotionClip, "positions">, t: number) => {
  const time = t - Math.floor(t);
  const index = clip.positions.findIndex((position) => time >= position.from && time < position.to);
  return index < 0 ? clip.positions.length - 1 : index;
};

const FOOT_CHANNELS = ["X", "Z", "Lift", "Yaw", "Roll"] as const;

// Le corps posé sur le sol : un pied libre trop bas remonte, puis le bassin, si le tronc ou un membre s'enfonce.
// Un pied à plat au sol n'est pas touché, et reste en appui.
const floored = (controls: Controls, rig: Rig): Solved => {
  let body = solve(controls, rig);
  const lowest = (keep: (id: string) => boolean) =>
    Math.min(
      ...skin(body)
        .parts.filter((part) => keep(part.id))
        .flatMap((part) => part.spheres.map(({ c, r }) => c.y - r)),
    );
  let moved = false;
  for (const side of SIDES) {
    const low = lowest((id) => id === `shoe${side}`);
    if (low < -1e-6) {
      controls[`foot${side}Lift`] -= low;
      moved = true;
    }
  }
  if (moved) body = solve(controls, rig);
  // Deux passes : une main posée retient le coude, que le bassin ne remonte pas d'un seul coup.
  for (let pass = 0; pass < 2; pass += 1) {
    const sink = Math.min(
      lowest((id) => !id.startsWith("shoe") && !id.startsWith("plate") && !id.startsWith("bar")),
      body.head.y - FIGURE.head,
    );
    if (sink >= -1e-6) break;
    controls.pelvisY -= sink;
    if (rig.bar) controls.barY -= sink;
    body = solve(controls, rig);
  }
  return body;
};

export const gesture = (draft: GestureDraft): MotionClip => {
  // Chaque clé est d'abord résolue seule : le bassin et la barre y prennent la place que les contraintes leur
  // donnent, et c'est cette place qui s'interpole.
  const settled: Controls[] = draft.keys.map(
    (key) => solve({ ...STAND, ...draft.base, ...key.set }, draft.rig).controls,
  );
  const count = draft.keys.length;
  const grounded = (index: number, side: Side) => !draft.keys[index]!.air?.includes(side);

  const track = timeline<keyof Controls>(
    draft.keys.map((key, index) => ({ value: settled[index]!, hold: key.hold ?? 0, move: key.move })),
  );

  const phases: Phase[] = track.spans.map((span) => {
    const key = draft.keys[span.key]!;
    const before = (span.key - 1 + count) % count;
    const cut = span.kind === "move" && !!key.move.cut;
    const planted = cut
      ? []
      : SIDES.filter((side) => grounded(span.key, side) && (span.kind === "hold" || grounded(before, side)));
    // Un pied en appui est au même endroit aux deux bouts de la transition : sinon la description est fausse.
    if (span.kind === "move")
      for (const side of planted)
        for (const channel of FOOT_CHANNELS) {
          const name = `foot${side}${channel}` as const;
          if (Math.abs(settled[span.key]![name] - settled[before]![name]) > 1e-9)
            throw new Error(
              `${draft.key} : le pied ${side} est en appui mais se déplace vers « ${key.id} » (${name}).`,
            );
        }
    return {
      id: span.kind === "hold" ? key.id : key.move.phase,
      from: span.from / track.duration,
      to: span.to / track.duration,
      hold: span.kind === "hold",
      cut,
      key: span.key,
      planted,
    };
  });

  // L'instant où le corps est sur une clé : le milieu de sa tenue, ou la fin de la transition qui y mène.
  const instant = (index: number) => {
    const hold = phases.find((phase) => phase.hold && phase.key === index);
    if (hold) return (hold.from + hold.to) / 2;
    return phases.find((phase) => !phase.hold && phase.key === index)!.to % 1;
  };
  const stills = draft.keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => (key.hold ? key.still !== false : key.still || key.guide !== undefined))
    .map(({ key, index }) => ({
      t: instant(index),
      id: key.id,
      ...(key.guide !== undefined ? { guide: key.guide } : {}),
    }))
    .sort((a, b) => a.t - b.t);

  // Une ligne du guide commence quand le corps arrive sur la position qui l'illustre.
  const arrival = (index: number) => {
    const hold = phases.find((phase) => phase.hold && phase.key === index);
    return hold ? hold.from : phases.find((phase) => !phase.hold && phase.key === index)!.to % 1;
  };
  const lines = draft.keys
    .map((key, index) => ({ guide: key.guide, from: arrival(index), still: instant(index) }))
    .filter((line): line is { guide: number; from: number; still: number } => line.guide !== undefined)
    .sort((a, b) => a.guide - b.guide);
  const positions =
    lines.length === 0
      ? [{ guide: 0, from: 0, to: 1, still: 0 }]
      : // La première ligne court depuis le début de la boucle, la dernière jusqu'à sa fin.
        lines.map((line, index) => ({ ...line, from: index === 0 ? 0 : line.from, to: lines[index + 1]?.from ?? 1 }));

  return {
    key: draft.key,
    athlete: draft.athlete,
    rig: draft.rig,
    duration: track.duration,
    loop: !phases.some((phase) => phase.cut),
    phases,
    positions,
    stills,
    pose: draft.floor ? (t) => floored(track.sample(t), draft.rig) : (t) => solve(track.sample(t), draft.rig),
    face: (t) => draft.keys[track.spanAt(t).key]!.face ?? "neutral",
    props: draft.props ?? (() => []),
  };
};
