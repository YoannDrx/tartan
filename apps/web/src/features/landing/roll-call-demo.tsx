"use client";

import { m } from "@tartan/i18n";
import { useState } from "react";
import { cn } from "@/lib/cn";

const t = m.landing.rollCall;
const ATHLETES = ["Léa", "Tom", "Inès"];

export const RollCallDemo = () => {
  const [absent, setAbsent] = useState<string[]>(["Inès"]);

  const toggle = (name: string, isAbsent: boolean) =>
    setAbsent((list) => (isAbsent ? [...list, name] : list.filter((other) => other !== name)));

  return (
    <div className="on-card rounded-card bg-card p-4 desktop:p-6">
      <h3 className="t-section">{t.sheet}</h3>
      <ul className="mt-3">
        {ATHLETES.map((name) => {
          const isAbsent = absent.includes(name);
          return (
            <li key={name} className="border-t border-card-line py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{name}</span>
                <div role="group" aria-label={t.statusFor(name)} className="flex gap-1">
                  {[false, true].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      aria-pressed={isAbsent === value}
                      onClick={() => toggle(name, value)}
                      className={cn(
                        "min-h-11 rounded-full px-4 font-semibold",
                        isAbsent === value ? "bg-white text-ink" : "bg-card-raised hover:bg-card-line",
                      )}
                    >
                      {value ? t.absent : t.present}
                    </button>
                  ))}
                </div>
              </div>
              <p className="t-caption mt-2 font-normal text-soft" aria-live="polite">
                <span className="font-semibold text-fg">{isAbsent ? m.variant.autonomous : m.variant.club}</span> :{" "}
                {isAbsent ? t.soloSession : t.clubSession}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
