"use client";

import { athletePaint } from "@tartan/design-tokens/athletes";
import { m } from "@tartan/i18n";
import { athleteRig, type AthleteId } from "@tartan/mascot/athletes";
import { smooth } from "@tartan/mascot/clip";
import { svgProp, type PropPaint, type PropShape } from "@tartan/mascot/props";
import { FACES, type Face } from "@tartan/mascot/rig";
import type { AthletePaint, Bone, BoneId } from "@tartan/mascot/skeleton";
import { boneTransform, rootTransform, svgAthlete, svgShape } from "@tartan/mascot/svg";
import { Check } from "lucide-react";
import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  BAR,
  barWobble,
  BEAT_AT,
  CONFETTI,
  confettiAt,
  FILM,
  FILM_STILL,
  frameAt,
  GROUND,
  highJumpTime,
  IMPACT,
  MAT_TOP,
  sceneProps,
  SCENES,
  T,
  TRAIL_LENGTH,
  TRAIL_PATH,
  trailAt,
  WORLD_AT,
  WORLD_SURFACE,
  type FilmWorld,
  type SceneId,
} from "./jump-film-pose";

const f = m.landing.film;
const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;
// Hauteur occupée par le titre et sa remarque, et hauteur du saut au-dessus du bas de la scène.
const TEXT_ROOM = 290;
const ACTION_HEIGHT = 860;

// La frise : une promesse par athlète, puis la validation.
const PHASES = [
  { key: "programme", from: FILM.hurdles, to: FILM.poleVault },
  { key: "travail", from: FILM.poleVault, to: FILM.highJump },
  { key: "geste", from: FILM.highJump, to: FILM.impact },
  { key: "valide", from: FILM.impact, to: FILM.finish },
] as const;
// Jusqu'où le cadre suit un coureur sur un écran étroit : la largeur d'une scène, et un peu de marge.
const SCENE_REACH = 1460;
// La piste sous le coureur des deux premières scènes : une ligne au sol, qui se trace avec lui.
const GROUND_TRAIL = `M -60 ${GROUND + 6} H 1700`;

const round = (value: number) => Math.round(value * 100) / 100;

// Chaque athlète porte ses couleurs dans des variables : elles changent avec le monde traversé, sans rendu React.
const PAINT_ROLES = ["skin", "tee", "shorts", "shoe", "hair", "eye", "bib", "mark"] as const;
const VARS = Object.fromEntries(PAINT_ROLES.map((role) => [role, `var(--a-${role})`])) as AthletePaint;
const paintVars = (id: AthleteId, world: FilmWorld) => {
  const paint = athletePaint(id, WORLD_SURFACE[world]);
  return PAINT_ROLES.map((role) => [`--a-${role}`, paint[role]] as const);
};

// Les accessoires prennent les couleurs du film, qui suivent elles aussi le monde traversé (globals.css).
const PROP: PropPaint = {
  lane: "var(--film-line)",
  bar: "var(--film-bar)",
  post: "var(--film-post)",
  mat: "var(--color-film-mat-blue)",
  matTop: "var(--color-film-mat-red)",
  sand: "var(--color-film-sun-light)",
  board: "var(--film-line)",
  foul: "var(--film-mark)",
  pole: "var(--film-mark)",
  hurdle: "var(--film-line)",
  discus: "var(--film-mark)",
};
const Props = ({ shapes }: { shapes: PropShape[] }) =>
  shapes.map((shape, index) => {
    const { tag, ...attributes } = svgProp(shape, PROP[shape.paint]);
    return createElement(tag, { key: index, ...attributes });
  });
// Ce qui ne bouge pas dans chaque scène. La perche, elle, se redessine à chaque image.
const HURDLES_PROPS = sceneProps("hurdles", FILM.hurdles);
const VAULT_PROPS = sceneProps("poleVault", FILM.poleVault).filter((shape) => shape.kind !== "curve");
const poleOf = (time: number) => {
  const pole = sceneProps("poleVault", time).find((shape) => shape.kind === "curve");
  const path = pole ? svgProp(pole, PROP.pole) : null;
  return path?.tag === "path" ? path.d : "";
};

const START = frameAt(0);
const bonesOf = (id: AthleteId) => athleteRig(id, "neutral");
const among = (bones: readonly Bone[]) => new Map<BoneId, Bone>(bones.map((bone) => [bone.id, bone]));

