// La préparation quotidienne suit le thème de travail ; accueil et immersion gardent leur identité.
const WORLDS: Array<[RegExp, string]> = [
  [
    /^\/(suivi|calendrier|seances|exercices|annonces|reglages|abonnement|admin|athletes|progres|analyse|phases|historique|outils|videos|mes-sauts|planificateur|notifications|nouveautes|synchronisation)(\/|$)/,
    "world-work",
  ],
];

export const worldFor = (pathname: string) => WORLDS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "world-piste";
