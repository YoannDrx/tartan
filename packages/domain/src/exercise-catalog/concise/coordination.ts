import type { ConciseCatalog } from "./rules";

// Version concise des guides de la famille, variantes comprises. Le texte complet reste celui de la fiche.
export const COORDINATION_CONCISE: ConciseCatalog = {
  "cone-slalom": {
    objective: "Adapter les appuis à une trajectoire courbe répétée.",
    setup: "Plots espacés pour passer en fluidité, sans freinage brutal.",
    steps: [
      "Entre dans le slalom à vitesse modérée.",
      "Contourne chaque plot en orientant peu à peu appuis et bassin.",
      "Sors du parcours, puis ralentis dans une zone libre.",
    ],
    mistakes: ["Croiser les pieds sans le vouloir près des plots.", "Accélérer avant de maîtriser la trajectoire."],
    easier: "Marcher puis trottiner, plots plus espacés.",
    harder: "Plots un peu plus serrés, même vitesse.",
  },
  "square-footwork": {
    objective: "Enchaîner des déplacements dans quatre directions.",
    setup: "Quatre plots en carré, sens du parcours fixé avant de partir.",
    steps: [
      "Avance au premier angle, freine avant de changer de direction.",
      "Enchaîne les côtés selon la consigne, buste contrôlé.",
      "Termine le tour sans couper les angles.",
    ],
    mistakes: ["Tourner sur un pied bloqué au sol.", "Improviser le parcours en confondant les sens."],
    easier: "Parcours en marchant.",
    harder: "Changement de sens annoncé par le coach.",
  },
  "cone-side-shuffle": {
    objective: "Se déplacer latéralement sans croiser les appuis.",
    setup: "Deux plots assez écartés, regard devant toi.",
    steps: [
      "Prends une légère flexion des jambes.",
      "Pousse du pied opposé, rapproche l'autre sans les heurter.",
      "Freine avant le plot et repars dans l'autre sens.",
    ],
    mistakes: ["Croiser les pieds malgré la consigne.", "Se redresser complètement à chaque appui."],
    easier: "Moins de distance et de vitesse.",
    harder: "Signal de changement de direction.",
  },
  "cone-ladder-feet": {
    objective: "Coordonner une suite d'appuis dans des espaces réguliers.",
    setup: "Deux rangées de plots bas en cases, motif simple : deux appuis par case.",
    steps: [
      "Entre dans chaque case avec deux petits appuis.",
      "Pieds sous le bassin, bras coordonnés.",
      "Continue jusqu'à la sortie sans sauter de case.",
    ],
    mistakes: ["Regarder ses pieds en pliant le buste.", "Aller plus vite que le rythme maîtrisé."],
    easier: "Marcher dans les cases.",
    harder: "Cadence un peu plus haute, puis autre motif.",
  },
  "cone-t-run": {
    objective: "Associer course avant, pas latéraux et retour en arrière.",
    setup: "Quatre plots en T : base vers centre, côtés en pas chassés, retour.",
    steps: [
      "Cours de la base au centre, puis freine.",
      "Parcours les côtés en pas chassés, buste face à la base.",
      "Reviens au centre, puis recule prudemment au départ.",
    ],
    mistakes: ["Reculer sans avoir vérifié la zone.", "Tourner tout le corps sur la portion latérale."],
    easier: "Chaque portion à part, à petite vitesse.",
    harder: "Parcours enchaîné, freinages réguliers.",
  },
  "reactive-cone-call": {
    objective: "Choisir une direction sur un signal, puis freiner sous contrôle.",
    setup: "Quelques plots identifiés autour d'un centre, signaux clairs convenus.",
    steps: [
      "Attends au centre dans une position disponible.",
      "Au signal, rejoins le plot annoncé à appuis courts.",
      "Freine, puis reviens au centre avant le signal suivant.",
    ],
    mistakes: ["Anticiper systématiquement le signal.", "Annoncer une direction en plein freinage non maîtrisé."],
    easier: "Deux directions, en marchant.",
    harder: "Une direction de plus, pas plus de vitesse.",
  },
  carioca: {
    objective: "Coordonner croisements avant et arrière en se déplaçant de côté.",
    setup: "Couloir latéral libre, départ lent.",
    steps: [
      "Croise un pied devant l'autre, puis ouvre le pas sur le côté.",
      "Croise ensuite derrière, puis ouvre à nouveau.",
      "Laisse le bassin tourner un peu, épaules relâchées.",
    ],
    mistakes: ["Confondre croisement avant et arrière.", "Accélérer alors que les pieds se heurtent."],
    easier: "Le motif en marchant.",
    harder: "Plus de fluidité, puis changer de sens.",
  },
  "forward-back-cones": {
    objective: "Passer de la course avant à un déplacement arrière contrôlé.",
    setup: "Deux lignes proches ; vérifie l'espace derrière toi avant de partir.",
    steps: [
      "Avance jusqu'à la ligne, ralentis puis arrête-toi.",
      "Recule à petits pas, pieds disponibles sous le bassin.",
      "Freine à la ligne de départ et repars vers l'avant.",
    ],
    mistakes: ["Se jeter en arrière à grands pas.", "Changer de sens sur un appui verrouillé."],
    easier: "Marcher dans les deux sens.",
    harder: "Un peu plus vite, freinage toujours visible.",
  },
  "figure-eight-cones": {
    objective: "Enchaîner deux courbes opposées sans interruption.",
    setup: "Deux plots assez éloignés, trajet en huit, croisement central libre.",
    steps: [
      "Contourne le premier plot en courbe régulière.",
      "Traverse le centre, puis réoriente peu à peu le corps.",
      "Contourne le second plot et répète selon la consigne.",
    ],
    mistakes: ["Couper le centre par un changement brutal.", "Regarder le sol juste devant les pieds."],
    easier: "Marcher sur un grand huit.",
    harder: "Courbes peu à peu plus serrées, vitesse modérée.",
  },
  "zigzag-cuts": {
    objective: "Freiner puis repartir vers une nouvelle direction en angle.",
    setup: "Plots en zigzag, angles modérés, surface non glissante.",
    steps: [
      "Approche le plot en ralentissant avant l'appui de changement.",
      "Oriente pied et bassin vers la sortie, sans tordre sur un pied fixé.",
      "Repousse vers le plot suivant et recommence.",
    ],
    mistakes: ["Freiner sur un seul appui loin devant le corps.", "Tourner le genou sans réorienter les appuis."],
    easier: "Angles plus ouverts, parcours marché.",
    harder: "Approche plus rapide si le freinage tient.",
  },
};
