// La préparation quotidienne utilise le bureau clair ; accueil et immersion gardent leur identité.
const WORLDS: Array<[RegExp, string]> = [
  [
    /^\/(suivi|calendrier|seances|exercices|annonces|reglages|abonnement|admin|athletes|progres|videos|mes-sauts)(\/|$)/,
    "world-work",
  ],
];

export const worldFor = (pathname: string) => WORLDS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "world-piste";
