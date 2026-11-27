// Retours sensoriels (DESIGN.md, « Mouvement et son ») : un vocabulaire unique pour le web et le mobile.
// Chaque retour a un son court, une vibration de téléphone (web) et un retour haptique (app native).
// Les sons sont synthétisés ici : le web les joue en direct, le mobile embarque les fichiers produits par
// `scripts/build-sounds.ts` à partir de la même fonction. Aucun son de tiers.

export const feedbackCues = ["tap", "select", "toggle", "setDone", "success", "restEnd", "error"] as const;
export type FeedbackCue = (typeof feedbackCues)[number];

// Une note : fréquence, départ et durée en millisecondes, volume relatif (0 à 1).
export type FeedbackNote = { hz: number; at: number; ms: number; gain: number };

// Retour haptique natif : `impact` léger ou moyen, `selection`, ou une notification système.
export type FeedbackHaptic = "light" | "medium" | "selection" | "success" | "warning" | "error";

export type FeedbackSpec = {
  notes: readonly FeedbackNote[];
  haptic: FeedbackHaptic;
  // Motif de `navigator.vibrate` sur téléphone ; vide : pas de vibration (le toucher seul suffit).
  vibrate: readonly number[];
};

export const feedback: Record<FeedbackCue, FeedbackSpec> = {
  // Pression d'un bouton : un clic bref et doux, presque un toucher.
  tap: { notes: [{ hz: 1046.5, at: 0, ms: 34, gain: 0.16 }], haptic: "light", vibrate: [] },
  // Onglet, pastille, choix dans une liste.
  select: { notes: [{ hz: 1318.5, at: 0, ms: 40, gain: 0.18 }], haptic: "selection", vibrate: [] },
  // Interrupteur ou case : deux notes qui montent.
  toggle: {
    notes: [
      { hz: 880, at: 0, ms: 34, gain: 0.16 },
      { hz: 1174.7, at: 38, ms: 40, gain: 0.16 },
    ],
    haptic: "light",
    vibrate: [8],
  },
  // Série cochée : une quinte franche, le geste de l'effort accompli.
  setDone: {
    notes: [
      { hz: 1046.5, at: 0, ms: 60, gain: 0.26 },
      { hz: 1568, at: 56, ms: 90, gain: 0.26 },
    ],
    haptic: "medium",
    vibrate: [14],
  },
  // Séance validée, record : un arpège qui se pose.
  success: {
    notes: [
      { hz: 523.3, at: 0, ms: 90, gain: 0.26 },
      { hz: 659.3, at: 70, ms: 90, gain: 0.26 },
      { hz: 784, at: 140, ms: 90, gain: 0.26 },
      { hz: 1046.5, at: 210, ms: 260, gain: 0.3 },
    ],
    haptic: "success",
    vibrate: [20, 40, 30],
  },
  // Fin de la récupération : deux bips nets, audibles au bord de la piste.
  restEnd: {
    notes: [
      { hz: 880, at: 0, ms: 160, gain: 0.42 },
      { hz: 880, at: 260, ms: 220, gain: 0.42 },
    ],
    haptic: "warning",
    vibrate: [300],
  },
  // Refus ou erreur : deux notes qui descendent, sans dramatiser.
  error: {
    notes: [
      { hz: 392, at: 0, ms: 110, gain: 0.26 },
      { hz: 311.1, at: 100, ms: 140, gain: 0.26 },
    ],
    haptic: "error",
    vibrate: [40, 30, 40],
  },
};

// Durée totale d'un retour, en millisecondes.
export const feedbackDuration = (cue: FeedbackCue): number =>
  Math.max(...feedback[cue].notes.map((note) => note.at + note.ms));

// Échantillons mono d'un retour, entre -1 et 1 : une sinusoïde et son octave, attaque de 3 ms, décroissance
// exponentielle. Déterministe : le web et les fichiers du mobile sonnent pareil.
export const renderFeedback = (cue: FeedbackCue, sampleRate: number): Float32Array<ArrayBuffer> => {
  const total = Math.ceil(((feedbackDuration(cue) + 20) / 1000) * sampleRate);
  const samples = new Float32Array(total);
  for (const note of feedback[cue].notes) {
    const start = Math.round((note.at / 1000) * sampleRate);
    const length = Math.round((note.ms / 1000) * sampleRate);
    const attack = Math.max(1, Math.round(0.003 * sampleRate));
    for (let i = 0; i < length && start + i < total; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, i / attack) * Math.exp((-5 * i) / length);
      const wave = Math.sin(2 * Math.PI * note.hz * t) + 0.22 * Math.sin(4 * Math.PI * note.hz * t);
      samples[start + i] = (samples[start + i] ?? 0) + (note.gain * envelope * wave) / 1.22;
    }
  }
  for (let i = 0; i < total; i++) samples[i] = Math.max(-1, Math.min(1, samples[i] ?? 0));
  return samples;
};
