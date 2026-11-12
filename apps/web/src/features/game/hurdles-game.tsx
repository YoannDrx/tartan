"use client";

import { TICK_HZ } from "@tartan/game";
import { GRADE, clockMs, hurdles, type HurdlesState } from "@tartan/game/events/hurdles";
import { m } from "@tartan/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { drawHurdles } from "./hurdles-scene";

// La partie : la simulation avance par pas fixes de 1/120 s, quelle que soit la cadence d'affichage. Le rendu
// lit l'état, il ne le modifie jamais. Un seul canal : appuyer, c'est sauter.

const STEP_MS = 1000 / TICK_HZ;
const RECORD_KEY = "tartan.jeu.haies.record";
type Status = "ready" | "running" | "paused" | "finished";

const readRecord = (): number | null => {
  try {
    const value = Number(window.localStorage.getItem(RECORD_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};
const writeRecord = (value: number) => {
  try {
    window.localStorage.setItem(RECORD_KEY, String(value));
  } catch {
    // Navigation privée ou stockage bloqué : le record vaut pour la partie seulement.
  }
};

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

const tally = (state: HurdlesState) => ({
  perfect: state.hurdles.filter((g) => g === GRADE.perfect).length,
  good: state.hurdles.filter((g) => g === GRADE.good).length,
  touched: state.hurdles.filter((g) => g === GRADE.early || g === GRADE.late).length,
  down: state.hurdles.filter((g) => g === GRADE.clipped || g === GRADE.crashed).length,
});

export default function HurdlesGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const jump = useRef<HTMLButtonElement>(null);
  const [first] = useState(() => hurdles.init(randomSeed()));
  const sim = useRef<HurdlesState>(first);
  const held = useRef(0);
  const statusRef = useRef<Status>("ready");
  const [status, setStatusState] = useState<Status>("ready");
  const [hud, setHud] = useState({ tick: 0, next: 0, wind: first.wind });
  const [result, setResult] = useState<{
    score: number;
    isRecord: boolean;
    counts: ReturnType<typeof tally>;
  } | null>(null);
  // Le jeu n'est chargé qu'au premier geste, dans le navigateur : le stockage local est lisible dès le départ.
  const [record, setRecord] = useState<number | null>(readRecord);

  const setStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  // L'image : la taille du canvas suit celle de son cadre, à la densité de l'écran.
  const paint = useCallback(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const { width, height } = node.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-barlow").trim() || "sans-serif";
    drawHurdles(ctx, { width, height }, sim.current, m.game.metres, family);
  }, []);

  // La boucle : on rattrape le temps écoulé pas par pas, puis on dessine une fois.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let spare = 0;
    const loop = (now: number) => {
      if (statusRef.current === "running") {
        spare += Math.min(now - last, 250);
        const before = sim.current.tick;
        while (spare >= STEP_MS && !sim.current.finished) {
          sim.current = hurdles.step(sim.current, held.current);
          spare -= STEP_MS;
        }
        const state = sim.current;
        // Le bandeau se met à jour une dizaine de fois par seconde, pas à chaque pas.
        if (Math.floor(state.tick / 12) !== Math.floor(before / 12) || state.finished)
          setHud({ tick: state.tick, next: state.next, wind: state.wind });
        if (state.finished && state.score !== null) {
          const previous = readRecord();
          const isRecord = previous === null || state.score < previous;
          if (isRecord) writeRecord(state.score);
          setRecord(isRecord ? state.score : previous);
          setResult({ score: state.score, isRecord, counts: tally(state) });
          setStatus("finished");
        }
      }
      last = now;
      paint();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const resize = () => paint();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [paint, setStatus]);

  const start = useCallback(() => {
    sim.current = hurdles.init(randomSeed());
    held.current = 0;
    setHud({ tick: 0, next: 0, wind: sim.current.wind });
    setResult(null);
    setStatus("running");
    requestAnimationFrame(() => jump.current?.focus());
  }, [setStatus]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "running") {
      held.current = 0;
      setStatus("paused");
    } else if (statusRef.current === "paused") setStatus("running");
  }, [setStatus]);

  // Clavier : Espace ou Entrée pour sauter, Échap pour la pause. Une page cachée met la course en pause.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape") return togglePause();
      if (event.key !== " " && event.key !== "Enter") return;
      if (statusRef.current !== "running") return;
      event.preventDefault();
      held.current = 1;
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") held.current = 0;
    };
    const hidden = () => {
      if (document.hidden && statusRef.current === "running") togglePause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [togglePause]);

  const pressDown = useCallback(() => {
    if (statusRef.current === "running") held.current = 1;
  }, []);
  const pressUp = useCallback(() => {
    held.current = 0;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="on-card overflow-hidden rounded-card bg-card">
        <dl className="grid grid-cols-3 divide-x divide-card-line border-b border-card-line">
          {[
            { label: m.game.clock, value: m.game.seconds(clockMs(hud.tick)) },
            { label: m.game.wind, value: m.game.windValue(hud.wind) },
            { label: m.game.cleared, value: m.game.clearedValue(hud.next) },
          ].map((item) => (
            <div key={item.label} className="px-3 py-2">
              <dt className="t-caption font-normal text-soft">{item.label}</dt>
              <dd className="t-num text-[20px] leading-7">{item.value}</dd>
            </div>
          ))}
        </dl>
        <canvas
          ref={canvas}
          role="img"
          aria-label={m.game.canvas}
          className="block aspect-[16/9] w-full touch-none select-none tablet:aspect-[21/9]"
          onPointerDown={pressDown}
          onPointerUp={pressUp}
          onPointerCancel={pressUp}
          onPointerLeave={pressUp}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === "running" || status === "paused" ? (
          <>
            <button
              ref={jump}
              type="button"
              disabled={status === "paused"}
              onPointerDown={pressDown}
              onPointerUp={pressUp}
              onPointerCancel={pressUp}
              onPointerLeave={pressUp}
              // Le clavier passe par la page entière (Espace, Entrée) : ce bouton ne double pas l'appui.
              onKeyDown={(event) => event.key === " " && event.preventDefault()}
              className={cn(
                "flex min-h-16 min-w-40 flex-1 touch-none select-none items-center justify-center rounded-full",
                "bg-accent text-[22px] font-semibold text-on-accent disabled:opacity-50 tablet:flex-none",
              )}
            >
              {m.game.jump}
            </button>
            <Button type="button" variant="secondary" onClick={togglePause} className="min-h-16">
              {status === "paused" ? m.game.resume : m.game.pause}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={start} className="min-h-16 min-w-40 text-[20px]">
            {status === "finished" ? m.game.again : m.game.start}
          </Button>
        )}
      </div>

      <div role="status" className="flex flex-col gap-2">
        {status === "paused" ? <p>{m.game.paused}</p> : null}
        {result ? (
          <>
            <p className="t-h2">
              {m.game.result(m.game.seconds(result.score))} {result.isRecord ? m.game.newRecord : null}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tablet:grid-cols-4">
              {(["perfect", "good", "touched", "down"] as const).map((key) => (
                <div key={key}>
                  <dt className="t-caption font-normal text-soft">{m.game.grades[key]}</dt>
                  <dd className="t-num text-[20px]">{result.counts[key]}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </div>

      <p className="text-soft">
        {record === null ? m.game.noRecord : m.game.recordValue(m.game.seconds(record))} {m.game.recordNote}
      </p>
    </div>
  );
}
