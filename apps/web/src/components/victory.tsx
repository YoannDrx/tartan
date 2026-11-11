"use client";

import { motion } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Jumper } from "@/components/jumper";

const PIECES = Array.from({ length: 24 }, (_, i) => ({
  x: Math.round(Math.cos((i / 24) * Math.PI * 2) * (34 + (i % 4) * 9)),
  y: Math.round(Math.sin((i / 24) * Math.PI * 2) * (30 + (i % 5) * 8)),
  kind: i % 3,
  color: i % 4,
}));

// Le seul grand moment animé de l'app : la séance est validée. Il ne bloque rien et ne dure qu'une seconde.
export const Victory = ({
  play,
  recordCount = 0,
  onDone,
}: {
  play: number;
  recordCount?: number;
  onDone?: () => void;
}) => {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (!play || reducedMotion.matches) return;
    const started = setTimeout(() => setRun(play), 0);
    const ended = setTimeout(() => {
      setRun(0);
      onDone?.();
    }, motion.duration.celebration);
    const motionChanged = (event: MediaQueryListEvent) => {
      if (event.matches) {
        clearTimeout(started);
        clearTimeout(ended);
        setRun(0);
      }
    };
    reducedMotion.addEventListener("change", motionChanged);
    return () => {
      reducedMotion.removeEventListener("change", motionChanged);
      clearTimeout(started);
      clearTimeout(ended);
    };
  }, [play, onDone]);
  if (!run) return null;
  return createPortal(
    <div key={run} aria-hidden className="victory">
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`victory-piece victory-piece-${piece.kind} victory-color-${piece.color}`}
          style={{ "--x": `${piece.x}vmin`, "--y": `${piece.y}vmin` } as React.CSSProperties}
        />
      ))}
      {recordCount > 0 ? (
        <p className="absolute top-[18%] px-6 text-center t-section text-ink">
          {m.strengthRecords.celebration(recordCount)}
        </p>
      ) : null}
      <span className="victory-check">
        <Check strokeWidth={3.5} />
      </span>
      <Jumper pose="cheer" className="victory-jumper" />
    </div>,
    document.body,
  );
};
