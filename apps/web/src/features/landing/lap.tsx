"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const LANES = [0, 1, 2, 3];

type Geometry = { width: number; height: number; gap: number };

// Un virage : quatre couloirs concentriques. La bande du bas d'un virage est la bande du haut du suivant.
const lanePath = (
  { width, height, gap }: Geometry,
  lane: number,
  side: "left" | "right",
  start: "bleed" | "bend",
  end: "bleed" | "bend",
) => {
  const desktop = width >= 1024;
  const margin = desktop ? 32 : 6;
  const radius = Math.min(desktop ? 220 : 64, height / 2);
  const offset = lane * gap;
  const r = radius - offset;
  const bendX = width - margin - radius;
  // Le dessin se fait à droite ; à gauche, il est retourné en miroir.
  const x = (value: number) => (side === "right" ? value : width - value);
  const sweep = side === "right" ? 1 : 0;
  const from = start === "bleed" ? -4 : bendX;
  const to = end === "bleed" ? -4 : margin + radius;
  return [
    `M ${x(from)} ${offset}`,
    `H ${x(bendX)}`,
    `A ${r} ${r} 0 0 ${sweep} ${x(bendX + r)} ${radius}`,
    `V ${height - radius}`,
    `A ${r} ${r} 0 0 ${sweep} ${x(bendX)} ${height - offset}`,
    `H ${x(to)}`,
  ].join(" ");
};

export const LapBend = ({
  side,
  start = "bend",
  end = "bend",
  className,
  children,
}: {
  side: "left" | "right";
  start?: "bleed" | "bend";
  end?: "bleed" | "bend";
  className?: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setGeometry({
        width: element.offsetWidth,
        height: element.offsetHeight,
        gap: parseFloat(getComputedStyle(element).getPropertyValue("--lap-gap")) || 9,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={cn("lap relative", className)}>
      {geometry ? (
        <svg
          aria-hidden
          width={geometry.width}
          height={geometry.height}
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          {LANES.map((lane) => (
            <path
              key={lane}
              className="lap-lane"
              pathLength={1}
              d={lanePath(geometry, lane, side, start, end)}
              fill="none"
              stroke="var(--color-lane)"
              strokeWidth={3}
            />
          ))}
        </svg>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
};
