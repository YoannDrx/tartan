// Les gestes relevés qui ne respectent pas encore toutes les contraintes, et lesquelles. Le relèvement suit des
// règles générales : ce qu'elles ne règlent pas se corrige en écrivant le geste à la main, pas par une rustine.
// Le test du registre tient cette table à jour : un geste absent d'ici doit tout respecter, et un geste listé qui
// respecte désormais une de ses contraintes fait échouer le test, pour que la liste ne pourrisse pas.
import type { Report } from "./constraints";

export type Constraint = keyof Report;

export const A_REPRENDRE: Readonly<Record<string, readonly Constraint[]>> = {
  // Musculation.
  // Barre sur le dos, prise large : les coudes partent trop loin derrière le buste.
  "good-morning": ["limits"],
  // Pieds sur la pointe, corps incliné : la cheville dépasse sa flexion.
  "incline-push-up": ["limits"],
  // L'ancien geste déplace la barre fixe avec la main : les mains n'y tiennent pas.
  "inverted-row": ["bar"],

  // Pliométrie : le saut en hauteur complet, corps retourné au-dessus de la barre.
  "high-jump-full": ["limits"],
  "high-jump-short": ["limits"],

  // Gainage : couché sur le côté, les jambes se croisent au-delà de l'adduction de la hanche.
  "side-plank": ["limits", "ground"],

  // Coordination et escaliers : le pas croisé dépasse l'adduction de la hanche.
  carioca: ["limits"],
  "cross-step-stairs": ["limits"],

  // Échauffement : le bras d'équilibre part trop loin derrière le buste.
  "leg-swings": ["limits"],

  // Mobilité : positions au sol ou en fin d'amplitude, que l'ancien dessin ne bornait pas.
  "adductor-rockback": ["limits"],
  "hip-car": ["limits"],
  "toe-extension-rock": ["limits"],
  "hip-90-90": ["limits"],
  "cossack-mobility": ["limits"],
  "prone-hip-rotation": ["limits"],
};
