export const encouragementTones = ["calm", "energetic", "off"] as const;
export type EncouragementTone = (typeof encouragementTones)[number];
export const encouragementLabels = {
  modeTitle: "Mode séance",
  title: "Encouragements",
  home: "Sur mon accueil",
  session: "Pendant ma séance",
  calm: "Calme",
  energetic: "Énergique",
  off: "Désactivé",
};
const mantras = {
  calm: [
    "Aujourd’hui, choisis un geste à soigner.",
    "Prends le temps de trouver ton rythme.",
    "Un repère simple suffit pour commencer.",
    "Observe ton premier appui.",
    "Accorde autant de soin au repos qu’au mouvement.",
    "Reviens à la consigne qui t’aide.",
    "Avant de partir, visualise ton premier geste.",
    "Laisse une place à ce que tu apprends.",
    "Pose les épaules, puis prends ton départ.",
    "Une répétition à la fois.",
    "Remarque un détail qui devient plus facile.",
    "Ton objectif du jour peut tenir en un mot.",
    "Cherche le rythme qui te convient aujourd’hui.",
    "Commence avec curiosité.",
    "Un appui précis se construit tranquillement.",
    "La séance commence là où tu en es.",
    "Entre deux essais, prends le temps de souffler.",
    "Regarde le repère devant toi.",
    "Garde en tête une sensation que tu veux retrouver.",
    "Prends un instant pour préparer ton matériel.",
    "Un geste familier peut encore t’apprendre quelque chose.",
    "Soigne ton installation avant la première série.",
    "Une pause fait partie du travail.",
    "Aujourd’hui, observe ce que tu sais déjà faire.",
    "Entre sur la piste à ton rythme.",
    "Reste disponible pour la prochaine consigne.",
    "Écoute le rythme de tes appuis.",
    "À chaque passage, retrouve ton point de départ.",
    "Un détail bien choisi donne une direction à ta séance.",
    "En fin de séance, garde un souvenir précis.",
  ],
  energetic: [
    "Un objectif pour la séance. À toi de jouer !",
    "Choisis ton repère et prends ton élan !",
    "Trouve ton rythme dès l’échauffement.",
    "Fais compter ce premier appui !",
    "Aujourd’hui, soigne ta sortie de mouvement.",
    "Prêt pour un nouveau passage ?",
    "Pose tes marques et lance-toi !",
    "Mets de la précision dans ton premier geste.",
    "Un départ, une intention !",
    "Prépare ton matériel et entre en piste !",
    "Choisis le détail que tu veux réussir.",
    "Garde le regard sur ton prochain repère.",
    "Prends ta place sur la piste !",
    "Derniers réglages, puis à toi !",
    "Repars avec une consigne claire.",
    "Fais de la place à un geste nouveau !",
    "Rassemble ton attention pour la première série.",
    "Une bonne récupération prépare la suite !",
    "Mets du rythme dans tes appuis !",
    "Accroche ton regard à ta marque.",
    "Ton prochain passage commence maintenant !",
    "Prends une respiration et fais ton entrée.",
    "À toi de trouver le bon tempo !",
    "Choisis ton intention avant le départ.",
    "Marque le rythme du premier exercice !",
    "Savoure le geste qui tombe juste.",
    "Lance ta séance avec un objectif simple !",
    "Retrouve ton repère, puis repars !",
    "À toi de soigner ce dernier détail.",
    "En piste pour une séance à ton rythme !",
  ],
};
const feedback = {
  calm: {
    last: [
      "Une dernière série, avec le même soin.",
      "Retrouve ton repère pour cette dernière série.",
      "Une série encore, à ton rythme.",
    ],
    exercise: [
      "Exercice terminé. Prends ta récupération.",
      "Ce mouvement est terminé. Souffle un instant.",
      "Garde un repère de cet exercice pour la prochaine fois.",
    ],
    done: [
      "Séance enregistrée.",
      "Ta séance est dans ton carnet.",
      "Prends un instant pour retenir un geste de la séance.",
    ],
    partial: [
      "Ta séance partielle est enregistrée.",
      "Les séries que tu as réalisées sont dans ton carnet.",
      "Ton travail du jour est consigné.",
    ],
  },
  energetic: {
    last: [
      "Dernière série. Garde ton rythme !",
      "À toi pour la dernière série !",
      "Un dernier passage avec ton repère !",
    ],
    exercise: [
      "Exercice bouclé. Souffle un coup !",
      "Ce mouvement est terminé. Place à la récupération !",
      "Bien joué sur cet exercice !",
    ],
    done: [
      "C’est fait. Bien joué pour la séance !",
      "Séance enregistrée. Tu peux souffler !",
      "Voilà une séance de plus dans ton carnet !",
    ],
    partial: [
      "Ton travail du jour est enregistré. Bien joué !",
      "Ces séries comptent. Elles sont dans ton carnet !",
      "Séance partielle enregistrée. Merci pour ton retour !",
    ],
  },
};
export type EncouragementEvent = keyof typeof feedback.calm;
export function dailyMantra(tone: EncouragementTone = "calm", now = new Date()) {
  if (tone === "off") return null;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const index = Math.floor(Date.parse(date + "T00:00:00Z") / 86400000);
  return mantras[tone][((index % 30) + 30) % 30]!;
}
export function encouragement(tone: EncouragementTone, event: EncouragementEvent, seed: string) {
  if (tone === "off") return null;
  let hash = 0;
  for (const letter of seed) hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0;
  return feedback[tone][event][hash % 3]!;
}
