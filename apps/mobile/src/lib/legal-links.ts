// Pages sans tarif ni lien de vente : le seul endroit d'où l'app ouvre le site.
export const legalLinks = (webUrl: string) => ({
  terms: `${webUrl}/mobile/conditions`,
  privacy: `${webUrl}/mobile/confidentialite`,
  contact: `${webUrl}/mobile/contact`,
});