// Un athlète du relais : son corps au départ de sa scène, et ses trois visages, dont un seul est montré.
const FilmAthlete = ({ id, shown }: { id: AthleteId; shown: boolean }) => {
  const figure = svgAthlete(bonesOf(id), START.pose, VARS, START.pose);
  const faces = Object.fromEntries(
    FACES.map((face) => [face, athleteRig(id, face).find((bone) => bone.id === "eyes")!.shapes]),
  ) as Record<Face, Bone["shapes"]>;
  return (
    <g
      data-film-athlete={id}
      transform={figure.root}
      display={shown ? undefined : "none"}
      style={Object.fromEntries(paintVars(id, "piste")) as CSSProperties}
    >
      {figure.bones.map((bone) => (
        <g key={bone.id} data-bone={bone.id} transform={bone.transform}>
          {bone.id === "eyes"
            ? FACES.map((face) => (
                <g key={face} data-face={face} className="film-eyes" display={face === START.face ? undefined : "none"}>
                  {faces[face].map((shape, index) => {
                    const { tag, ...attributes } = svgShape(shape, VARS[shape.paint]);
                    return createElement(tag, { key: index, ...attributes });
                  })}
                </g>
              ))
            : bone.shapes.map(({ tag, ...attributes }, index) => createElement(tag, { key: index, ...attributes }))}
        </g>
      ))}
    </g>
  );
};

// Un titre dont les mots rebondissent l'un après l'autre, avec un mot surligné au marqueur.
const Words = ({ text, mark }: { text: string; mark: string }) => {
  const [before = "", after = ""] = text.split(mark);
  const words = (value: string) => value.split(/(\s+)/).filter(Boolean);
  let index = 0;
  const word = (value: string, key: string) =>
    /^\s+$/.test(value) ? (
      value
    ) : (
      <span key={key} className="film-word" style={{ "--i": index++ } as React.CSSProperties}>
        {value}
      </span>
    );
  // La ponctuation qui suit le marqueur reste collée à lui : un lecteur d'écran lirait sinon « groupe . ».
  const [next = "", ...rest] = words(after);
  const glued = /^\s/.test(next) ? "" : next;
  return (
    <>
      {words(before).map((value, i) => word(value, `b${i}`))}
      <span className="film-word" style={{ "--i": index++ } as React.CSSProperties}>
        <span className="film-swipe">{mark}</span>
        {glued}
      </span>
      {(glued ? rest : words(after)).map((value, i) => word(value, `a${i}`))}
    </>
  );
};

const Note = ({ title, body }: { title: string; body: string }) => (
  <p className="film-note">
    <strong className="block font-semibold">{title}</strong>
    {body}
  </p>
);

