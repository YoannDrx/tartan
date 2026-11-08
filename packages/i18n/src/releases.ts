// Source unique des notes de version. Seule une entrée ici notifie : un correctif sans notes reste silencieux.
// Créer une entrée : pnpm release:new 1.2.0

export type ReleaseTargets = {
  web?: true;
  // Version publiée sur le store : le push part quand elle y est réellement disponible.
  ios?: { version: string };
  android?: { version: string };
  // Mise à jour à distance, sans passage par les stores. Aucun push : l'app le propose elle-même.
  ota?: { version: string };
};

export type ReleaseNote = {
  id: string;
  date: string;
  title: string;
  coach: readonly string[];
  athlete: readonly string[];
  targets: ReleaseTargets;
};

// Du plus récent au plus ancien. Texte factuel, sans donnée de santé.
export const releases: readonly ReleaseNote[] = [
  {
    id: "2026-11-ouverture",
    date: "2026-11-08",
    title: "Ton mois d'un coup d'œil",
    coach: [
      "Calendrier au mois complet ou en liste, ton choix suit d'un appareil à l'autre.",
      "Un centre de notifications et des réglages par type de message.",
    ],
    athlete: [
      "Vois tes séances sur le mois complet ou en liste.",
      "Retrouve tes notifications au même endroit et choisis ce que tu reçois.",
    ],
    targets: { web: true },
  },
];

export const latestRelease = (platform: "web" | "ios" | "android"): ReleaseNote | null =>
  releases.find((release) =>
    platform === "web" ? release.targets.web || release.targets.ota : release.targets[platform] || release.targets.ota,
  ) ?? null;
