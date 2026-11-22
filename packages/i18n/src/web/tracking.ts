// Suivi du coach.
export const tracking = {
  groupFilter: "Filtrer par groupe",
  notConcerned: "Non concerné",
  // Un grand groupe : retrouver quelqu'un par son nom, et la liste rendue par tranches.
  search: "Rechercher un athlète",
  searchPlaceholder: "Nom ou prénom",
  showMore: (count: number) => `Afficher ${count} athlète${count > 1 ? "s" : ""} de plus`,
  shown: (shown: number, total: number) =>
    `${shown} athlète${shown > 1 ? "s" : ""} affiché${shown > 1 ? "s" : ""} sur ${total}`,
  noMatch: (query: string) => `Aucun athlète ne correspond à « ${query} ». Essaie le prénom seul, ou le début du nom.`,
  // Détail d'une séance, ligne d'un athlète.
  pain: (area: string, intensity: number) => `Douleur : ${area}, ${intensity}/10`,
  effort: (rpe: number) => `Effort ${rpe}/10`,
  minutes: (count: number) => `${count} min`,
  setsChecked: (count: number) => `${count} série${count > 1 ? "s" : ""} cochée${count > 1 ? "s" : ""}`,
  realLoads: (loads: string[]) => `, charges réelles : ${loads.join(" / ")} kg`,
  startsAt: (time: string) => ` à ${time.replace(":", " h ")}`,
  // L'appel d'une séance.
  rollCallSearch: "Rechercher un athlète dans l'appel",
  attendanceOf: (name: string) => `Présence de ${name}`,
  present: "Présent",
  absent: "Absent",
  autonomousGenerated: "Version autonomie générée. Ajuste-la depuis la séance.",
} as const;
