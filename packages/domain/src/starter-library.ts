import type { ExerciseCategory, Prescription } from "@tartan/contracts";

export type StarterExercise = {
  name: string;
  category: ExerciseCategory;
  cues: string[];
  prescription: Prescription;
};

// Bibliothèque de départ (§ 7.4) : exercices courants d'un groupe de sauteurs, sans vidéo,
// copiés dans chaque nouvel espace et modifiables. Le coach reste maître des consignes.
export const STARTER_LIBRARY: StarterExercise[] = [
  { name: "Gammes : montées de genoux", category: "running_drill", cues: ["Bassin haut", "Pied actif sous le corps"], prescription: { sets: 3, distance_m: 30, rest_s: 60 } },
  { name: "Gammes : talons-fesses", category: "running_drill", cues: ["Fréquence avant l'amplitude", "Buste droit"], prescription: { sets: 3, distance_m: 30, rest_s: 60 } },
  { name: "Foulées bondissantes", category: "running_drill", cues: ["Pousser loin derrière", "Genou libre haut"], prescription: { sets: 4, distance_m: 40, rest_s: 120 } },
  { name: "Accélérations", category: "running_drill", cues: ["Progressif sur la distance", "Relâché en fin de course"], prescription: { sets: 4, distance_m: 60, rest_s: 180 } },
  { name: "Sprints départ lancé", category: "running_drill", cues: ["Vitesse maximale", "Récupération complète"], prescription: { sets: 4, distance_m: 30, rest_s: 240 } },
  { name: "Élans courts en courbe", category: "jump", cues: ["Inclinaison vers l'intérieur", "Rythme sur les derniers appuis"], prescription: { sets: 6, rest_s: 120 } },
  { name: "Impulsions sur 3 appuis", category: "jump", cues: ["Pied d'appel actif", "Genou libre qui monte"], prescription: { sets: 3, reps: 6, rest_s: 120 } },
  { name: "Sauts à la barre, élan complet", category: "jump", cues: ["Élan régulier", "Bascule des épaules"], prescription: { sets: 8, rest_s: 180 } },
  { name: "Sauts avec élan réduit", category: "jump", cues: ["Impulsion verticale", "Hanches hautes"], prescription: { sets: 6, rest_s: 150 } },
  { name: "Sauts de haies basses", category: "plyo", cues: ["Pieds actifs", "Bras synchronisés"], prescription: { sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 } },
  { name: "Bonds alternés", category: "plyo", cues: ["Contact au sol court", "Regard loin devant"], prescription: { sets: 4, distance_m: 20, ground_contacts: 40, rest_s: 120 } },
  { name: "Bonds unipodaux", category: "plyo", cues: ["Cheville gainée", "Atterrissage silencieux"], prescription: { sets: 3, reps: 8, ground_contacts: 48, rest_s: 150 } },
  { name: "Sauts en contrebas", category: "plyo", cues: ["Temps au sol minimal", "Rebond immédiat"], prescription: { sets: 3, reps: 6, ground_contacts: 18, rest_s: 180 } },
  { name: "Sauts verticaux répétés", category: "plyo", cues: ["Chevilles raides", "Rythme régulier"], prescription: { sets: 3, reps: 10, ground_contacts: 30, rest_s: 90 } },
  { name: "Fentes sautées", category: "plyo", cues: ["Genou dans l'axe", "Buste droit"], prescription: { sets: 3, reps: 10, ground_contacts: 30, rest_s: 90 } },
  { name: "Squat arrière", category: "strength", cues: ["Dos gainé", "Descente contrôlée"], prescription: { sets: 4, reps: 5, rest_s: 150, load: { type: "pct_1rm", value: 80, test: "back_squat" } } },
  { name: "Squat avant", category: "strength", cues: ["Coudes hauts", "Buste vertical"], prescription: { sets: 4, reps: 5, rest_s: 150, load: { type: "pct_1rm", value: 75, test: "front_squat" } } },
  { name: "Épaulé", category: "strength", cues: ["Tirer avec les jambes", "Réception stable"], prescription: { sets: 5, reps: 3, rest_s: 180, load: { type: "pct_1rm", value: 75, test: "clean" } } },
  { name: "Soulevé de terre", category: "strength", cues: ["Barre près du corps", "Dos plat"], prescription: { sets: 3, reps: 5, rest_s: 180, load: { type: "pct_1rm", value: 75, test: "deadlift" } } },
  { name: "Hip thrust", category: "strength", cues: ["Bassin en rétroversion", "Pause en haut"], prescription: { sets: 3, reps: 8, rest_s: 120, load: { type: "pct_1rm", value: 70, test: "hip_thrust" } } },
  { name: "Mollets debout", category: "strength", cues: ["Amplitude complète", "Montée explosive"], prescription: { sets: 3, reps: 12, rest_s: 60 } },
  { name: "Gainage ventral", category: "warmup", cues: ["Bassin neutre", "Respiration libre"], prescription: { sets: 3, duration_s: 45, rest_s: 30 } },
  { name: "Gainage latéral", category: "warmup", cues: ["Corps aligné", "Hanche haute"], prescription: { sets: 3, duration_s: 30, rest_s: 30 } },
  { name: "Footing d'échauffement", category: "warmup", cues: ["Allure de conversation"], prescription: { duration_s: 600 } },
  { name: "Éducatifs de cheville", category: "warmup", cues: ["Pieds actifs", "Petits appuis rapides"], prescription: { sets: 3, distance_m: 15, rest_s: 30 } },
  { name: "Montées d'escaliers", category: "stairs", cues: ["Pied complet sur la marche", "Rythme constant"], prescription: { sets: 5, unit: "marches", count: 30, rest_s: 120 } },
  { name: "Escaliers unipodaux", category: "stairs", cues: ["Genou stable", "Une marche à la fois"], prescription: { sets: 3, unit: "marches", count: 10, rest_s: 120 } },
  { name: "Slalom entre les plots", category: "cones", cues: ["Appuis courts", "Regard devant"], prescription: { sets: 4, unit: "plots", count: 8, rest_s: 90 } },
  { name: "Mobilité des hanches", category: "mobility", cues: ["Mouvement lent", "Sans douleur"], prescription: { duration_s: 480 } },
  { name: "Mobilité de cheville", category: "mobility", cues: ["Talon au sol", "Genou vers l'avant"], prescription: { sets: 2, reps: 10 } },
  { name: "Étirements actifs du dos", category: "mobility", cues: ["Respiration ample"], prescription: { duration_s: 300 } },
];
