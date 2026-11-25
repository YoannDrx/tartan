export const pilots = [
  {
    key: "curve-pop-up",
    guideVersion: 6,
    imageVersion: 1,
    alt: "Le pied d’appel reste au sol au bout de la courbe balisée. Le genou libre monte devant le bassin.",
  },
  {
    key: "hop-step-stick",
    guideVersion: 6,
    imageVersion: 1,
    alt: "À la fin du cloche-pied, la jambe d’appui pousse et le genou opposé part vers la foulée suivante.",
  },
  {
    key: "cone-high-knees",
    guideVersion: 6,
    imageVersion: 1,
    alt: "Un genou levé, l’athlète pose le pied dans un couloir de plots disposés sur les côtés.",
  },
  {
    key: "snap-down",
    guideVersion: 6,
    imageVersion: 1,
    alt: "L’athlète termine la réception, deux pieds à plat, genoux fléchis et bras devant.",
  },
  {
    key: "clean-front-rack",
    guideVersion: 6,
    imageVersion: 1,
    alt: "En position basse, la barre repose sur les épaules, les pieds à plat et les coudes vers l’avant.",
  },
  {
    key: "kb-suitcase",
    guideVersion: 6,
    imageVersion: 1,
    alt: "L’athlète avance le buste droit, un kettlebell près de la cuisse dans une seule main.",
  },
  {
    key: "band-dorsiflexion",
    guideVersion: 6,
    imageVersion: 1,
    alt: "Assis, talon posé, l’athlète relève l’avant-pied contre une bande fixée devant la chaussure.",
  },
  {
    key: "easy-jump-rope",
    guideVersion: 5,
    imageVersion: 1,
    alt: "La corde passe au-dessus de la tête, une poignée dans chaque main et les deux pieds juste décollés.",
  },
  {
    key: "standing-calf-raise",
    guideVersion: 5,
    imageVersion: 1,
    alt: "Les talons montent ensemble, les avant-pieds restent au sol et une main touche le support.",
  },
  {
    key: "reverse-lunge",
    guideVersion: 5,
    imageVersion: 1,
    alt: "Le pied avant reste à plat et le genou arrière descend vers le sol, le buste haut.",
  },
  {
    key: "step-over-cone",
    guideVersion: 6,
    imageVersion: 1,
    alt: "Le pied passe au-dessus d’un plot souple pendant que l’autre jambe porte le corps.",
  },
  {
    key: "step-up",
    guideVersion: 5,
    imageVersion: 1,
    alt: "Le pied avant est posé en entier sur le banc et le pied arrière touche encore le sol.",
  },
] as const;

export const imagePath = (pilot: (typeof pilots)[number], thumb = false) =>
  `/exercise-photos/${pilot.key}-v${pilot.imageVersion}${thumb ? "-thumb" : ""}.webp`;
