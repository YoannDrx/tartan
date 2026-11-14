// Une vidéo en file appartient au compte qui l'a ajoutée : elle ne part et ne s'affiche que pour lui.
// Sans compte connu, ou pour une ancienne entrée sans propriétaire, rien n'est envoyé.
export const isOwnUpload = (item: { ownerId?: string | null }, ownerId: string | null): boolean =>
  Boolean(ownerId) && item.ownerId === ownerId;
