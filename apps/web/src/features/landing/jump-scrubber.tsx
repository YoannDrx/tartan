"use client";

import { m } from "@tartan/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { BarSheet } from "@/components/bar-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const t = m.landing.video;
const FRAMES = 480;
const FPS = 240;
const PHASES = [
  { key: "approach", from: 0, to: 288 },
  { key: "takeoff", from: 288, to: 336 },
  { key: "flight", from: 336, to: 432 },
  { key: "landing", from: 432, to: FRAMES },
] as const;

// Trajectoire schématique : course au sol, puis arc au-dessus de la barre.
const position = (frame: number) => {
  if (frame < 288) return { x: 20 + 280 * (frame / 288), y: 230 };
  const u = (frame - 288) / (FRAMES - 1 - 288);
  return { x: 300 + 210 * u, y: 230 - 25 * u - 500 * u * (1 - u) };
};
const trail = Array.from({ length: Math.ceil(FRAMES / 8) }, (_, i) => {
  const { x, y } = position(i * 8);
  return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(" ");

const BARS = [
  { heightCm: 180, notation: "O" },
  { heightCm: 185, notation: "XO" },
  { heightCm: 190, notation: "XXO" },
];

export const JumpScrubber = () => {
  const [frame, setFrame] = useState(300);
  const point = position(frame);
  const phase = PHASES.find((p) => frame >= p.from && frame < p.to) ?? PHASES[0];
  const step = (delta: number) => setFrame((current) => Math.min(FRAMES - 1, Math.max(0, current + delta)));

  return (
    <div className="scene-dark rounded-block bg-card p-4 desktop:p-6">
      <svg viewBox="0 50 640 200" aria-hidden className="w-full">
        <rect x="470" y="205" width="150" height="30" rx="4" fill="var(--color-card-raised)" />
        <line x1="420" y1="88" x2="420" y2="236" stroke="var(--color-control-line)" strokeWidth="3" />
        <line x1="396" y1="112" x2="444" y2="112" stroke="var(--color-brand)" strokeWidth="5" strokeLinecap="round" />
        <line x1="0" y1="236" x2="640" y2="236" stroke="var(--color-card-line)" strokeWidth="3" />
        <path d={trail} fill="none" stroke="var(--color-control-line)" strokeWidth="2" strokeDasharray="2 6" />
        <circle cx={point.x} cy={point.y} r="9" fill="var(--color-fg)" />
      </svg>

      <div className="mt-2 flex items-center gap-1">
        <Button
          variant="quiet"
          size="sm"
          className="size-11 shrink-0 px-0"
          aria-label={t.previous}
          onClick={() => step(-1)}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Button>
        <input
          type="range"
          min={0}
          max={FRAMES - 1}
          value={frame}
          aria-label={t.slider}
          aria-valuetext={`${t.frame(frame + 1, FRAMES)}, ${t.phases[phase.key]}`}
          onChange={(event) => setFrame(Number(event.target.value))}
          className="jump-range"
        />
        <Button variant="quiet" size="sm" className="size-11 shrink-0 px-0" aria-label={t.next} onClick={() => step(1)}>
          <ChevronRight aria-hidden className="size-5" />
        </Button>
      </div>

      <ol className="mt-1 grid grid-cols-2 gap-[3px] tablet:flex">
        {PHASES.map((p) => (
          <li key={p.key} style={{ flexGrow: Math.max(p.to - p.from, 72) }} className="min-w-0 basis-0">
            <button
              type="button"
              aria-current={p.key === phase.key ? "step" : undefined}
              onClick={() => setFrame(p.from + Math.floor((p.to - p.from) / 2))}
              className={cn(
                "t-caption min-h-11 w-full truncate rounded-[4px] px-1",
                p.key === phase.key ? "bg-brand font-semibold text-white" : "bg-card-raised hover:bg-card-line",
              )}
            >
              {t.phases[p.key]}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-[220px] flex-1">
          <p className="t-num text-[20px]">
            {t.frame(frame + 1, FRAMES)}, {t.seconds(((frame + 1) / FPS).toFixed(2).replace(".", ","))}
          </p>
          <p className="t-col mt-3">{t.coachSays}</p>
          <p className="mt-1" aria-live="polite">
            {t.comments[phase.key]}
          </p>
        </div>
        <BarSheet rows={BARS} current={190} />
      </div>
      <p className="t-caption mt-4 border-t border-card-line pt-3 font-normal text-soft">{t.caption}</p>
    </div>
  );
};
