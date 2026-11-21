import type { ConciseCatalog } from "./rules";

// Version concise des guides de la famille, variantes comprises. Le texte complet reste celui de la fiche.
export const CORE_CONCISE: ConciseCatalog = {
  "front-plank": {
    objective: "Maintenir l'alignement du tronc en appui sur les avant-bras.",
    setup: "Avant-bras au sol, coudes sous les épaules, jambes allongées.",
    steps: [
      "Soulève le bassin : épaules, hanches et chevilles alignées.",
      "Pousse un peu dans les avant-bras et respire régulièrement.",
      "Repose les genoux avant que la position se dégrade.",
    ],
    mistakes: ["Laisser le bassin descendre et creuser le dos.", "Bloquer la respiration pendant la tenue."],
    easier: "Genoux au sol.",
    harder: "Un peu plus long, même alignement.",
  },
  "side-plank": {
    objective: "Garder bassin et tronc alignés sur le côté.",
    setup: "Sur le côté, coude sous l'épaule, pieds superposés ou décalés.",
    steps: [
      "Soulève le bassin en poussant dans l'avant-bras.",
      "Tête, tronc et bassin dans le même plan.",
      "Redescends lentement, puis change de côté.",
    ],
    mistakes: ["Tourner le thorax vers le sol.", "Laisser l'épaule s'écraser."],
    easier: "Genoux fléchis, appui sur le genou du dessous.",
    harder: "Lever un peu le bras du dessus, bassin fixe.",
  },
  "dead-bug": {
    objective: "Dissocier les membres en gardant le tronc stable.",
    setup: "Sur le dos, bras vers le plafond, hanches et genoux fléchis.",
    steps: [
      "Allonge lentement un bras et la jambe opposée.",
      "Arrête avant que le bas du dos se creuse ou que les côtes montent.",
      "Reviens au centre, puis change de côté.",
    ],
    mistakes: ["Chercher le sol en perdant la position du dos.", "Bouger trop vite pour rester contrôlé."],
    easier: "Une seule jambe, bras immobiles.",
    harder: "Leviers plus longs, tronc toujours contrôlé.",
  },
  "bird-dog": {
    objective: "Contrôler la rotation du bassin lors d'une extension croisée.",
    setup: "À quatre pattes, mains sous les épaules, genoux sous les hanches.",
    steps: [
      "Allonge un bras et la jambe opposée dans l'axe du corps.",
      "Bassin horizontal, jambe pas plus haute que le tronc.",
      "Reviens lentement à quatre appuis avant de changer.",
    ],
    mistakes: ["Ouvrir la hanche de la jambe levée.", "Cambrer pour lever davantage."],
    easier: "Une jambe ou un bras seulement.",
    harder: "Pause en extension, bassin immobile.",
  },
  "hollow-hold": {
    objective: "Garder le tronc stable, membres éloignés du centre.",
    setup: "Sur le dos, genoux fléchis, bras près du corps pour commencer.",
    steps: [
      "Décolle légèrement les épaules et engage le tronc.",
      "Éloigne jambes et bras tant que le bas du dos reste contrôlé.",
      "Tiens en respirant, puis replie les membres avant de relâcher.",
    ],
    mistakes: ["Allonger les jambes malgré une cambrure qui augmente.", "Coller le menton contre la poitrine."],
    easier: "Genoux fléchis, bras le long du corps.",
    harder: "Allonger les jambes, puis les bras.",
  },
  "pallof-press": {
    objective: "Résister à la rotation du tronc quand les mains s'éloignent.",
    setup: "Élastique à hauteur du thorax, de côté, pieds stables, mains à la poitrine.",
    steps: [
      "Pousse les mains devant toi sans tourner vers l'ancrage.",
      "Bassin et épaules orientés dans la même direction.",
      "Ramène les mains au thorax sous contrôle.",
    ],
    mistakes: ["Tourner le bassin quand les bras s'allongent.", "Prendre une tension qui oblige à se pencher."],
    easier: "Élastique plus souple, plus près de l'ancrage.",
    harder: "Allonger la pause bras tendus, puis la tension.",
  },
  "suitcase-carry": {
    objective: "Résister à l'inclinaison en portant une charge d'un côté.",
    setup: "Un haltère dans une main, couloir dégagé.",
    steps: [
      "Épaules à la même hauteur, bras chargé le long du corps.",
      "Marche à petits pas sans te pencher d'un côté ou de l'autre.",
      "Arrête-toi avant de reposer, puis change de côté.",
    ],
    mistakes: ["Se pencher loin de la charge pour compenser.", "Marcher trop vite pour contrôler le bassin."],
    easier: "Moins de charge, ou tenue sans marcher.",
    harder: "Plus de distance, même posture.",
  },
  "side-plank-hip-lift": {
    objective: "Contrôler montée et descente du bassin dans le plan latéral.",
    setup: "Sur un avant-bras, coude sous l'épaule, genoux fléchis ou jambes tendues.",
    steps: [
      "Abaisse légèrement le bassin sans tourner le tronc.",
      "Repousse le sol pour remonter dans l'alignement.",
      "Répète lentement, épaule stable.",
    ],
    mistakes: ["Tourner le bassin vers le sol.", "Descendre trop bas, épaule écrasée."],
    easier: "Gainage latéral statique sur les genoux.",
    harder: "Jambes allongées, puis plus d'amplitude.",
  },
  "reverse-crunch": {
    objective: "Enrouler un peu le bassin sans élan des jambes.",
    setup: "Sur le dos, hanches et genoux fléchis, bras en appui au sol.",
    steps: [
      "Rapproche un peu les genoux du buste en décollant le bassin.",
      "Mouvement court et contrôlé, sans pousser avec la tête.",
      "Repose progressivement le bassin avant de recommencer.",
    ],
    mistakes: ["Lancer les jambes pour arracher le bassin.", "Basculer jusqu'à la nuque."],
    easier: "Bascule du bassin, pieds au sol.",
    harder: "Descente plus lente, même petit mouvement.",
  },
  "slow-mountain-climber": {
    objective: "Bouger les jambes en gardant le tronc aligné, en appui mains.",
    setup: "Planche bras tendus, mains sous les épaules.",
    steps: [
      "Ramène lentement un genou vers le thorax.",
      "Bassin aussi stable que possible, dos pas trop arrondi.",
      "Replace la jambe, puis change de côté.",
    ],
    mistakes: ["Sautiller des pieds pour aller vite.", "Laisser le bassin monter à chaque changement."],
    easier: "Mains sur un support haut et fixe.",
    harder: "Pause plus longue, genou avancé.",
  },
  "hanging-knee-raise": {
    objective: "Renforcer la sangle abdominale, genoux remontés en suspension.",
    setup: "Suspendu à une barre fixe stable, bras tendus, épaules engagées.",
    steps: [
      "Remonte les genoux vers la poitrine sans te balancer.",
      "Enroule légèrement le bassin en haut.",
      "Redescends lentement jusqu'à la suspension.",
    ],
    mistakes: ["Prendre de l'élan.", "Lâcher la descente."],
    easier: "Relevé de genoux allongé au sol.",
    harder: "Remonter les jambes tendues.",
  },
  "ab-wheel-rollout": {
    objective: "Renforcer le gainage avant en allongeant le corps sans creuser.",
    setup: "À genoux sur un tapis, mains sur la roulette sous les épaules.",
    steps: [
      "Roule vers l'avant en gardant le bassin aligné.",
      "Arrête avant que le bas du dos ne se creuse.",
      "Ramène la roulette sous les épaules, tronc engagé.",
    ],
    mistakes: ["Creuser le bas du dos.", "Plier les hanches pour revenir."],
    easier: "Moins loin, ou rouler vers un mur.",
    harder: "Allonger peu à peu la distance.",
  },
};
