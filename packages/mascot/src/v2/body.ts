// La morphologie du prototype : un corps athlétique d'environ 6,8 têtes, en trois dimensions.
// Une seule table, comme pour le premier squelette : les appuis et les prises restent justes d'un athlète à l'autre.
// Les longueurs suivent les proportions usuelles d'un adulte (hanche à 53 % de la taille, épaule à 82 %),
// avec une tête un peu plus grande que nature pour garder le visage lisible.

export const FIGURE = {
  // La jambe : la cheville au-dessus de la semelle, puis le tibia et la cuisse.
  ankle: 14,
  shin: 78,
  thigh: 80,
  // Le demi-écart des hanches.
  hip: 17,
  // La colonne : le bassin, puis deux segments, jusqu'à la base du cou.
  pelvis: 16,
  lumbar: 40,
  thorax: 44,
  // L'épaule : sous la base du cou, et son demi-écart. Hausser les épaules la remonte de `shrug`.
  shoulderDrop: 8,
  shoulder: 38,
  shrug: 8,
  // De la base du cou au centre de la tête, et le rayon de la tête.
  neck: 30,
  head: 24,
  // Le bras : l'humérus, l'avant-bras, puis du poignet au centre de la prise.
  upperArm: 60,
  forearm: 52,
  hand: 10,
  // Le pied, mesuré depuis la cheville : le talon derrière, l'avant-pied et la pointe devant.
  foot: { heel: 13, ball: 27, toe: 40 },
} as const;

// La taille debout, et la hauteur de la tête : le rapport donne le nombre de têtes.
export const HEIGHT =
  FIGURE.ankle + FIGURE.shin + FIGURE.thigh + FIGURE.pelvis + FIGURE.lumbar + FIGURE.thorax + FIGURE.neck + FIGURE.head;
export const HEADS = HEIGHT / (2 * FIGURE.head);

// La barre olympique, à l'échelle du corps (une unité vaut environ 5,4 mm pour un athlète de 1,75 m) :
// 2,20 m de long, 1,31 m entre les butées, des disques de 45 cm.
export const BARBELL = {
  half: 203,
  collar: 121,
  shaft: 2.6,
  sleeve: 4.6,
  plate: 41,
  // Deux disques par côté : leur épaisseur et l'espace qui les sépare.
  thickness: 11,
  gap: 2,
} as const;

// Les amplitudes articulaires admises, en degrés. Les tests les vérifient sur chaque image.
// Le genou et le coude ne passent jamais sous zéro : pas d'hyperextension.
export const LIMITS = {
  knee: [0, 155],
  // Le coude se replie au maximum quand la barre repose sur les épaules, coudes hauts vers l'avant.
  elbow: [0, 160],
  // La cuisse par rapport au bassin : vers l'avant (flexion), vers l'extérieur (abduction). Le bassin n'a qu'un
  // segment : sa bascule compte dans la flexion, d'où une borne plus large que celle de la hanche seule.
  hipFlexion: [-25, 140],
  hipAbduction: [-35, 60],
  // Le tibia par rapport au pied : vers la pointe (flexion dorsale), puis sur le côté.
  ankle: [-55, 45],
  ankleSide: [-46, 46],
  lumbar: [-15, 40],
  thoracic: [-15, 30],
  neck: [-45, 40],
  wrist: [-70, 80],
  // Le bras qui part derrière le buste.
  shoulderExtension: [0, 70],
} as const satisfies Record<string, readonly [number, number]>;
export type Limit = keyof typeof LIMITS;
