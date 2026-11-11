"use client";

import { m } from "@tartan/i18n";
import { smooth } from "@tartan/mascot/clip";
import { STACK, type Paint } from "@tartan/mascot/skeleton";
import { boneTransform, rootTransform } from "@tartan/mascot/svg";
import { Check } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { JumperFigure } from "@/components/jumper";
import {
  BAR,
  barWobble,
  BEAT_AT,
  CONFETTI,
  confettiAt,
  GROUND,
  IMPACT,
  MAT_TOP,
  poseAt,
  T,
  TRAIL_LENGTH,
  TRAIL_PATH,
  trailAt,
  WORLD_AT,
} from "./jump-film-pose";

const f = m.landing.film;
const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;
// Hauteur occupée par le titre et sa remarque, et hauteur du saut au-dessus du bas de la scène.
const TEXT_ROOM = 290;
const ACTION_HEIGHT = 860;

const PHASES = [
  { key: "approach", from: T.run, to: T.plant },
  { key: "takeoff", from: T.plant, to: T.takeoff },
  { key: "flight", from: T.takeoff, to: T.impact },
  { key: "landing", from: T.impact, to: T.end },
] as const;

const round = (value: number) => Math.round(value * 100) / 100;

// Le personnage change de couleurs avec le monde traversé (globals.css).
const PAINT: Paint = {
  skin: "var(--color-film-skin)",
  tee: "var(--film-tee)",
  shorts: "var(--film-shorts)",
  shoe: "var(--film-shoe)",
  hair: "var(--film-hair)",
  eye: "var(--color-ink)",
};
const START = poseAt(0);

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
    const figure = find<SVGGElement>("root");
    const bones = STACK.map((bone) => ({
      bone,
      node: figure?.querySelector<SVGGElement>(`[data-bone="${bone.id}"]`) ?? null,
    }));
    const trail = find<SVGPathElement>("trail");
    const bar = find<SVGGElement>("bar");
    const stripes = find<SVGGElement>("stripes");
    const ring = find<SVGCircleElement>("ring");
    const bloom = find<SVGCircleElement>("bloom");
    const cursor = find<HTMLElement>("cursor");
    const confetti = Array.from(root.querySelectorAll<SVGGElement>("[data-confetti]"));
    const beats = Array.from(root.querySelectorAll<HTMLElement>(".film-beat"));

    let lastBeat = -1;
    let lastWorld = "";
    let viewWidth = STAGE_WIDTH;
    let viewHeight = STAGE_HEIGHT;

    // Scène fixe sur grand écran. Sur un écran étroit, le cadre suit le coureur et le ciel s'agrandit.
    const frameView = (x: number) => {
      const left = viewWidth >= STAGE_WIDTH ? 0 : Math.min(Math.max(x - viewWidth * 0.36, 0), 1460 - viewWidth);
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

    const render = (time: number) => {
      const pose = poseAt(time);
      // La pose du film porte aussi la position du bassin : elle place le corps, puis l'oriente.
      figure?.setAttribute("transform", rootTransform(pose, pose));
      for (const { bone, node } of bones) node?.setAttribute("transform", boneTransform(bone, pose));
      frameView(pose.x);

      trail?.setAttribute("stroke-dasharray", `${round(trailAt(time))} ${TRAIL_LENGTH + 100}`);
      bar?.setAttribute("transform", `rotate(${round(barWobble(time))} ${BAR.farX} ${BAR.farY})`);

      const running = time > T.run + 0.03 && time < T.plant;
      stripes?.setAttribute("display", running ? "inline" : "none");
      if (running) {
        const stretch = 0.5 + smooth(T.run, T.runEnd, time);
        stripes?.setAttribute(
          "transform",
          `translate(${round(pose.x - 74)} ${round(pose.y)}) scale(${round(stretch)} 1)`,
        );
      }

      if (ring) {
        const on = time > T.plant - 0.008 && time < T.plant + 0.05;
        ring.setAttribute("display", on ? "inline" : "none");
        if (on) ring.setAttribute("r", String(round(16 + 240 * smooth(T.plant - 0.008, T.plant + 0.05, time))));
      }

      if (bloom) {
        const on = time >= T.impact && time < T.finish;
        bloom.setAttribute("display", on ? "inline" : "none");
        if (on) {
          const u = Math.min((time - T.impact) / (T.filled - T.impact), 1);
          bloom.setAttribute("r", String(round(2600 * (1 - (1 - u) ** 3))));
        }
      }

      const flying = time >= T.impact && time < T.finish;
      confetti.forEach((element, index) => {
        const piece = CONFETTI[index];
        if (!element || !piece) return;
        element.setAttribute("display", flying ? "inline" : "none");
        if (!flying) return;
        const c = confettiAt(piece, time);
        element.setAttribute("transform", `translate(${round(c.x)} ${round(c.y)}) rotate(${round(c.rot)})`);
      });

      const world = WORLD_AT(time);
      if (world !== lastWorld) {
        root.dataset.world = world;
        lastWorld = world;
      }
      const beatNow = BEAT_AT(time);
      if (beatNow !== lastBeat) {
        root.dataset.beat = String(beatNow);
        beats.forEach((element, index) => element?.classList.toggle("is-active", index === beatNow));
        lastBeat = beatNow;
      }

      const progress = Math.min(Math.max((time - T.run) / (T.end - T.run), 0), 1);
      cursor?.style.setProperty("left", `${round(progress * 100)}%`);
    };

    let current = 0;
    const resize = new ResizeObserver(() => {
      measure();
      render(current);
    });

    // Animations réduites ou écran trop bas pour le film : une image fixe, l'athlète au-dessus de la barre.
    if (matchMedia("(prefers-reduced-motion: reduce), (max-height: 559px)").matches) {
      measure();
      render(T.apex);
      root.dataset.world = "piste";
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
            fill="var(--color-film-sun-light)"
          />
          <rect x="800" y={MAT_TOP + 38} width="1000" height="172" fill="var(--color-film-sun)" />

          <path
            data-film="trail"
            d={TRAIL_PATH}
            fill="none"
            stroke="var(--film-line)"
            strokeWidth="7"
            strokeDasharray={`0 ${TRAIL_LENGTH + 100}`}
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

          <circle data-film="bloom" display="none" cx={IMPACT.x} cy={IMPACT.y + 40} fill="var(--color-film-lime)" />

          <g data-film="stripes" display="none">
            <path
              d="M 0 -88 H -96 M -18 -30 H -150 M 0 28 H -84"
              stroke="var(--film-stripe)"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </g>

          <JumperFigure data-film="root" pose={START} at={START} paint={PAINT} classes={{ eyes: "film-eyes" }} />

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
