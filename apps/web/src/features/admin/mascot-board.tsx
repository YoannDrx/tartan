import { SURFACES, type Surface } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { ATHLETE_IDS, ATHLETES, type AthleteId } from "@tartan/mascot/athletes";
import { CLIPS } from "@tartan/mascot/events";
import type { PoseName } from "@tartan/mascot/poses";
import { FACES } from "@tartan/mascot/rig";
import type { CSSProperties, ReactNode } from "react";
import { Athlete } from "@/components/athlete";
import { EventScene } from "@/components/event-scene";
import { LaneNumber } from "@/components/lane-number";
import { Sheet } from "@/components/sheet";
import { FinishLine, StartLine, TakeoffBoard, TrackBend, TrackLap, TrackLine } from "@/components/track";
import { Button } from "@/components/ui/button";
import { GesturePlayer } from "@/features/admin/gesture-player";

const { color, scene } = tokens;

// Ce qu'un fond impose à ce qu'on pose dessus : la couleur du texte, celle des lignes, celle du repère d'arrivée.
const ON: Record<Surface, { text: string; lane: string; mark: string }> = {
  piste: { text: scene.onPage, lane: scene.lane, mark: color.ink },
  ink: { text: scene.text, lane: scene.lane, mark: color.ink },
  chalk: { text: color.ink, lane: color.ink, mark: color.bg },
};
const surfaceStyle = (surface: Surface) =>
  ({
    backgroundColor: SURFACES[surface],
    color: ON[surface].text,
    "--color-lane": ON[surface].lane,
    "--track-mark": ON[surface].mark,
  }) as CSSProperties;
const SURFACE_NAMES = Object.keys(SURFACES) as Surface[];

