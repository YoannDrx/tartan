import type { AthleteId } from "@tartan/mascot/athletes";
import type { PoseName } from "@tartan/mascot/poses";
import type { Face } from "@tartan/mascot/rig";

// Les athlètes des e-mails : des images PNG tirées du groupe (les messageries n'affichent pas le SVG), posées sur
// le bandeau piste. Un athlète accompagne un accueil ou une bonne nouvelle ; les e-mails de sécurité, de paiement
// et d'avertissement restent sans illustration. `pnpm --filter @tartan/web email:athletes` régénère les images.
export const EMAIL_ATHLETES = {
  // Bienvenue du coach : Noé, l'athlète des vidéos, qui l'accueille.
  welcome: { id: "highJump", pose: "cheer", face: "joy" },
  // Invitation d'un athlète : Awa, du triple saut, qui l'attend sur la ligne.
  invitation: { id: "tripleJump", pose: "lineup", face: "neutral" },
  // Premiers pas d'un athlète : Inès, au couloir 1.
  athleteWelcome: { id: "hurdles", pose: "cheer", face: "joy" },
  // Conseils d'activation : Lila, de la longueur, prête à mesurer.
  tip: { id: "longJump", pose: "lineup", face: "neutral" },
  // Abonnement confirmé : Malo, de la perche, qui monte.
  subscribed: { id: "poleVault", pose: "cheer", face: "joy" },
} as const satisfies Record<string, { id: AthleteId; pose: PoseName; face: Face }>;

export type EmailAthlete = keyof typeof EMAIL_ATHLETES;

// Hauteur affichée, en pixels CSS ; l'image est tirée au double pour les écrans denses.
export const EMAIL_ATHLETE_HEIGHT = 88;
export const emailAthletePath = (name: EmailAthlete) => `/brand/email/${name}.png`;
