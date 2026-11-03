import { BODY, JUMPER_POSES, type JumperPoseName } from "@tartan/design-tokens";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const Leg = ({ leg, knee }: { leg: number; knee: number }) => (
  <g transform={`rotate(${-leg})`}>
    <line y2={BODY.thigh} stroke="var(--color-film-skin)" strokeWidth="32" strokeLinecap="round" />
    <line y2={BODY.thigh * 0.56} stroke="var(--j-shorts)" strokeWidth="38" strokeLinecap="round" />
    <g transform={`translate(0 ${BODY.thigh}) rotate(${knee})`}>
      <line y2={BODY.shin} stroke="var(--color-film-skin)" strokeWidth="30" strokeLinecap="round" />
      <rect x="-18" y={BODY.shin - 8} width="66" height="30" rx="15" fill="var(--j-shoe)" />
    </g>
  </g>
);

const Arm = ({ arm, elbow }: { arm: number; elbow: number }) => (
  <g transform={`translate(0 ${-BODY.shoulder}) rotate(${-arm})`}>
    <line y2={BODY.arm} stroke="var(--color-film-skin)" strokeWidth="26" strokeLinecap="round" />
    <g transform={`translate(0 ${BODY.arm}) rotate(${-elbow})`}>
      <line y2={BODY.forearm} stroke="var(--color-film-skin)" strokeWidth="24" strokeLinecap="round" />
    </g>
  </g>
);

// La mascotte, en aplats. Décorative : le texte voisin porte le sens.
export const Jumper = ({
  pose = "stand",
  className,
  ...svg
}: { pose?: JumperPoseName } & Omit<ComponentProps<"svg">, "viewBox">) => {
  const p = JUMPER_POSES[pose];
  return (
    <svg aria-hidden viewBox="-250 -270 500 500" className={cn("jumper", className)} {...svg}>
      <g transform={`rotate(${p.rot}) scale(${p.flip * p.sx} ${p.sy})`}>
        <Leg leg={p.legB} knee={p.kneeB} />
        <g transform={`rotate(${p.lean})`}>
          <Arm arm={p.armB} elbow={p.elbowB} />
        </g>
        <Leg leg={p.legA} knee={p.kneeA} />
        <g transform={`rotate(${p.lean})`}>
          <rect x="-36" y={-BODY.torso - 8} width="72" height={BODY.torso + 24} rx="28" fill="var(--j-tee)" />
          <rect x="-37" y="-14" width="74" height="34" rx="16" fill="var(--j-shorts)" />
          <g transform={`translate(0 ${-BODY.neck}) rotate(${p.head})`}>
            <circle r="44" fill="var(--color-film-skin)" />
            <path d="M -43 -10 A 44 44 0 0 1 43 -10 Z" fill="var(--j-hair)" />
            <circle cx="15" cy="6" r="6" fill="var(--color-ink)" />
            <circle cx="31" cy="6" r="6" fill="var(--color-ink)" />
          </g>
          <Arm arm={p.armA} elbow={p.elbowA} />
        </g>
      </g>
    </svg>
  );
};
