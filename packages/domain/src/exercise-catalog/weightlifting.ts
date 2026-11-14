import type { CatalogueDraft } from "./types";

type Lift = Pick<
  CatalogueDraft,
  "key" | "name" | "aliases" | "objective" | "setup" | "steps" | "mistakes" | "easier" | "progression"
>;

const lifts: Lift[] = [
  {
    key: "snatch",
    name: "Arraché",
    aliases: ["Snatch", "Squat snatch"],
    objective: "Amener la barre du sol au-dessus de la tête en un seul mouvement avec réception fléchie.",
    setup:
      "Sur une plateforme dégagée, utilise une barre technique ; règle une prise large avec le coach et place la barre près des tibias. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Pousse le sol en gardant la barre proche et les bras longs jusqu'à l'extension des jambes et des hanches.",
      "Passe rapidement sous la barre et reçois-la bras tendus au-dessus de la tête, en flexion de jambes.",
      "Stabilise la barre au-dessus de la base d'appui puis relève-toi ; repose selon la procédure apprise sur la plateforme.",
    ],
    mistakes: [
      "Tirer avec les bras avant la poussée des jambes.",
      "Recevoir la barre trop en avant ou poursuivre une réception instable.",
    ],
    easier: "Arraché musclé au bâton puis apprentissage séparé de la réception.",
    progression: "Relier les phases avec une barre légère sous observation du coach.",
  },
  {
    key: "clean",
    name: "Épaulé",
    aliases: ["Clean", "Squat clean"],
    objective: "Amener la barre du sol sur l'avant des épaules avec une réception fléchie.",
    setup:
      "Sur une plateforme dégagée, place la barre près des tibias et les mains juste à l'extérieur des jambes. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Pousse le sol en gardant la barre proche, puis termine l'extension des jambes et des hanches.",
      "Passe sous la barre et tourne les coudes vers l'avant pour la recevoir sur les épaules en flexion de jambes.",
      "Stabilise la réception puis relève-toi avec les coudes hauts.",
    ],
    mistakes: [
      "Recevoir la barre dans les mains au lieu des épaules.",
      "Tirer tôt avec les bras ou laisser la barre s'éloigner.",
    ],
    easier: "Épaulé suspension avec barre technique et réception peu fléchie.",
    progression: "Augmenter la profondeur de réception puis relier le départ du sol.",
  },
  {
    key: "split-jerk",
    name: "Jeté en fente",
    aliases: ["Split jerk", "Jeté"],
    objective: "Propulser une barre des épaules au-dessus de la tête puis la stabiliser en fente.",
    setup:
      "Prends la barre sur l'avant des épaules depuis un rack, mains en prise de jeté ; prépare une zone dégagée devant et derrière. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Effectue une courte flexion verticale puis pousse vivement avec les jambes.",
      "Passe sous la barre bras tendus en décalant les pieds en fente, bassin sous la charge.",
      "Stabilise puis rapproche les pieds progressivement, généralement pied avant d'abord ; redescends selon la procédure apprise.",
    ],
    mistakes: [
      "Pencher le buste dans la flexion préparatoire.",
      "Placer les pieds sur une ligne trop étroite ou réceptionner les bras encore fléchis.",
    ],
    easier: "Déplacement en fente sans barre puis jeté au bâton.",
    progression: "Relier épaulé et jeté après maîtrise de chaque phase.",
  },
  {
    key: "clean-and-jerk",
    name: "Épaulé-jeté",
    aliases: ["Clean and jerk", "Clean & jerk"],
    objective: "Enchaîner un épaulé puis un jeté avec une stabilisation entre les deux mouvements.",
    setup:
      "Prépare une plateforme et une barre adaptée à la maîtrise des deux gestes ; la zone de réception doit être libre. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Épaule la barre et relève-toi complètement avec la barre soutenue par les épaules.",
      "Retrouve l'équilibre, ajuste la prise si nécessaire et prépare une flexion verticale.",
      "Propulse la barre et passe en fente bras tendus ; stabilise puis rapproche les pieds avant de reposer.",
    ],
    mistakes: [
      "Déclencher le jeté avant d'être stable après l'épaulé.",
      "Confondre une répétition complète avec un seul des deux mouvements.",
    ],
    easier: "Travailler épaulé et jeté séparément avec une barre technique.",
    progression: "Enchaîner avec une charge légère reproductible, sous observation du coach.",
  },
  {
    key: "power-snatch",
    name: "Arraché puissance",
    aliases: ["Power snatch", "Arraché debout", "Arraché force"],
    objective: "Amener la barre au-dessus de la tête avec une réception au-dessus de la position accroupie.",
    setup:
      "Place une barre légère au sol, prise large réglée et pieds en position de tirage. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Pousse le sol en gardant la barre proche jusqu'à l'extension.",
      "Passe sous la barre avec une flexion limitée des jambes et verrouille les bras.",
      "Stabilise puis termine debout avant de reposer.",
    ],
    mistakes: [
      "Écarter excessivement les pieds pour éviter de fléchir.",
      "Confondre réception haute et absence totale de passage sous la barre.",
    ],
    easier: "Arraché musclé au bâton.",
    progression: "Départ en suspension puis départ du sol à trajectoire maîtrisée.",
  },
  {
    key: "power-clean",
    name: "Épaulé puissance",
    aliases: ["Power clean", "Épaulé debout", "Épaulé force"],
    objective: "Recevoir la barre sur les épaules avec une flexion limitée des jambes.",
    setup:
      "Barre légère proche des tibias, mains à l'extérieur des jambes et espace de réception dégagé. En cas d'échec, lâche la barre et écarte-toi : disques en caoutchouc et plateforme dégagée, jamais de barre retenue à bout de bras.",
    steps: [
      "Pousse avec les jambes puis termine l'extension des hanches sans tirer tôt avec les bras.",
      "Tourne rapidement les coudes et passe légèrement sous la barre.",
      "Reçois sur les épaules, stabilise et termine debout.",
    ],
    mistakes: [
      "Recevoir sur les poignets avec les coudes bas.",
      "Sauter les pieds très largement pour gagner de la hauteur de réception.",
    ],
    easier: "Épaulé depuis la suspension haute avec barre technique.",
    progression: "Relier le départ du sol puis travailler une réception plus fléchie.",
  },
  {
    key: "hang-snatch",
    name: "Arraché suspension au-dessus des genoux",
    aliases: ["Hang snatch above knee"],
    objective: "Travailler le rapprochement de la barre et le passage sous la barre sans départ du sol.",
    setup:
      "Debout, barre légère tenue en prise large ; recule les hanches pour placer la barre juste au-dessus des genoux.",
    steps: [
      "Garde la pression dans les pieds et la barre près des cuisses.",
      "Étends jambes et hanches puis passe sous la barre.",
      "Reçois bras tendus en flexion, stabilise puis relève-toi.",
    ],
    mistakes: [
      "Laisser la barre partir loin du corps à la descente.",
      "Prendre un élan de balancier avec les épaules.",
    ],
    easier: "Départ de suspension plus haute avec un bâton.",
    progression: "Abaisser le départ jusqu'au-dessous des genoux avec contrôle du coach.",
  },
  {
    key: "hang-clean",
    name: "Épaulé suspension au-dessus des genoux",
    aliases: ["Hang clean above knee"],
    objective: "Travailler la poussée finale et la réception de l'épaulé sans départ du sol.",
    setup:
      "Tiens une barre légère devant les cuisses puis recule les hanches jusqu'à la suspension juste au-dessus des genoux.",
    steps: [
      "Garde les bras longs et la barre proche des cuisses.",
      "Pousse avec les jambes, étends les hanches puis tourne les coudes pour passer sous la barre.",
      "Reçois sur les épaules en flexion et relève-toi après stabilisation.",
    ],
    mistakes: ["Enrouler la barre comme un curl.", "Envoyer les hanches vers l'avant en éloignant la barre."],
    easier: "Suspension haute et barre technique.",
    progression: "Relier une descente contrôlée puis le mouvement sans perdre les appuis.",
  },
  {
    key: "snatch-pull",
    name: "Tirage d'arraché",
    aliases: ["Snatch pull"],
    objective: "Travailler la trajectoire et l'extension de l'arraché sans réception au-dessus de la tête.",
    setup: "Place la barre au sol avec la même prise large et les mêmes appuis que pour l'arraché.",
    steps: [
      "Pousse le sol et conserve la barre près des jambes.",
      "Termine l'extension des jambes et des hanches en gardant les bras longs ; accompagne la montée des épaules.",
      "Contrôle le retour de la barre et replace-toi avant de répéter.",
    ],
    mistakes: [
      "Chercher à monter la barre avec une flexion précoce des coudes.",
      "Exagérer une extension du dos vers l'arrière.",
    ],
    easier: "Tirage depuis des cales avec une barre légère.",
    progression: "Relier tirage et arraché dans des répétitions distinctes prescrites par le coach.",
  },
  {
    key: "clean-pull",
    name: "Tirage d'épaulé",
    aliases: ["Clean pull"],
    objective: "Travailler la poussée et la trajectoire de l'épaulé sans réception sur les épaules.",
    setup: "Barre proche des tibias et mains à l'extérieur des jambes, comme au départ d'un épaulé.",
    steps: [
      "Pousse le sol en gardant le dos contrôlé et la barre proche.",
      "Termine l'extension des jambes et des hanches avec les bras longs.",
      "Repose la barre sans à-coup et replace les appuis.",
    ],
    mistakes: ["Plier les bras avant d'avoir terminé la poussée.", "Décoller la barre en arrachant le buste."],
    easier: "Tirage depuis la suspension avec barre technique.",
    progression: "Ajouter une pause au passage des genoux puis relier l'extension.",
  },
  {
    key: "muscle-snatch",
    name: "Arraché musclé",
    aliases: ["Muscle snatch", "Arraché bras"],
    objective: "Apprendre la trajectoire de la barre et la rotation des bras sans nouvelle flexion de réception.",
    setup: "Utilise un bâton ou une barre très légère, prise large, départ en suspension haute.",
    steps: [
      "Allonge les jambes et guide la barre près du corps.",
      "Tourne les bras pour conduire la barre au-dessus de la tête sans repasser en flexion.",
      "Stabilise bras tendus puis redescends sous contrôle.",
    ],
    mistakes: ["Charger comme un arraché complet.", "Confondre le mouvement avec un développé éloigné du corps."],
    easier: "Répéter la trajectoire au bâton.",
    progression: "Arraché puissance léger avec apprentissage du passage sous la barre.",
  },
  {
    key: "tall-clean",
    name: "Épaulé sans élan",
    aliases: ["Tall clean"],
    objective: "Apprendre le passage sous la barre et la rotation rapide des coudes.",
    setup: "Debout, tiens une barre technique devant le haut des cuisses, sans préparation en flexion ni balancement.",
    steps: [
      "Démarre depuis la position haute sans tirer la barre par une nouvelle poussée des jambes.",
      "Descends sous la barre et tourne rapidement les coudes vers l'avant.",
      "Reçois sur les épaules, stabilise puis relève-toi.",
    ],
    mistakes: [
      "Prendre une flexion d'élan qui change l'éducatif.",
      "Utiliser une charge empêchant un passage rapide sous la barre.",
    ],
    easier: "Apprentissage de la position d'épaulé au bâton.",
    progression: "Relier l'éducatif à un épaulé depuis la suspension.",
  },
  {
    key: "overhead-squat",
    name: "Squat bras tendus au-dessus de la tête",
    aliases: ["Overhead squat", "OHS"],
    objective: "Contrôler la position de réception de l'arraché pendant une flexion de jambes.",
    setup: "Place un bâton ou une barre légère au-dessus de la tête en prise large, zone dégagée et pieds stables.",
    steps: [
      "Garde les bras tendus et la charge au-dessus de la base d'appui.",
      "Descends entre les pieds jusqu'à la profondeur maîtrisée.",
      "Remonte sans laisser la charge partir en avant.",
    ],
    mistakes: [
      "Forcer une profondeur qui oblige à fléchir les bras.",
      "Cambrer le dos pour compenser un manque de contrôle de l'épaule.",
    ],
    easier: "Squat au bâton à faible amplitude.",
    progression: "Approfondir progressivement la flexion avant d'augmenter la charge.",
  },
  {
    key: "jerk-dip",
    name: "Flexion préparatoire de jeté",
    aliases: ["Jerk dip"],
    objective: "Répéter la flexion verticale précédant le jeté avec la barre sur les épaules.",
    setup: "Prends une barre légère sur l'avant des épaules depuis le rack et garde les pieds à largeur de bassin.",
    steps: [
      "Verrouille la position du tronc et soutiens la barre avec les épaules.",
      "Fléchis brièvement les genoux, bassin sous la barre et appui réparti sur les pieds.",
      "Reviens debout sans projeter la barre ni ajouter de réception.",
    ],
    mistakes: [
      "Incliner le buste vers l'avant.",
      "Faire une flexion profonde qui ne correspond plus au départ du jeté.",
    ],
    easier: "Répéter sans charge devant un repère vertical.",
    progression: "Relier la flexion à une poussée puis au jeté léger.",
  },
  {
    key: "push-press",
    name: "Développé avec impulsion",
    aliases: ["Push press"],
    objective: "Utiliser une impulsion des jambes pour terminer la poussée de la barre avec les bras.",
    setup: "Barre sur les épaules, prise légèrement plus large que les épaules, pieds stables et zone dégagée.",
    steps: [
      "Effectue une courte flexion verticale.",
      "Pousse vivement avec les jambes puis termine bras tendus au-dessus de la tête.",
      "Reste debout sans seconde flexion de réception et redescends la barre sous contrôle.",
    ],
    mistakes: ["Confondre l'exercice avec un jeté en repassant sous la barre.", "Cambrer pour finir la poussée."],
    easier: "Développé militaire léger puis apprentissage séparé de l'impulsion.",
    progression: "Augmenter légèrement la charge tout en gardant une seule impulsion.",
  },
];

export const WEIGHTLIFTING_CATALOG: CatalogueDraft[] = lifts.map((lift) => ({
  ...lift,
  family: "weightlifting",
  category: "strength",
  movement:
    lift.key === "overhead-squat"
      ? "squat"
      : ["split-jerk", "jerk-dip", "push-press"].includes(lift.key)
        ? "push"
        : "hinge",
  equipment: ["barbell", ...(["split-jerk", "jerk-dip", "push-press"].includes(lift.key) ? ["rack" as const] : [])],
  level: "advanced",
  loadKind: "external_total",
  breathing:
    "Prépare l'appui respiratoire avant le mouvement ; réorganise ta respiration une fois stable. La coordination avec la charge s'apprend avec le coach.",
}));
