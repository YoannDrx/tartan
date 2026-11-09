import type { Prescription, SessionType } from "@tartan/contracts";

export type StarterTemplate = {
  title: string;
  type: SessionType;
  durationMin: number;
  blocks: { name: string; items: { exercise: string; prescription: Prescription }[] }[];
};

// Séances de départ copiées à la création d'un espace : points de départ à adapter, jamais des programmes individualisés.
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    title: "Force bas du corps",
    type: "strength",
    durationMin: 60,
    blocks: [
      {
        name: "Échauffement",
        items: [{ exercise: "Mobilité de cheville", prescription: { sets: 2, reps: 10, rest_s: 30 } }],
      },
      {
        name: "Force",
        items: [
          { exercise: "Squat arrière", prescription: { sets: 4, reps: 5, rest_s: 180 } },
          { exercise: "Soulevé de terre roumain", prescription: { sets: 3, reps: 8, rest_s: 120 } },
          { exercise: "Squat bulgare", prescription: { sets: 3, reps: 8, rest_s: 90 } },
        ],
      },
      {
        name: "Gainage",
        items: [{ exercise: "Gainage ventral", prescription: { sets: 3, duration_s: 40, rest_s: 45 } }],
      },
    ],
  },
  {
    title: "Pliométrie basse",
    type: "plyo",
    durationMin: 45,
    blocks: [
      {
        name: "Échauffement",
        items: [{ exercise: "Éducatifs de cheville", prescription: { sets: 3, distance_m: 20, rest_s: 30 } }],
      },
      {
        name: "Contacts courts",
        items: [
          {
            exercise: "Sauts de haies basses",
            prescription: { sets: 5, count: 6, unit: "haies", ground_contacts: 30, rest_s: 120 },
          },
          {
            exercise: "Bonds unipodaux",
            prescription: { sets: 4, count: 6, unit: "bonds", ground_contacts: 24, rest_s: 120 },
          },
        ],
      },
    ],
  },
  {
    title: "Technique de course",
    type: "running",
    durationMin: 50,
    blocks: [
      {
        name: "Gammes",
        items: [
          { exercise: "Gammes : montées de genoux", prescription: { sets: 3, distance_m: 30, rest_s: 60 } },
          { exercise: "Gammes : talons-fesses", prescription: { sets: 3, distance_m: 30, rest_s: 60 } },
        ],
      },
      {
        name: "Vitesse",
        items: [{ exercise: "Accélérations", prescription: { sets: 6, distance_m: 30, rest_s: 120 } }],
      },
    ],
  },
  {
    title: "Appuis sur plots",
    type: "cones",
    durationMin: 40,
    blocks: [
      {
        name: "Appuis",
        items: [
          { exercise: "Slalom entre les plots", prescription: { sets: 4, count: 8, unit: "plots", rest_s: 90 } },
          { exercise: "Changements d'appuis en carré", prescription: { sets: 4, count: 4, unit: "côtés", rest_s: 90 } },
          { exercise: "Pas chassés entre plots", prescription: { sets: 4, distance_m: 10, rest_s: 60 } },
        ],
      },
    ],
  },
];
