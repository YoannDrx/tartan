// Un geste : une suite de clés, chacune avec la transition qui y mène, jouée en boucle par un athlète du groupe.
// Une seule description sert au profil et à la face : le corps est résolu en trois dimensions, puis projeté.
import type { AthleteId } from "../athletes";
import type { Face } from "../rig";
import { STAND, type Controls, type ControlPatch } from "./pose";
import { SIDES, solve, type Rig, type Side, type Solved } from "./solve";
import { timeline, type Curve } from "./timeline";

export type KeyDraft = {
  // Le nom de la position, tel qu'il s'affiche sous la frise. Un libellé de travail, pour la planche du prototype :
  // à la généralisation, les noms des positions et des phases rejoignent @tartan/i18n, comme tous les textes.
  name: string;
  // Ce qui change par rapport à la base du geste.
  set?: ControlPatch;
  // La durée de la tenue, en millisecondes. Absente : une traversée, le corps y passe sans s'arrêter.
  hold?: number;
  // La transition qui mène à cette clé : sa durée, sa courbe, et la phase du geste qu'elle porte.
  move: { ms: number; curve: Curve; phase: string };
  face?: Face;
  // Les pieds en l'air à cette clé. Les autres sont en appui : ils ne bougent pas tant qu'ils le restent.
  air?: readonly Side[];
  // Une traversée qui mérite sa place dans la frise des positions. Une tenue y figure toujours.
  still?: boolean;
};

export type GestureDraft = {
  key: string;
  athlete: AthleteId;
  rig: Rig;
  // La position de référence du geste, par rapport à la station debout.
  base?: ControlPatch;
  keys: readonly KeyDraft[];
};

// Un tronçon de la boucle, de `from` à `to` (de 0 à 1) : une tenue ou une phase du geste.
export type Phase = {
  name: string;
  from: number;
  to: number;
  hold: boolean;
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
  phases: readonly Phase[];
  // Les positions de la frise : l'instant à montrer, et son nom.
  stills: readonly { t: number; name: string }[];
  // Le corps à l'instant `t` de la boucle, de 0 à 1.
  pose(t: number): Solved;
  face(t: number): Face;
};

const FOOT_CHANNELS = ["X", "Z", "Yaw"] as const;

export const gesture = (draft: GestureDraft): MotionClip => {
  // Chaque clé est d'abord résolue seule : le bassin et la barre y prennent la place que les contraintes leur
  // donnent, et c'est cette place qui s'interpole.
  const settled: Controls[] = draft.keys.map(
    (key) => solve({ ...STAND, ...draft.base, ...key.set }, draft.rig).controls,
  );
  const grounded = (index: number, side: Side) => !draft.keys[index]!.air?.includes(side);

  const track = timeline<keyof Controls>(
    draft.keys.map((key, index) => ({ value: settled[index]!, hold: key.hold ?? 0, move: key.move })),
  );

  const phases: Phase[] = track.spans.map((span) => {
    const key = draft.keys[span.key]!;
    const before = (span.key - 1 + draft.keys.length) % draft.keys.length;
    const planted = SIDES.filter(
      (side) => grounded(span.key, side) && (span.kind === "hold" || grounded(before, side)),
    );
    // Un pied en appui est au même endroit aux deux bouts de la transition : sinon la description est fausse.
    if (span.kind === "move")
      for (const side of planted)
        for (const channel of FOOT_CHANNELS) {
          const name = `foot${side}${channel}` as const;
          if (Math.abs(settled[span.key]![name] - settled[before]![name]) > 1e-9)
            throw new Error(
              `${draft.key} : le pied ${side} est en appui mais se déplace vers « ${key.name} » (${name}).`,
            );
        }
    return {
      name: span.kind === "hold" ? key.name : key.move.phase,
      from: span.from / track.duration,
      to: span.to / track.duration,
      hold: span.kind === "hold",
      key: span.key,
      planted,
    };
  });
  for (const [index, key] of draft.keys.entries())
    for (const side of SIDES)
      if (grounded(index, side) && settled[index]![`foot${side}Lift`] !== 0)
        throw new Error(`${draft.key} : à « ${key.name} », le pied ${side} est en appui mais décollé du sol.`);

  const stills = phases
    .filter((phase) => (phase.hold ? draft.keys[phase.key]!.still !== false : draft.keys[phase.key]!.still))
    // Une traversée se montre à l'instant où le corps y passe : la fin de la transition qui y mène.
    .map((phase) => ({
      t: phase.hold ? (phase.from + phase.to) / 2 : phase.to % 1,
      name: draft.keys[phase.key]!.name,
    }));

  return {
    key: draft.key,
    athlete: draft.athlete,
    rig: draft.rig,
    duration: track.duration,
    phases,
    stills,
    pose: (t) => solve(track.sample(t), draft.rig),
    face: (t) => draft.keys[track.spanAt(t).key]!.face ?? "neutral",
  };
};
