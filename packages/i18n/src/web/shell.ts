// La coquille de l'application : en-tête et barre de navigation.
export const shell = {
  home: "Tartan, accueil",
  mainNav: "Navigation principale",
  // Le nom de la marque, tel que le logotype l'écrit.
  brand: "Tartan",
  backToSite: "Tartan, retour au site",
  // La page introuvable.
  backHome: "Revenir à l'accueil",
  // Le sélecteur d'espace de l'en-tête : un compte coach chez lui et athlète ailleurs passe de l'un à l'autre.
  spaces: {
    title: "Mes espaces",
    current: "Espace ouvert",
    opening: "Ouverture…",
  },
} as const;
