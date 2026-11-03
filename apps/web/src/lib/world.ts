// Chaque rubrique a son monde de couleur : le fond change franchement d'une rubrique à l'autre (DESIGN.md).
const WORLDS: Array<[RegExp, string]> = [
  [/^\/(suivi|calendrier|seances)(\/|$)/, "world-couloir"],
  [/^\/(exercices|annonces|reglages|abonnement|admin)(\/|$)/, "world-craie"],
  [/^\/(athletes|progres)(\/|$)/, "world-soleil"],
  [/^\/(videos|mes-sauts)(\/|$)/, "world-nuit"],
];

export const worldFor = (pathname: string) => WORLDS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "world-piste";
