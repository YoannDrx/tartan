// Un lien magique reçu alors qu'un autre compte est ouvert : le nouveau compte remplace l'ancien, sans passer par
// une déconnexion. L'ordre compte. Tant que l'ancien cookie est en place, un écran encore monté de l'ancien compte
// peut relire son profil et remettre l'ancien rôle en cache. On arrête donc les requêtes, on remplace le cookie
// (sans fusion avec l'ancien), et seulement ensuite on vide les données et l'espace mémorisé.
export type AccountSwitchSteps = {
  cancelQueries: () => Promise<void>;
  clearCookie: () => Promise<void>;
  storeCookie: (cookie: string) => Promise<void>;
  clearData: () => Promise<void>;
  forgetActiveSpace: () => void;
  refreshSession: () => Promise<void>;
  resetNavigation: () => void;
};

export const switchAccount = async (cookie: string, steps: AccountSwitchSteps): Promise<void> => {
  await steps.cancelQueries();
  await steps.clearCookie();
  await steps.storeCookie(cookie);
  await steps.clearData();
  steps.forgetActiveSpace();
  await steps.refreshSession();
  steps.resetNavigation();
};
