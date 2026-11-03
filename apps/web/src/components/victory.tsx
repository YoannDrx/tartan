"use client";

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
export const Victory = ({ play, onDone }: { play: number; onDone?: () => void }) => {
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!play || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const started = setTimeout(() => setRun(play), 0);
    const ended = setTimeout(() => {
      setRun(0);
      onDone?.();
    }, 1150);
    return () => {
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
      <span className="victory-check">
        <Check strokeWidth={3.5} />
      </span>
      <Jumper pose="cheer" className="victory-jumper" />
    </div>,
    document.body,
  );
};
