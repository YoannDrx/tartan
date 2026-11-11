// Jetons de mouvement (DESIGN.md, « Mouvement »). Source unique pour le web et le mobile.
// Aucune durée ni courbe ne s'écrit ailleurs : le CSS en est un miroir contrôlé par les tests.
export const motion = {
  // En millisecondes.
  duration: {
    // Retour immédiat d'un geste : pression, survol.
    instant: 80,
    // Changement d'état d'un contrôle : couleur, coche, rotation d'un chevron.
    quick: 150,
    // Plafond de toute animation sur le chemin de validation de l'athlète.
    base: 200,
    // Entrée d'une feuille, d'un menu, d'un dialogue : plafond des écrans de travail.
    enter: 260,
    // Tracé d'une ligne ou d'une coche.
    trace: 320,
    // Apparition expressive : site, accueils, états vides.
    expressive: 420,
    // Grand moment : validation d'une séance, record.
    celebration: 1150,
    // Période d'un mouvement d'ambiance qui boucle, comme un clignement.
    ambient: 4400,
  },
  // Trois courbes, nommées d'après le geste.
  easing: {
    // Prise de vitesse : ce qui quitte l'écran.
    elan: "cubic-bezier(0.4, 0, 1, 1)",
    // Départ et arrivée marqués, sans dépassement : ce qui se déplace d'un point à un autre.
    impulsion: "cubic-bezier(0.65, 0, 0.35, 1)",
    // Amorti : ce qui arrive et se pose.
    reception: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  // Cascade : un décalage par élément, jamais plus de six éléments dans un écran de travail.
  stagger: { step: 34, max: 6 },
} as const;

export type MotionDuration = keyof typeof motion.duration;
export type MotionEasing = keyof typeof motion.easing;
