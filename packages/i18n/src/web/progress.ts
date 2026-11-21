// Les progrès de l'athlète (`/progres`).
export const progress = {
  // Ni record ni test : un seul état vide, avec l'athlète de la rubrique, au lieu de deux phrases.
  empty: "Tes records et tes tests de force apparaîtront ici dès que ton coach les aura notés.",
  emptyAction: "Voir mes séances",
  noRecords: "Tes records apparaîtront ici dès que ton coach les aura notés.",
  noTests: "Tes tests de force apparaîtront ici dès que ton coach les aura notés.",
  kilos: (value: string) => `${value} kg`,
} as const;
