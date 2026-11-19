import type { AvatarAnimalId, AvatarGroupId, AvatarPreset } from "@tartan/contracts";
import { ANIMAL_PAINT, ATHLETE_AVATAR_SURFACE, AVATAR_GROUNDS, type AnimalPaint } from "@tartan/design-tokens/avatars";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import type { ReactNode } from "react";
import { Athlete } from "@/components/athlete";
import { cn } from "@/lib/cn";

// Les animaux de Tartan : dessinés pour le produit, en aplats, de face, sur un disque de la palette vive.
// Même langage que le groupe : formes pleines aux bouts ronds, yeux et truffe à l'encre, aucun contour.
const ring = (count: number, radius: number, from: number, to: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180;
    return [50 + radius * Math.cos(angle), 58 + radius * Math.sin(angle)] as const;
  });

// Les piquants du hérisson : une couronne de pointes sur le haut de la tête.
const spikes = (() => {
  const points: string[] = [];
  const tips = 11;
  for (let i = 0; i <= tips * 2; i += 1) {
    const angle = ((160 + (220 * i) / (tips * 2)) * Math.PI) / 180;
    const radius = i % 2 === 0 ? 33 : 44;
    points.push(`${(50 + radius * Math.cos(angle)).toFixed(1)},${(58 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
})();

const ANIMALS: Record<AvatarAnimalId, (p: AnimalPaint) => ReactNode> = {
  fox: (p) => (
    <>
      <path d="M20 42 L30 10 L46 32 Z M80 42 L70 10 L54 32 Z" fill={p.main} />
      <path d="M27 34 L31 19 L39 31 Z M73 34 L69 19 L61 31 Z" fill={p.dark} />
      <path d="M16 42 C18 30 34 28 50 28 C66 28 82 30 84 42 C80 58 64 74 50 86 C36 74 20 58 16 42 Z" fill={p.main} />
      <path d="M16 42 C26 50 38 54 46 66 L50 86 C36 74 20 58 16 42 Z" fill={p.light} />
      <path d="M84 42 C74 50 62 54 54 66 L50 86 C64 74 80 58 84 42 Z" fill={p.light} />
      <circle cx="38" cy="47" r="4" fill={p.eye} />
      <circle cx="62" cy="47" r="4" fill={p.eye} />
      <ellipse cx="50" cy="80" rx="4.5" ry="3.5" fill={p.eye} />
    </>
  ),
  cat: (p) => (
    <>
      <path d="M20 46 L25 14 L46 32 Z M80 46 L75 14 L54 32 Z" fill={p.main} />
      <path d="M27 38 L29 23 L39 32 Z M73 38 L71 23 L61 32 Z" fill={p.accent} />
      <ellipse cx="50" cy="58" rx="32" ry="28" fill={p.main} />
      <rect x="47.5" y="31" width="5" height="10" rx="2.5" fill={p.dark} />
      <rect x="38" y="33" width="4.5" height="8" rx="2.25" fill={p.dark} transform="rotate(-18 40 37)" />
      <rect x="57.5" y="33" width="4.5" height="8" rx="2.25" fill={p.dark} transform="rotate(18 60 37)" />
      <ellipse cx="50" cy="69" rx="13" ry="9" fill={p.light} />
      <ellipse cx="38" cy="54" rx="3.5" ry="5" fill={p.eye} />
      <ellipse cx="62" cy="54" rx="3.5" ry="5" fill={p.eye} />
      <path d="M45.5 63 L54.5 63 L50 68 Z" fill={p.accent} />
    </>
  ),
  dog: (p) => (
    <>
      <ellipse cx="50" cy="56" rx="27" ry="29" fill={p.main} />
      <ellipse cx="25" cy="52" rx="10" ry="21" fill={p.dark} transform="rotate(14 25 52)" />
      <ellipse cx="75" cy="52" rx="10" ry="21" fill={p.dark} transform="rotate(-14 75 52)" />
      <ellipse cx="50" cy="70" rx="16" ry="13" fill={p.light} />
      <ellipse cx="50" cy="80" rx="4.5" ry="5" fill={p.accent} />
      <circle cx="40" cy="50" r="4" fill={p.eye} />
      <circle cx="60" cy="50" r="4" fill={p.eye} />
      <ellipse cx="50" cy="64" rx="6.5" ry="4.5" fill={p.eye} />
    </>
  ),
  bear: (p) => (
    <>
      <circle cx="25" cy="31" r="12" fill={p.main} />
      <circle cx="75" cy="31" r="12" fill={p.main} />
      <circle cx="25" cy="31" r="6.5" fill={p.light} />
      <circle cx="75" cy="31" r="6.5" fill={p.light} />
      <circle cx="50" cy="57" r="31" fill={p.main} />
      <ellipse cx="50" cy="68" rx="15" ry="12" fill={p.light} />
      <circle cx="38" cy="51" r="4" fill={p.eye} />
      <circle cx="62" cy="51" r="4" fill={p.eye} />
      <ellipse cx="50" cy="62" rx="6.5" ry="4.5" fill={p.eye} />
    </>
  ),
  rabbit: (p) => (
    <>
      <ellipse cx="37" cy="26" rx="9" ry="25" fill={p.main} transform="rotate(-10 37 26)" />
      <ellipse cx="63" cy="26" rx="9" ry="25" fill={p.main} transform="rotate(10 63 26)" />
      <ellipse cx="37" cy="27" rx="4.5" ry="18" fill={p.accent} transform="rotate(-10 37 27)" />
      <ellipse cx="63" cy="27" rx="4.5" ry="18" fill={p.accent} transform="rotate(10 63 27)" />
      <ellipse cx="50" cy="64" rx="27" ry="25" fill={p.main} />
      <circle cx="41" cy="60" r="4" fill={p.eye} />
      <circle cx="59" cy="60" r="4" fill={p.eye} />
      <path d="M45.5 68 L54.5 68 L50 73 Z" fill={p.accent} />
      <ellipse cx="34" cy="71" rx="5" ry="3" fill={p.accent} />
      <ellipse cx="66" cy="71" rx="5" ry="3" fill={p.accent} />
    </>
  ),
  owl: (p) => (
    <>
      <path d="M21 38 L25 14 L42 30 Z M79 38 L75 14 L58 30 Z" fill={p.main} />
      <ellipse cx="50" cy="60" rx="31" ry="33" fill={p.main} />
      <circle cx="38" cy="52" r="12.5" fill={p.light} />
      <circle cx="62" cy="52" r="12.5" fill={p.light} />
      <circle cx="38" cy="53" r="6" fill={p.eye} />
      <circle cx="62" cy="53" r="6" fill={p.eye} />
      <path d="M45 63 L55 63 L50 73 Z" fill={p.accent} />
      <circle cx="41" cy="83" r="3.5" fill={p.dark} />
      <circle cx="50" cy="85" r="3.5" fill={p.dark} />
      <circle cx="59" cy="83" r="3.5" fill={p.dark} />
    </>
  ),
  panda: (p) => (
    <>
      <circle cx="25" cy="32" r="12" fill={p.dark} />
      <circle cx="75" cy="32" r="12" fill={p.dark} />
      <ellipse cx="50" cy="58" rx="31" ry="28" fill={p.main} />
      <ellipse cx="38" cy="55" rx="8" ry="11" fill={p.dark} transform="rotate(35 38 55)" />
      <ellipse cx="62" cy="55" rx="8" ry="11" fill={p.dark} transform="rotate(-35 62 55)" />
      <circle cx="39" cy="53" r="3" fill={p.light} />
      <circle cx="61" cy="53" r="3" fill={p.light} />
      <ellipse cx="50" cy="66" rx="5.5" ry="4" fill={p.eye} />
      <ellipse cx="34" cy="70" rx="5" ry="3" fill={p.accent} />
      <ellipse cx="66" cy="70" rx="5" ry="3" fill={p.accent} />
    </>
  ),
  lion: (p) => (
    <>
      {ring(12, 33, 0, 330).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill={p.dark} />
      ))}
      <circle cx="50" cy="58" r="33" fill={p.dark} />
      <circle cx="33" cy="38" r="7" fill={p.main} />
      <circle cx="67" cy="38" r="7" fill={p.main} />
      <circle cx="50" cy="59" r="24" fill={p.main} />
      <ellipse cx="50" cy="69" rx="12" ry="8.5" fill={p.light} />
      <circle cx="42" cy="54" r="3.5" fill={p.eye} />
      <circle cx="58" cy="54" r="3.5" fill={p.eye} />
      <path d="M45 62 L55 62 L50 68 Z" fill={p.accent} />
    </>
  ),
  frog: (p) => (
    <>
      <circle cx="31" cy="40" r="13" fill={p.main} />
      <circle cx="69" cy="40" r="13" fill={p.main} />
      <ellipse cx="50" cy="63" rx="35" ry="25" fill={p.main} />
      <ellipse cx="50" cy="76" rx="24" ry="10" fill={p.light} />
      <circle cx="31" cy="40" r="8.5" fill={p.accent} />
      <circle cx="69" cy="40" r="8.5" fill={p.accent} />
      <circle cx="31" cy="41" r="4.5" fill={p.eye} />
      <circle cx="69" cy="41" r="4.5" fill={p.eye} />
      <path d="M35 60 Q50 71 65 60" fill="none" stroke={p.eye} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  penguin: (p) => (
    <>
      <ellipse cx="50" cy="58" rx="31" ry="33" fill={p.main} />
      <circle cx="40" cy="58" r="14" fill={p.light} />
      <circle cx="60" cy="58" r="14" fill={p.light} />
      <ellipse cx="50" cy="71" rx="19" ry="15" fill={p.light} />
      <circle cx="41" cy="55" r="4" fill={p.eye} />
      <circle cx="59" cy="55" r="4" fill={p.eye} />
      <path d="M44 64 L56 64 L50 74 Z" fill={p.accent} />
    </>
  ),
  koala: (p) => (
    <>
      <circle cx="22" cy="40" r="16" fill={p.main} />
      <circle cx="78" cy="40" r="16" fill={p.main} />
      <circle cx="22" cy="40" r="9" fill={p.accent} />
      <circle cx="78" cy="40" r="9" fill={p.accent} />
      <ellipse cx="50" cy="59" rx="29" ry="27" fill={p.main} />
      <ellipse cx="50" cy="78" rx="13" ry="6" fill={p.light} />
      <circle cx="37" cy="53" r="3.5" fill={p.eye} />
      <circle cx="63" cy="53" r="3.5" fill={p.eye} />
      <ellipse cx="50" cy="63" rx="8.5" ry="11" fill={p.dark} />
    </>
  ),
  hedgehog: (p) => (
    <>
      <polygon points={spikes} fill={p.dark} />
      <circle cx="50" cy="58" r="33" fill={p.main} />
      <ellipse cx="50" cy="68" rx="23" ry="19" fill={p.light} />
      <circle cx="42" cy="63" r="3.5" fill={p.eye} />
      <circle cx="58" cy="63" r="3.5" fill={p.eye} />
      <circle cx="50" cy="73" r="4.5" fill={p.eye} />
    </>
  ),
};

export const animalOf = (preset: AvatarPreset): AvatarAnimalId | null =>
  preset.startsWith("animal:") ? (preset.slice(7) as AvatarAnimalId) : null;
export const athleteOf = (preset: AvatarPreset): AvatarGroupId | null =>
  preset.startsWith("athlete:") ? (preset.slice(8) as AvatarGroupId) : null;

// Le nom d'un avatar prédéfini, pour le texte alternatif et la galerie.
export const presetLabel = (preset: AvatarPreset): string => {
  const animal = animalOf(preset);
  if (animal) return w.profile.gallery.animal[animal];
  const athlete = athleteOf(preset)!;
  return w.profile.gallery.athlete(m.group.athletes[athlete], m.group.events[athlete]);
};

// Le dessin d'un avatar prédéfini, qui remplit son disque. Décoratif : l'`Avatar` qui l'entoure porte le sens.
export const PresetArt = ({ preset, className }: { preset: AvatarPreset; className?: string }) => {
  const animal = animalOf(preset);
  if (animal) {
    const paint = ANIMAL_PAINT[animal];
    return (
      <svg aria-hidden viewBox="0 0 100 100" className={cn("block size-full", className)}>
        <rect width="100" height="100" fill={paint.ground} />
        {ANIMALS[animal](paint)}
      </svg>
    );
  }
  const athlete = athleteOf(preset)!;
  const surface = ATHLETE_AVATAR_SURFACE[athlete];
  return (
    <span
      aria-hidden
      className={cn("relative block size-full", className)}
      style={{ background: AVATAR_GROUNDS[surface] }}
    >
      <Athlete id={athlete} view="head" face="joy" on={surface} className="absolute inset-x-[5%] top-[10%] w-[90%]" />
    </span>
  );
};
