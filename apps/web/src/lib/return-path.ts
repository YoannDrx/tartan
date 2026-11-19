const LOCAL_ORIGIN = "https://tartan.invalid";

// La page demandée, posée par le proxy sur chaque requête de page : le client ne peut pas l'imposer, le proxy
// l'écrase toujours. Elle sert à revenir au bon endroit après la connexion.
export const RETURN_PATH_HEADER = "x-tartan-path";

// L'adresse de la connexion qui ramènera à la page demandée. Une destination douteuse ou l'accueil lui-même
// ne s'écrivent pas dans l'adresse.
export const signInPath = (requested: string | null | undefined, fallback = "/accueil"): string => {
  const next = safeReturnPath(requested ?? undefined, fallback);
  return next === fallback ? "/connexion" : `/connexion?next=${encodeURIComponent(next)}`;
};

// Le navigateur normalise notamment /\ en // : tester le préfixe seul ne suffit pas.
export const safeReturnPath = (value: string | undefined, fallback = "/accueil"): string => {
  if (!value?.startsWith("/") || [...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
    return fallback;
  }
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    return url.origin === LOCAL_ORIGIN && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
};
