import type { ConciseCatalog } from "./rules";

// Version concise des guides de la famille, variantes comprises. Le texte complet reste celui de la fiche.
export const STAIRS_CONCISE: ConciseCatalog = {
  "stair-walk": {
    objective: "Monter régulièrement en poussant sur chaque appui.",
    setup: "Escalier régulier, sec, libre de passage, avec rampe accessible.",
    steps: [
      "Pose le pied sur la marche avec assez de surface d'appui.",
      "Pousse pour monter, alterne, sans te tirer avec les bras.",
      "Arrive sur le palier, ralentis, redescends en marchant.",
    ],
    mistakes: ["Ne poser que le bout du pied sur le bord.", "Continuer quand quelqu'un entre dans le parcours."],
    easier: "Monter lentement, aide légère de la rampe.",
    harder: "Montée plus longue, pas plus rapide.",
  },
  "single-leg-stair-hops": {
    objective: "Monter par petites impulsions sur la même jambe.",
    setup: "Marches basses, larges, sèches, sortie libre ; niveau validé par le coach.",
    steps: [
      "Appui sur une jambe devant la première marche.",
      "Bondis sur la marche suivante, genou stable dans l'axe.",
      "Continue si l'appui reste précis ; autre côté à la montée suivante.",
    ],
    mistakes: ["Se réceptionner sur le bord des marches.", "Viser plusieurs marches d'un coup sans contrôle."],
    easier: "Montée sur une marche sans saut.",
    harder: "Plus de marches basses, réceptions stables.",
  },
  "quick-stair-run": {
    objective: "Coordonner des appuis rapides, une marche à la fois.",
    setup: "Escalier bas et régulier, chaque marche permettant un appui sûr.",
    steps: [
      "Monte à petits appuis alternés, un pied par marche.",
      "Bassin haut, bras coordonnés, sans tirer le buste en avant.",
      "Ralentis sur le palier, puis redescends en marchant.",
    ],
    mistakes: ["Accélérer au point de manquer une marche.", "Regarder seulement ses pieds en pliant le buste."],
    easier: "Montée marchée, même rythme alterné.",
    harder: "Cadence en hausse sur le même petit escalier.",
  },
  "alternating-stair-bounds": {
    objective: "Relier des poussées alternées sur des marches adaptées.",
    setup: "Marches basses et profondes ; le coach fixe les marches par bond.",
    steps: [
      "Pousse sur une jambe, accompagne avec le genou libre.",
      "Reçois-toi sur l'autre jambe, appui sûr sur la marche.",
      "Alterne en gardant le rythme ; stabilise sur le palier.",
    ],
    mistakes: ["Bondir au-delà de la surface de réception.", "Continuer malgré des appuis imprécis."],
    easier: "Montée marchée dynamique, sans phase de vol.",
    harder: "Quelques bonds de même qualité, même hauteur.",
  },
  "lateral-stair-walk": {
    objective: "Monter de côté en gardant les appuis parallèles.",
    setup: "De côté devant un escalier large, rampe accessible, chaussures adhérentes.",
    steps: [
      "Pose le pied le plus proche sur la marche du dessus.",
      "Pousse pour monter, puis ramène l'autre pied sur la même marche.",
      "Répète sans croiser ; change de côté sur une autre montée.",
    ],
    mistakes: ["Croiser les appuis sans le vouloir.", "Tourner le buste vers la montée, bassin de côté."],
    easier: "Une seule marche, une main en appui.",
    harder: "Plusieurs marches sans appui des mains.",
  },
  "two-foot-stair-jumps": {
    objective: "Sauter à deux pieds et se stabiliser sur la marche suivante.",
    setup: "Quelques marches basses, profondes et sèches, arrivée dégagée.",
    steps: [
      "Fléchis légèrement les jambes devant la première marche.",
      "Saute sur la suivante, les deux pieds bien posés.",
      "Stabilise avant le saut suivant ; redescends en marchant.",
    ],
    mistakes: ["Rebondir sans vérifier où se posent les pieds.", "Marches trop étroites pour les deux appuis."],
    easier: "Petit saut sur une seule marche basse.",
    harder: "Plusieurs sauts reliés, chaque réception stable.",
  },
  "stair-step-down": {
    objective: "Freiner la descente du corps sur une jambe.",
    setup: "Sur une marche basse, rampe à portée, pied libre près du bord.",
    steps: [
      "Fléchis la jambe d'appui pour descendre le talon libre vers le sol.",
      "Touche à peine le sol sans y transférer le poids.",
      "Repousse avec la jambe restée sur la marche pour revenir.",
    ],
    mistakes: ["Laisser tomber le bassin d'un côté.", "Prendre de l'élan avec le pied qui touche le sol."],
    easier: "Marche plus basse, main sur la rampe.",
    harder: "Descente plus lente, puis marche plus haute.",
  },
  "stair-knee-balance": {
    objective: "Terminer une montée en équilibre sur une jambe.",
    setup: "Marche basse et profonde, support de main à portée.",
    steps: [
      "Pose un pied sur la marche et pousse pour monter.",
      "Monte le genou libre, tiens un instant sans passer sur la pointe.",
      "Repose le pied libre au sol, puis répète du même côté.",
    ],
    mistakes: ["Sauter du pied du bas pour atteindre la position haute.", "Tourner le bassin pendant l'équilibre."],
    easier: "Monter sans lever le genou libre.",
    harder: "Tenue un peu plus longue, sans la main.",
  },
  "cross-step-stairs": {
    objective: "Croiser les pieds de côté sur des marches larges.",
    setup: "De côté, marches larges et basses, rampe à portée ; commence en marchant.",
    steps: [
      "Croise le pied éloigné devant l'autre sur la marche du dessus.",
      "Transfère le poids sans tordre le genou, puis ramène l'autre pied.",
      "Recommence lentement, chaque appui bien sûr.",
    ],
    mistakes: ["Croiser sur une marche trop étroite.", "Tourner le bassin alors que le pied reste bloqué."],
    easier: "Pas croisés au sol, puis montée latérale simple.",
    harder: "Transitions plus fluides, sans viser la vitesse.",
  },
  "stair-bear-crawl": {
    objective: "Coordonner mains et pieds dans une montée lente.",
    setup: "Marches larges, propres, sans arête glissante ou coupante.",
    steps: [
      "Mains sur les marches du haut, pieds dessous, genoux un peu décollés.",
      "Avance une main et le pied opposé, appuis sûrs.",
      "Monte lentement au palier, relève-toi, redescends en marchant.",
    ],
    mistakes: ["Aller vite au prix d'une main mal posée.", "Mettre tout le poids sur une arête de marche."],
    easier: "Déplacement à quatre appuis au sol.",
    harder: "Quelques marches de plus, sans accélérer.",
  },
};
