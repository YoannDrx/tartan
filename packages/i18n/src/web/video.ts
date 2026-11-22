// Analyse vidéo sur le web : plein écran, éditeur à portée, raccourcis et tracés au clavier.
export const video = {
  // La hauteur de barre, affichée en mètres, saisie en centimètres.
  meters: (value: string) => `${value} m`,
  inCentimeters: (label: string) => `${label} (cm)`,
  // La liste `/videos` sur téléphone : les filtres attendent dans une feuille, la vidéo vient d'abord (audit G2).
  filters: {
    open: "Filtres",
    active: (n: number) => `${n} actif${n > 1 ? "s" : ""}`,
    title: "Filtrer les vidéos",
    clear: "Effacer les filtres",
  },
  playbackImpossible: "Lecture impossible sur cet appareil.",
  timelinePosition: "Position dans la vidéo",
  goTo: (time: string, count: number) => `Aller à ${time}${count > 1 ? `, ${count} remarques` : ""}`,
  barBadge: (height: string, result: string) => `${height} m, ${result}`,
  speedBadge: (speed: string, fps: number | null | undefined) => (fps ? `${speed}, ${fps} i/s` : speed),
  speedNext: (current: string, next: string) => `Vitesse ${current}. Passer à ${next}`,
  fullscreen: {
    enter: "Plein écran",
    exit: "Quitter le plein écran",
  },
  addRemark: "Ajouter une remarque",
  editor: "Remarques et commentaires",
  panel: {
    collapse: "Replier le panneau",
    expand: "Déplier le panneau",
    widen: "Élargir le panneau",
    narrow: "Rétrécir le panneau",
  },
  sheet: {
    grow: "Agrandir la feuille",
    shrink: "Réduire la feuille",
    state: {
      rail: "Feuille repliée : la frise reste visible.",
      half: "Feuille à mi-hauteur.",
      full: "Feuille ouverte en entier.",
    },
  },
  shortcuts: {
    title: "Raccourcis clavier",
    note: "Ils se taisent pendant que tu écris dans un champ.",
    keys: {
      space: "Espace",
      left: "Flèche gauche",
      right: "Flèche droite",
      fullscreen: "F",
      remark: "M",
      escape: "Échap",
    },
    actions: {
      play: "Lecture ou pause",
      previous: "Image précédente",
      next: "Image suivante",
      fullscreen: "Plein écran",
      remark: "Remarque à l'instant affiché",
      escape: "Quitter le plein écran",
    },
  },
  drawingKeyboard: {
    area: (kind: string) => `Tracé au clavier : ${kind}`,
    help: "Au clavier : les flèches déplacent le repère (avec Maj, dix fois plus vite), Entrée pose le point, Retour arrière reprend le dernier, Échap annule.",
    cursor: (x: number, y: number) => `Repère à ${x} % de la gauche et ${y} % du haut.`,
    placed: (index: number, total: number, x: number, y: number) =>
      `Point ${index} sur ${total} posé à ${x} % de la gauche et ${y} % du haut.`,
    ready: "Tracé prêt. Entrée pour écrire la remarque, Retour arrière pour reprendre le dernier point.",
    moveFirst: "Déplace le repère avant de poser le point suivant.",
    undone: (index: number) => `Point ${index} repris : déplace-le, puis Entrée.`,
    cancelled: "Tracé annulé.",
  },
} as const;
