import type { AthleteId } from "@tartan/mascot/athletes";
import type { PoseName } from "@tartan/mascot/poses";
import type { Face } from "@tartan/mascot/rig";
import { Athlete } from "@/components/athlete";
import { TrackLine } from "@/components/track";
import { cn } from "@/lib/cn";

// Les pages d'entrée (connexion, création de l'espace) : des athlètes du groupe debout sur une ligne de piste.
// Décoratif : le titre et le formulaire portent le sens.
export const StartScene = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div aria-hidden className={cn("flex w-full flex-col items-center", className)}>
    <div className="flex items-end justify-center gap-1">{children}</div>
    <TrackLine className="w-full" />
  </div>
);

// La connexion : trois athlètes alignés, ceux du relais de la page d'accueil.
const LINEUP: AthleteId[] = ["hurdles", "poleVault", "highJump"];

export const SignInScene = ({ className }: { className?: string }) => (
  <StartScene className={className}>
    {LINEUP.map((id) => (
      <Athlete key={id} id={id} pose="lineup" on="piste" view="standing" className="h-32 w-auto desktop:h-56" />
    ))}
  </StartScene>
);

// La création de l'espace : Inès, au couloir 1, suit les trois temps. À vos marques, elle se place ; prêts, elle se
// concentre ; partez, elle s'élance. La pose suit le temps affiché par le formulaire (`data-step`), lu en CSS.
const STEP_POSES: { pose: PoseName; face: Face }[] = [
  { pose: "lineup", face: "neutral" },
  { pose: "stand", face: "effort" },
  { pose: "run", face: "joy" },
];

export const OnboardingScene = ({ className }: { className?: string }) => (
  <StartScene className={className}>
    {STEP_POSES.map(({ pose, face }, step) => (
      <Athlete
        key={step}
        id="hurdles"
        pose={pose}
        face={face}
        on="piste"
        view="stride"
        data-step-pose={step}
        className="step-pose h-56 w-auto"
      />
    ))}
  </StartScene>
);
