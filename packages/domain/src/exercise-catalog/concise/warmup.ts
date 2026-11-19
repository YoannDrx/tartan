import type { ConciseCatalog } from "./rules";

// Version concise des guides de la famille, variantes comprises. Le texte complet reste celui de la fiche.
export const WARMUP_CONCISE: ConciseCatalog = {
  "warmup-jog": {
    objective: "Mettre progressivement le corps en mouvement avant la séance.",
    setup: "Zone régulière, durée facile fixée avant les éducatifs.",
    steps: [
      "Pars lentement, foulée naturelle.",
      "Augmente un peu le rythme en restant capable de parler.",
      "Termine sans accélérer à fond et passe aux mouvements préparatoires.",
    ],
    mistakes: ["Partir à l'allure de la séance principale.", "Prolonger au point d'entamer la séance."],
    easier: "Marche active, puis marche et course alternées.",
    harder: "Un peu plus long selon la séance prévue.",
  },
  "ankle-walking-drill": {
    objective: "Coordonner un déroulé actif du pied pendant une marche courte.",
    setup: "Couloir libre, petits pas, buste haut.",
    steps: [
      "Déroule le pied d'appui jusqu'à l'avant-pied, sans monter haut.",
      "Ramène l'autre pied sous le bassin.",
      "Alterne avec une progression lente et régulière.",
    ],
    mistakes: ["Allonger les pas devant le corps.", "Raidir les genoux pour se grandir."],
    easier: "Déroulé sur place, une main en appui.",
    harder: "Relier à une petite course technique.",
  },
  "jumping-jacks": {
    objective: "Coordonner l'ouverture des bras et des jambes en échauffement.",
    setup: "Espace libre autour de toi et au-dessus de la tête.",
    steps: [
      "Saute légèrement, pieds écartés et bras levés.",
      "Reçois-toi en souplesse, puis pieds joints et bras le long du corps.",
      "Rythme modéré, réceptions silencieuses.",
    ],
    mistakes: ["Réceptionner jambes verrouillées.", "Accélérer sans contrôler la coordination."],
    easier: "Ouvrir une jambe après l'autre, sans saut.",
    harder: "Durée un peu plus longue, rythme stable.",
  },
  "easy-jump-rope": {
    objective: "Installer de petits rebonds réguliers avec la corde.",
    setup: "Corde adaptée, sol dégagé, assez de hauteur et d'espace autour.",
    steps: [
      "Fais tourner la corde avec les poignets, coudes près du corps.",
      "Petits sauts, juste assez hauts pour laisser passer la corde.",
      "Genoux souples ; ralentis avant d'arrêter.",
    ],
    mistakes: ["Tourner avec de grands cercles d'épaules.", "Sauter très haut pour rattraper un rythme irrégulier."],
    easier: "Simuler la corde sans matériel.",
    harder: "Séquences un peu plus longues, même hauteur.",
  },
  "arm-circles": {
    objective: "Préparer progressivement les mouvements des épaules.",
    setup: "Debout, espace autour, côtes et bassin stables.",
    steps: [
      "Dessine de petits cercles avec les bras.",
      "Agrandis un peu le cercle si le mouvement reste confortable.",
      "Change de sens sans prendre d'élan.",
    ],
    mistakes: ["Cambrer pour gagner de l'amplitude.", "Faire de grands cercles rapides dès le départ."],
    easier: "Cercles plus petits, coudes fléchis.",
    harder: "Bras en sens opposés, petite amplitude.",
  },
  "leg-swings": {
    objective: "Préparer flexion et extension de hanche par un balancement contrôlé.",
    setup: "Une main sur un support fixe, appui sur une jambe.",
    steps: [
      "Balance doucement la jambe libre vers l'avant puis l'arrière.",
      "Bassin de face, tronc stable.",
      "Augmente l'amplitude tant que le mouvement reste contrôlé.",
    ],
    mistakes: ["Projeter la jambe avec un à-coup.", "Cambrer à chaque passage vers l'arrière."],
    easier: "Petits balancements lents.",
    harder: "Moins d'aide de la main, équilibre gardé.",
  },
  "lateral-band-walk": {
    objective: "Activer le contrôle latéral des hanches.",
    setup: "Élastique adapté au-dessus des genoux, légère flexion des jambes.",
    steps: [
      "Petit pas sur le côté sans laisser les genoux rentrer.",
      "Rapproche l'autre pied en gardant un peu de tension.",
      "Répète, puis change de direction.",
    ],
    mistakes: ["Balancer le buste pour déplacer les pieds.", "Prendre une tension qui fait rentrer les genoux."],
    easier: "Élastique plus souple, ou sans élastique.",
    harder: "Élastique plus bas si les appuis tiennent.",
  },
  "band-clamshell": {
    objective: "Activer la rotation de hanche sans tourner le bassin.",
    setup: "Sur le côté, genoux fléchis, pieds superposés ; élastique léger si prescrit.",
    steps: [
      "Pieds en contact, ouvre doucement le genou du dessus.",
      "Arrête avant que le bassin roule en arrière.",
      "Referme lentement sans laisser tomber le genou.",
    ],
    mistakes: ["Tourner tout le bassin pour ouvrir davantage.", "Prendre une résistance trop forte."],
    easier: "Sans élastique.",
    harder: "Courte pause en position ouverte.",
  },
  "scapular-push-up": {
    objective: "Mobiliser les omoplates en gardant les coudes tendus.",
    setup: "Planche mains au sol ou sur un support stable.",
    steps: [
      "Laisse le thorax descendre entre les épaules, coudes tendus.",
      "Repousse le sol pour éloigner le thorax des mains.",
      "Garde le bassin aligné pendant ce petit mouvement.",
    ],
    mistakes: ["Plier les coudes comme dans une pompe.", "Creuser le dos pour gagner de l'amplitude."],
    easier: "Mains sur un mur ou genoux au sol.",
    harder: "En planche complète, bassin immobile.",
  },
  "walking-knee-hug": {
    objective: "Alterner équilibre sur une jambe et flexion contrôlée de hanche.",
    setup: "Couloir libre, départ debout, pieds sous le bassin.",
    steps: [
      "Monte un genou, accompagne-le des mains sans tirer brutalement.",
      "Buste haut, jambe d'appui stable.",
      "Repose le pied devant, puis change de côté.",
    ],
    mistakes: ["Arrondir le dos pour rapprocher le genou.", "Tirer fort sur le genou ou perdre l'équilibre."],
    easier: "Sur place, avec un support.",
    harder: "Pas enchaînés, courte tenue à chaque genou.",
  },
};