export const JumpFilm = ({ header, cta, offer }: { header: ReactNode; cta: ReactNode; offer: ReactNode }) => {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>(".film-stage");
    const svg = root?.querySelector<SVGSVGElement>(".film-scene");
    if (!root || !stage || !svg) return;

    // Les éléments animés sont repérés au montage : le rendu React ne les touche plus ensuite.
    const find = <E extends Element>(name: string) => root.querySelector<E>(`[data-film="${name}"]`);
    const athletes = Object.fromEntries(
      SCENES.map(({ id, athlete }) => {
        const node = root.querySelector<SVGGElement>(`[data-film-athlete="${athlete}"]`);
        const bones = bonesOf(athlete);
        return [
          id,
          {
            id: athlete,
            node,
            among: among(bones),
            bones: bones.map((bone) => ({
              bone,
              node: node?.querySelector<SVGGElement>(`[data-bone="${bone.id}"]`) ?? null,
            })),
            faces: Array.from(node?.querySelectorAll<SVGGElement>("[data-face]") ?? []),
          },
        ];
      }),
    ) as Record<
      SceneId,
      {
        id: AthleteId;
        node: SVGGElement | null;
        among: Map<BoneId, Bone>;
        bones: Array<{ bone: Bone; node: SVGGElement | null }>;
        faces: SVGGElement[];
      }
    >;
    const sets = Array.from(root.querySelectorAll<SVGGElement>("[data-scene]"));
    const pole = find<SVGPathElement>("pole");
    const trail = find<SVGPathElement>("trail");
    const bar = find<SVGGElement>("bar");
    const stripes = find<SVGGElement>("stripes");
    const ring = find<SVGCircleElement>("ring");
    const bloom = find<SVGCircleElement>("bloom");
    const cursor = find<HTMLElement>("cursor");
    const confetti = Array.from(root.querySelectorAll<SVGGElement>("[data-confetti]"));
    const beats = Array.from(root.querySelectorAll<HTMLElement>(".film-beat"));

    let lastScene: SceneId | "" = "";
    let lastFace = "";
    let lastBeat = -1;
    let lastWorld = "";
    let viewWidth = STAGE_WIDTH;
    let viewHeight = STAGE_HEIGHT;

    // Scène fixe sur grand écran. Sur un écran étroit, le cadre suit le coureur et le ciel s'agrandit.
    const frameView = (x: number) => {
      const left = viewWidth >= STAGE_WIDTH ? 0 : Math.min(Math.max(x - viewWidth * 0.36, 0), SCENE_REACH - viewWidth);
      svg.setAttribute(
        "viewBox",
        `${round(left)} ${round(STAGE_HEIGHT - viewHeight)} ${round(viewWidth)} ${round(viewHeight)}`,
      );
    };

    const measure = () => {
      const aspect = svg.clientWidth / Math.max(svg.clientHeight, 1);
      viewWidth = aspect >= 1.5 ? STAGE_WIDTH : Math.max(720, (STAGE_WIDTH * aspect) / 1.5);
      // Écran étroit et court : on recule pour que le saut reste dégagé sous le titre et la remarque.
      if (aspect < 1) {
        const room = Math.max(svg.clientHeight - TEXT_ROOM, 1);
        viewWidth = Math.min(STAGE_WIDTH, Math.max(viewWidth, (svg.clientWidth * ACTION_HEIGHT) / room));
      }
      viewHeight = viewWidth / aspect;
    };

    const show = (node: Element | null | undefined, on: boolean) =>
      node?.setAttribute("display", on ? "inline" : "none");

    const render = (time: number) => {
      const { scene, pose, face, running } = frameAt(time);
      const athlete = athletes[scene];
      const world = WORLD_AT(time);

      // Le passage de relais : un athlète quitte la scène, le suivant y entre avec son décor.
      if (scene !== lastScene) {
        for (const id of Object.keys(athletes) as SceneId[]) show(athletes[id].node, id === scene);
        for (const set of sets) show(set, set.dataset.scene === scene);
        trail?.setAttribute("d", scene === "highJump" ? TRAIL_PATH : GROUND_TRAIL);
        lastScene = scene;
        lastFace = "";
        lastWorld = "";
      }
      if (face !== lastFace) {
        for (const node of athlete.faces) show(node, node.dataset.face === face);
        lastFace = face;
      }
      if (world !== lastWorld) {
        root.dataset.world = world;
        for (const [name, value] of paintVars(athlete.id, world)) athlete.node?.style.setProperty(name, value);
        lastWorld = world;
      }

      // La pose du film porte aussi la position du bassin : elle place le corps, puis l'oriente.
      athlete.node?.setAttribute("transform", rootTransform(pose, pose));
      for (const { bone, node } of athlete.bones) {
        node?.setAttribute("transform", boneTransform(bone, pose, athlete.among));
      }
      frameView(pose.x);
      if (scene === "poleVault") pole?.setAttribute("d", poleOf(time));

      // Le saut en hauteur garde ses propres seuils : ses effets se règlent sur sa durée à lui.
      const jump = scene === "highJump" ? highJumpTime(time) : -1;
      const ground = scene === "highJump" ? trailAt(jump) : time < FILM.hurdles ? 0 : pose.x + 60;
      trail?.setAttribute("stroke-dasharray", `${round(ground)} ${TRAIL_LENGTH + 2000}`);
      bar?.setAttribute("transform", `rotate(${round(jump < 0 ? 0 : barWobble(jump))} ${BAR.farX} ${BAR.farY})`);

      show(stripes, running);
      if (running) {
        const stretch = scene === "highJump" ? 0.5 + smooth(T.run, T.runEnd, jump) : 1.2;
        stripes?.setAttribute(
          "transform",
          `translate(${round(pose.x - 74)} ${round(pose.y)}) scale(${round(stretch)} 1)`,
        );
      }

      if (ring) {
        const on = jump > T.plant - 0.008 && jump < T.plant + 0.05;
        show(ring, on);
        if (on) ring.setAttribute("r", String(round(16 + 240 * smooth(T.plant - 0.008, T.plant + 0.05, jump))));
      }

      if (bloom) {
        const on = jump >= T.impact && jump < T.finish;
        show(bloom, on);
        if (on) {
          const u = Math.min((jump - T.impact) / (T.filled - T.impact), 1);
          bloom.setAttribute("r", String(round(2600 * (1 - (1 - u) ** 3))));
        }
      }

      const flying = jump >= T.impact && jump < T.finish;
      confetti.forEach((element, index) => {
        const piece = CONFETTI[index];
        if (!element || !piece) return;
        show(element, flying);
        if (!flying) return;
        const c = confettiAt(piece, jump);
        element.setAttribute("transform", `translate(${round(c.x)} ${round(c.y)}) rotate(${round(c.rot)})`);
      });

      const beatNow = BEAT_AT(time);
      if (beatNow !== lastBeat) {
        root.dataset.beat = String(beatNow);
        beats.forEach((element, index) => element?.classList.toggle("is-active", index === beatNow));
        lastBeat = beatNow;
      }

      const progress = Math.min(Math.max((time - FILM.hurdles) / (FILM.finish - FILM.hurdles), 0), 1);
      cursor?.style.setProperty("left", `${round(progress * 100)}%`);
    };

    let current = 0;
    const resize = new ResizeObserver(() => {
      measure();
      render(current);
    });

    // Animations réduites ou écran trop bas pour le film : une image fixe, l'athlète au-dessus de la barre,
    // sur le rouge de la piste.
    if (matchMedia("(prefers-reduced-motion: reduce), (max-height: 559px)").matches) {
      measure();
      render(FILM_STILL);
      root.dataset.world = "piste";
      const still = athletes.highJump;
      for (const [name, value] of paintVars(still.id, "piste")) still.node?.style.setProperty(name, value);
      return;
    }

    let target = 0;
    let frameId = 0;
    const read = () => {
      const box = root.getBoundingClientRect();
      const travel = box.height - window.innerHeight;
      target = travel > 0 ? Math.min(Math.max(-box.top / travel, 0), 1) : 0;
    };
    const tick = () => {
      read();
      const gap = target - current;
      if (Math.abs(gap) > 0.00015) {
        current += gap * 0.18;
        render(current);
      }
      frameId = requestAnimationFrame(tick);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frameId);
      if (entry?.isIntersecting) frameId = requestAnimationFrame(tick);
    });

    measure();
    read();
    current = target;
    render(current);
    resize.observe(stage);
    visibility.observe(root);
    return () => {
      cancelAnimationFrame(frameId);
      resize.disconnect();
      visibility.disconnect();
    };
  }, []);

  return (
    <section ref={rootRef} className="film" data-world="piste" data-beat="0">
      <div className="film-stage">
        <svg
          aria-hidden
          className="film-scene"
          viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
          preserveAspectRatio="xMidYMax slice"
        >
          <circle className="film-disc" cx="950" cy="190" r="340" />

          <rect x="-400" y={GROUND} width="2600" height="400" fill="var(--film-track)" />
          <path
            d={`M -400 ${GROUND + 44} H 2200 M -400 ${GROUND + 104} H 2200`}
            stroke="var(--color-lane)"
            strokeWidth="5"
          />

          <g data-scene="hurdles">
            <Props shapes={HURDLES_PROPS} />
          </g>
          <g data-scene="poleVault" display="none">
            <Props shapes={VAULT_PROPS.filter((shape) => !shape.front)} />
            <path
              data-film="pole"
              d={poleOf(FILM.poleVault)}
              fill="none"
              stroke={PROP.pole}
              strokeWidth="9"
              strokeLinecap="round"
            />
          </g>
          <g data-scene="highJump" display="none">
            <line
              x1={BAR.farX}
              y1={MAT_TOP + 10}
              x2={BAR.farX}
              y2={BAR.farY - 22}
              stroke="var(--film-post)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <polygon
              points={`800,${MAT_TOP + 38} 836,${MAT_TOP} 1800,${MAT_TOP} 1800,${MAT_TOP + 38}`}
              fill="var(--color-film-mat-red)"
            />
            <line x1="836" y1={MAT_TOP + 2} x2="1800" y2={MAT_TOP + 2} stroke="var(--color-lane)" strokeWidth="5" />
            <rect x="800" y={MAT_TOP + 38} width="1000" height="172" fill="var(--color-film-mat-blue)" />
          </g>

          <path
            data-film="trail"
            d={GROUND_TRAIL}
            fill="none"
            stroke="var(--film-line)"
            strokeWidth="7"
            strokeDasharray={`0 ${TRAIL_LENGTH + 2000}`}
          />
          <circle
            data-film="ring"
            display="none"
            cx="690"
            cy={GROUND}
            fill="none"
            stroke="var(--film-line)"
            strokeWidth="8"
          />

          <g data-scene="highJump" display="none">
            <g data-film="bar">
              <line
                x1={BAR.farX}
                y1={BAR.farY}
                x2={BAR.nearX}
                y2={BAR.nearY}
                stroke="var(--film-bar)"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </g>
            <line
              x1={BAR.nearX}
              y1={GROUND + 72}
              x2={BAR.nearX}
              y2={BAR.nearY - 28}
              stroke="var(--film-post)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <rect x={BAR.nearX - 50} y={GROUND + 66} width="100" height="16" rx="8" fill="var(--film-post)" />
          </g>

          <circle data-film="bloom" display="none" cx={IMPACT.x} cy={IMPACT.y + 40} fill="var(--color-film-lime)" />

          <g data-film="stripes" display="none">
            <path
              d="M 0 -88 H -96 M -18 -30 H -150 M 0 28 H -84"
              stroke="var(--film-stripe)"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </g>

          {SCENES.map(({ id, athlete }) => (
            <FilmAthlete key={id} id={athlete} shown={id === START.scene} />
          ))}
          {/* Le poteau proche de la perche passe devant le perchiste. */}
          <g data-scene="poleVault" display="none">
            <Props shapes={VAULT_PROPS.filter((shape) => shape.front)} />
          </g>

          {CONFETTI.map((piece, index) => (
            <g key={index} display="none" data-confetti="" fill={`var(--film-confetti-${piece.color})`}>
              {piece.kind === 0 ? <circle r={piece.size / 2} /> : null}
              {piece.kind === 1 ? (
                <rect x={-piece.size / 2} y={-piece.size / 4} width={piece.size} height={piece.size / 2} rx="3" />
              ) : null}
              {piece.kind === 2 ? (
                <polygon
                  points={`0,${-piece.size * 0.6} ${piece.size * 0.55},${piece.size * 0.45} ${-piece.size * 0.55},${piece.size * 0.45}`}
                />
              ) : null}
            </g>
          ))}
        </svg>

        <div className="film-chrome">{header}</div>

        <div className="film-beat film-beat-hero is-active">
          <h1 className="film-hero-title">
            <Words text={m.landing.title} mark={f.intro.mark} />
          </h1>
          <p className="film-lead">{m.landing.lead}</p>
          {/* Sur ordinateur, l'offre se range à côté du bouton : le personnage garde la place sous le texte. */}
          <div className="film-cta desktop:flex desktop:items-center desktop:gap-5">
            {cta}
            <p className="t-caption mt-3 max-w-[32ch] desktop:mt-0">{offer}</p>
          </div>
        </div>

        <div className="film-beat">
          <h2 className="film-title">
            <Words text={f.run.title} mark={f.run.mark} />
          </h2>
          <Note title={f.run.noteTitle} body={f.run.note} />
        </div>

        <div className="film-beat">
          <h2 className="film-title">
            <Words text={f.plant.title} mark={f.plant.mark} />
          </h2>
          <Note title={f.plant.noteTitle} body={f.plant.note} />
        </div>

        <div className="film-beat">
          <h2 className="film-title">
            <Words text={f.flight.title} mark={f.flight.mark} />
          </h2>
          <Note title={f.flight.noteTitle} body={f.flight.note} />
        </div>

        <div className="film-beat">
          <span aria-hidden className="film-check">
            <Check strokeWidth={3.5} />
          </span>
          <h2 className="film-title">
            <Words text={f.validated.title} mark={f.validated.mark} />
          </h2>
          <p className="film-sub">{f.validated.sub}</p>
        </div>

        <div className="film-beat">
          <h2 className="film-title">
            <Words text={f.finish.title} mark={f.finish.mark} />
          </h2>
          <p className="film-sub">{f.finish.body}</p>
          <div className="film-cta">{cta}</div>
        </div>

        <div aria-hidden className="film-timeline">
          <div className="film-track">
            {PHASES.map((phase, index) => (
              <span
                key={phase.key}
                style={{ flexGrow: Math.round((phase.to - phase.from) * 1000) }}
                className="film-phase"
              >
                {f.timeline[index]}
              </span>
            ))}
            <span data-film="cursor" className="film-head" />
          </div>
        </div>
      </div>
    </section>
  );
};
