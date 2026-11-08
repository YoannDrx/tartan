// Les liens du site ouvrent l'app (liens universels, App Links) : on les traduit en routes de l'app.
// Rien du lien n'est utilisé tel quel comme route.
const ID = /^[A-Za-z0-9-]{8,64}$/;
const REFERRAL = /^[A-Za-z0-9-]{4,40}$/;

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

// « /seance/<id> » et « /seance/<id>/mode » ouvrent la même séance : l'app n'a qu'un écran pour les deux.
export const sessionRoute = (path: string | string[] | undefined): string => {
  const id = first(path);
  if (ID.test(id) && Array.isArray(path) && path.length === 2 && path[1] === "series") return `/session-sets/${id}`;
  return ID.test(id) ? `/session/${id}` : "/today";
};

export const jumpRoute = (id: string | string[] | undefined): string => {
  const value = first(id);
  return ID.test(value) ? `/video/${value}` : "/jumps";
};

// Même règle que la route web `/r/<code>`.
export const parseReferralCode = (code: string | string[] | undefined): string | null => {
  const value = first(code);
  return REFERRAL.test(value) ? value.toUpperCase() : null;
};

// Le site ajoute `?espace=` à ses liens : l'app ouvre le bon espace pour un compte qui en a plusieurs.
export const parseSpaceParam = (value: string | string[] | undefined): string | null => {
  const id = first(value);
  return ID.test(id) ? id : null;
};