const Section = ({ title, lead, children }: { title: string; lead: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="t-h2">{title}</h2>
      <p className="mt-1 max-w-prose">{lead}</p>
    </div>
    {children}
  </section>
);

// La liste de départ : un couloir par ligne, comme sur une feuille de concours.
const StartList = () => (
  <Sheet>
    <h3 className="sr-only">{m.admin.mascot.startList}</h3>
    <ol className="grid divide-y divide-card-line tablet:grid-cols-2 tablet:divide-y-0 desktop:grid-cols-3">
      {ATHLETE_IDS.map((id) => (
        <li key={id} className="flex items-center gap-3 px-4 py-2">
          <LaneNumber n={ATHLETES[id].bib} className="text-[32px] text-soft" />
          <span className="sr-only">{m.admin.mascot.lane(ATHLETES[id].bib)}</span>
          <Athlete id={id} on="ink" view="head" className="size-14 shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold">{m.group.athletes[id]}</span>
            <span className="t-caption block text-soft">
              {m.group.events[id]}, {m.admin.mascot.rubric(m.group.rubrics[id]).toLowerCase()}
            </span>
          </span>
        </li>
      ))}
    </ol>
  </Sheet>
);

// Les six athlètes alignés sur un fond : ce qui doit se lire, c'est chaque teint, chaque tenue, chaque dossard.
const LineUp = ({ surface }: { surface: Surface }) => (
  <figure className="overflow-hidden rounded-card" style={surfaceStyle(surface)}>
    <figcaption className="px-4 pt-3 font-semibold">{m.admin.mascot.surfaces[surface]}</figcaption>
    <div
      role="img"
      aria-label={m.admin.mascot.surfaceLabel(m.admin.mascot.surfaces[surface])}
      className="grid grid-cols-3 gap-y-2 px-4 py-3 tablet:grid-cols-6 tablet:px-8"
    >
      {ATHLETE_IDS.map((id) => (
        <Athlete key={id} id={id} on={surface} pose="lineup" view="standing" className="w-full" data-athlete={id} />
      ))}
    </div>
    <StartLine lanes={6} className="hidden tablet:block" />
  </figure>
);

const Faces = () => (
  <Sheet className="flex flex-col divide-y divide-card-line">
    {FACES.map((face) => (
      <div key={face} className="flex flex-col gap-1 px-4 py-3 tablet:flex-row tablet:items-center tablet:gap-4">
        <h3 className="t-caption text-soft tablet:w-24 tablet:shrink-0">{m.group.faces[face]}</h3>
        <div
          role="img"
          aria-label={m.admin.mascot.facesLabel(m.group.faces[face])}
          className="grid flex-1 grid-cols-6 gap-1"
        >
          {ATHLETE_IDS.map((id) => (
            <Athlete key={id} id={id} on="ink" view="head" face={face} className="w-full max-w-24" />
          ))}
        </div>
      </div>
    ))}
  </Sheet>
);

// Chaque pose fixe, portée par un athlète différent.
const POSES: Array<{ pose: PoseName; id: AthleteId }> = [
  { pose: "stand", id: "hurdles" },
  { pose: "lineup", id: "discus" },
  { pose: "run", id: "tripleJump" },
  { pose: "apex", id: "highJump" },
  { pose: "landing", id: "poleVault" },
  { pose: "cheer", id: "longJump" },
];
const Poses = () => (
  <Sheet>
    <ul className="grid grid-cols-2 gap-x-2 gap-y-3 p-4 tablet:grid-cols-3 desktop:grid-cols-6">
      {POSES.map(({ pose, id }) => (
        <li key={pose} className="flex flex-col items-center text-center">
          <Athlete
            id={id}
            pose={pose}
            on="ink"
            face={pose === "cheer" ? "joy" : "neutral"}
            className="w-full max-w-40"
          />
          <span className="font-semibold">{m.group.poses[pose]}</span>
          <span className="t-caption text-soft">{m.group.athletes[id]}</span>
        </li>
      ))}
    </ul>
  </Sheet>
);

// Une image par phase, cadrée sur l'athlète : le geste se relit sans le jouer.
const Frames = ({ id }: { id: AthleteId }) => {
  const clip = CLIPS[id];
  const name = m.group.athletes[id];
  const event = m.group.events[id];
  return (
    <div>
      <h4 className="t-caption text-soft">{m.admin.mascot.frames}</h4>
      <ol className="mt-2 grid grid-cols-3 gap-2 tablet:grid-cols-4 desktop:grid-cols-3">
        {clip.phases.map((phase, index) => {
          const label = m.group.phases[phase.name];
          return (
            <li key={index} className="flex flex-col gap-1">
              <EventScene
                id={id}
                t={(phase.from + phase.to) / 2}
                focus={300}
                role="img"
                aria-label={m.group.gesture(name, event, label)}
                className="w-full rounded-button"
              />
              <span aria-hidden className="t-caption text-soft">
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const Gestures = () => (
  <div className="flex flex-col gap-4">
    {ATHLETE_IDS.map((id) => (
      <Sheet key={id} className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <LaneNumber n={ATHLETES[id].bib} className="text-[32px] text-soft" />
          <h3 className="t-section">
            {m.group.events[id]}
            <span className="t-caption block font-normal text-soft">{m.group.athletes[id]}</span>
          </h3>
        </div>
        <div className="grid gap-4 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:items-start desktop:gap-6">
          <GesturePlayer id={id} />
          <Frames id={id} />
        </div>
      </Sheet>
    ))}
  </div>
);

const Motif = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2 px-4 py-4">
    <h4 className="t-caption">{name}</h4>
    {children}
  </div>
);

const LAPS = [0, 2, 4, 5];
const Motifs = ({ surface }: { surface: Surface }) => {
  const names = m.admin.mascot.motif;
  return (
    <div className="overflow-hidden rounded-card" style={surfaceStyle(surface)}>
      <h3 className="px-4 pt-3 font-semibold">{m.admin.mascot.surfaces[surface]}</h3>
      <div className="grid tablet:grid-cols-2">
        <Motif name={names.line}>
          <TrackLine trace />
        </Motif>
        <Motif name={names.numbers}>
          <p aria-hidden className="flex gap-4 text-[32px]">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((lane) => (
              <LaneNumber key={lane} n={lane} />
            ))}
          </p>
        </Motif>
        <Motif name={names.start}>
          <StartLine />
        </Motif>
        <Motif name={names.finish}>
          <FinishLine />
        </Motif>
        <Motif name={names.lap}>
          <div className="grid grid-cols-4 gap-3">
            {LAPS.map((done) => (
              <TrackLap key={done} value={done / 5} label={m.admin.mascot.lapLabel(done, 5)} className="w-full">
                <span aria-hidden className="t-num text-[15px]">
                  {m.admin.mascot.lapValue(done, 5)}
                </span>
              </TrackLap>
            ))}
          </div>
        </Motif>
        <Motif name={names.bend}>
          <div className="flex gap-6">
            <TrackBend corner="bottom-left" className="size-24" />
            <TrackBend corner="top-right" lanes={6} className="size-24" />
          </div>
        </Motif>
      </div>
    </div>
  );
};

// La planche de contrôle : tout ce que le groupe et la piste apportent, avant leur entrée dans les écrans.
export const MascotBoard = () => (
  <div className="flex flex-col gap-10">
    <p className="max-w-prose">{m.admin.mascot.lead}</p>
    <Section title={m.admin.mascot.group} lead={m.admin.mascot.groupLead}>
      <StartList />
      {SURFACE_NAMES.map((surface) => (
        <LineUp key={surface} surface={surface} />
      ))}
    </Section>
    <Section title={m.admin.mascot.faces} lead={m.admin.mascot.facesLead}>
      <Faces />
    </Section>
    <Section title={m.admin.mascot.poses} lead={m.admin.mascot.posesLead}>
      <Poses />
    </Section>
    <Section title={m.admin.mascot.gestures} lead={m.admin.mascot.gesturesLead}>
      <Gestures />
    </Section>
    <Section title={m.admin.mascot.motifs} lead={m.admin.mascot.motifsLead}>
      {SURFACE_NAMES.map((surface) => (
        <Motifs key={surface} surface={surface} />
      ))}
      <Sheet className="p-4">
        <h3 className="t-caption text-soft">{m.admin.mascot.motif.board}</h3>
        <TakeoffBoard className="mt-3 items-stretch tablet:max-w-sm">
          <Button>{m.admin.mascot.action}</Button>
        </TakeoffBoard>
      </Sheet>
    </Section>
  </div>
);
