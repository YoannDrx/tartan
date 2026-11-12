// Tous les écrans de l'application suivent le thème de travail et ouvrent sur le bandeau piste, l'accueil de
// l'athlète et son écran de séance compris. Le mode séance et l'analyse vidéo, eux, prennent tout l'écran.
const WORLDS: Array<[RegExp, string]> = [
  [
    /^\/(aujourdhui|seance|suivi|calendrier|seances|exercices|annonces|reglages|abonnement|admin|athletes|progres|analyse|phases|historique|outils|videos|mes-sauts|planificateur|notifications|nouveautes|synchronisation)(\/|$)/,
    "world-work",
  ],
];

export const worldFor = (pathname: string) => WORLDS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "world-piste";
