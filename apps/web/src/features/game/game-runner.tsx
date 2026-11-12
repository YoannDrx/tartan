"use client";

import { type SimState, TICK_HZ } from "@tartan/game";
import { m } from "@tartan/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EventUi, Item } from "./event-ui";

// La partie, quelle que soit l'épreuve : la simulation avance par pas fixes de 1/120 s, quelle que soit la cadence
// d'affichage. Le rendu lit l'état, il ne le modifie jamais. Un seul canal : appuyer.

const STEP_MS = 1000 / TICK_HZ;
type Status = "ready" | "running" | "paused" | "finished";

const readRecord = (key: string): number | null => {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};
const writeRecord = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Navigation privée ou stockage bloqué : le record vaut pour la partie seulement.
  }
};

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

export default function GameRunner<S extends SimState>({
  ui,
  onFinish,
  finishAction,
}: {
  ui: EventUi<S>;
  // Au combiné : la marque est remise au parent, qui propose l'épreuve suivante à la place de « Rejouer ».
  onFinish?: (score: number) => void;
  finishAction?: React.ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const jump = useRef<HTMLButtonElement>(null);
  const [first] = useState(() => ui.sim.init(randomSeed()));
  const sim = useRef<S>(first);
  const held = useRef(0);
  const statusRef = useRef<Status>("ready");
  const [status, setStatusState] = useState<Status>("ready");
  const [hud, setHud] = useState<Item[]>(() => ui.hud(first));
  const [result, setResult] = useState<{ headline: string; details: Item[]; isRecord: boolean } | null>(null);
  // Le jeu n'est chargé qu'au premier geste, dans le navigateur : le stockage local est lisible dès le départ.
  const [record, setRecord] = useState<number | null>(() => readRecord(ui.recordKey));

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
    ui.draw(ctx, { width, height }, sim.current, family);
  }, [ui]);

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
          sim.current = ui.sim.step(sim.current, held.current);
          spare -= STEP_MS;
        }
        const state = sim.current;
        // Le bandeau se met à jour une dizaine de fois par seconde, pas à chaque pas.
        if (Math.floor(state.tick / 12) !== Math.floor(before / 12) || state.finished) setHud(ui.hud(state));
        if (state.finished && state.score !== null) {
          const previous = readRecord(ui.recordKey);
          const better = ui.sim.lowerIsBetter ? state.score < (previous ?? Infinity) : state.score > (previous ?? 0);
          const isRecord = ui.counts(state.score) && better;
          if (isRecord) writeRecord(ui.recordKey, state.score);
          setRecord(isRecord ? state.score : previous);
          setResult({ headline: ui.headline(state), details: ui.details(state), isRecord });
          setStatus("finished");
          onFinish?.(state.score);
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
  }, [paint, setStatus, ui, onFinish]);

  const start = useCallback(() => {
    sim.current = ui.sim.init(randomSeed());
    held.current = 0;
    setHud(ui.hud(sim.current));
    setResult(null);
    setStatus("running");
    requestAnimationFrame(() => jump.current?.focus());
  }, [setStatus, ui]);

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
          {hud.map((item) => (
            <div key={item.label} className="px-3 py-2">
              <dt className="t-caption font-normal text-soft">{item.label}</dt>
              <dd className="t-num text-[20px] leading-7">{item.value}</dd>
            </div>
          ))}
        </dl>
        <canvas
          ref={canvas}
          role="img"
          aria-label={ui.canvasLabel}
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
              {ui.action}
            </button>
            <Button type="button" variant="secondary" onClick={togglePause} className="min-h-16">
              {status === "paused" ? m.game.resume : m.game.pause}
            </Button>
          </>
        ) : status === "finished" && finishAction ? (
          finishAction
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
              {result.headline} {result.isRecord ? m.game.newRecord : null}
            </p>
            {result.details.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tablet:grid-cols-4">
                {result.details.map((item) => (
                  <div key={item.label}>
                    <dt className="t-caption font-normal text-soft">{item.label}</dt>
                    <dd className="t-num text-[20px]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        ) : null}
      </div>

      <p className="text-soft">
        {record === null ? m.game.noRecord : m.game.recordValue(ui.formatScore(record))} {m.game.recordNote}
      </p>
    </div>
  );
}
