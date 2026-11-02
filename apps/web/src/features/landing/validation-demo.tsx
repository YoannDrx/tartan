"use client";

import type { CellStatus } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const t = m.landing.demo;
const ATHLETE = "Léa";
const GRID: { name: string; cells: [CellStatus, CellStatus, CellStatus] }[] = [
  { name: ATHLETE, cells: ["done", "partial", "upcoming"] },
  { name: "Tom", cells: ["done", "done", "done"] },
  { name: "Inès", cells: ["missed", "done", "upcoming"] },
  { name: "Noah", cells: ["done", "done", "partial"] },
];

const formatSeconds = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");

// Le chrono est le vrai temps du visiteur : il part quand la démonstration est à l'écran.
export const ValidationDemo = () => {
  const root = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) startedAt.current ??= performance.now();
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const validate = () => setElapsed(performance.now() - (startedAt.current ?? performance.now()));
  const restart = () => {
    startedAt.current = performance.now();
    setElapsed(null);
  };
  const done = elapsed !== null;

  return (
    <div
      ref={root}
      role="group"
      aria-label={t.label}
      className="grid gap-4 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-8"
    >
      <div className="on-hero flex flex-col rounded-hero p-5 desktop:p-6">
        <p className="t-caption text-soft">
          {t.today}. {t.example}.
        </p>
        <h2 className="t-h1 mt-2">{t.sessionTitle}</h2>
        <p className="mt-2 text-soft">{t.sessionDetail}</p>
        <div className="mt-auto pt-6">
          {done ? (
            <div>
              <div className="flex items-center gap-3">
                <svg aria-hidden width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
                  <circle cx="16" cy="16" r="15" fill="var(--st-done)" />
                  <path
                    className="validation-check"
                    d="M9 16.5l5 5L23 11"
                    fill="none"
                    stroke="var(--st-on)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="t-section">{t.validated}</p>
              </div>
              <p className="t-num mt-3 text-[28px] leading-8">{t.elapsed(formatSeconds(elapsed))}</p>
              <p className="mt-1 text-soft">{t.goal}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={restart}>
                {t.restart}
              </Button>
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={validate}>
              {t.validate}
            </Button>
          )}
        </div>
      </div>

      <div className="on-card relative rounded-card bg-card p-4 desktop:p-6">
        {/* Le trait qui relie l'athlète au coach : le signal y passe au moment de la validation. */}
        <span aria-hidden className="absolute -left-8 top-[92px] hidden h-[3px] w-8 bg-lane desktop:block">
          {done ? (
            <span className="demo-signal absolute -top-[5px] left-0 block size-[13px] rounded-full bg-lane [--signal-distance:32px]" />
          ) : null}
        </span>
        <h2 className="t-section">{t.coachGrid}</h2>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="t-col pb-2 font-semibold">
                {t.athlete}
              </th>
              {t.days.map((day) => (
                <th key={day} scope="col" className="t-col pb-2 text-center font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID.map((row) => (
              <tr
                key={row.name}
                className={cn("border-t border-card-line", row.name === ATHLETE && done && "bg-raise")}
              >
                <th scope="row" className="py-2 pl-1 font-semibold">
                  {row.name}
                </th>
                {row.cells.map((cell, index) => {
                  const live = row.name === ATHLETE && index === 2;
                  return (
                    <td key={index} className="h-11 text-center">
                      <span className={cn("inline-flex", live && done && "demo-cell")}>
                        <StatusIcon status={live && done ? "done" : cell} />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p aria-live="polite" className="sr-only">
          {done ? t.announce(ATHLETE) : ""}
        </p>
      </div>
    </div>
  );
};
