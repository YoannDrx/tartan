import type { AthleteId } from "@tartan/mascot/athletes";

// L'athlète du groupe qui porte une discipline saisie par le coach (texte libre) : celui de son épreuve. Une
// discipline hors des six épreuves (sprint, demi-fond, lancers autres que le disque) prend Malo, de la perche,
// l'athlète des progrès.
const MATCHES: [RegExp, AthleteId][] = [
  [/haie/i, "hurdles"],
  [/perche/i, "poleVault"],
  [/triple/i, "tripleJump"],
  [/disque/i, "discus"],
  [/longueur/i, "longJump"],
  [/hauteur/i, "highJump"],
];

export const disciplineAthlete = (discipline: string): AthleteId =>
  MATCHES.find(([pattern]) => pattern.test(discipline.normalize("NFC")))?.[1] ?? "poleVault";
