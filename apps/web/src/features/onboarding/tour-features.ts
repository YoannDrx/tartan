import type { StaticImageData } from "next/image";
import type { w } from "@tartan/i18n/web";
import videoCapture from "@/features/landing/images/ios-video.png";
import builderCapture from "@/features/landing/images/web-constructeur.png";
import trackingCapture from "@/features/landing/images/web-suivi.png";
import type { Rubric } from "@/lib/rubric-athlete";
import announcementsCapture from "./captures/web-annonces.png";
import phasesCapture from "./captures/web-phases.png";
import plannerCapture from "./captures/web-planificateur.png";

// Les grandes fonctions, dans l'ordre du tour de piste et de la page des premiers pas. Chaque image est une vraie
// capture du produit, sur des données fictives (`captures/provenance.json`) ; les exercices montrent le vrai guide
// animé d'une fiche du catalogue.
export type FeatureKey = keyof typeof w.onboarding.tour.features;

export type Feature = {
  key: FeatureKey;
  path: string;
  rubric: Rubric;
  // Les fonctions que l'offre peut fermer.
  gated?: "planner";
  visual: { kind: "capture"; image: StaticImageData; phone?: boolean } | { kind: "guide"; catalogKey: string };
};

export const FEATURES: readonly Feature[] = [
  { key: "suivi", path: "/suivi", rubric: "suivi", visual: { kind: "capture", image: trackingCapture } },
  {
    key: "calendrier",
    path: "/calendrier",
    rubric: "calendrier",
    visual: { kind: "capture", image: builderCapture },
  },
  { key: "exercices", path: "/exercices", rubric: "exercices", visual: { kind: "guide", catalogKey: "back-squat" } },
  { key: "videos", path: "/videos", rubric: "videos", visual: { kind: "capture", image: videoCapture, phone: true } },
  {
    key: "planificateur",
    path: "/planificateur",
    rubric: "planificateur",
    gated: "planner",
    visual: { kind: "capture", image: plannerCapture },
  },
  {
    key: "progression",
    path: "/phases",
    rubric: "progres",
    visual: { kind: "capture", image: phasesCapture },
  },
  { key: "annonces", path: "/annonces", rubric: "annonces", visual: { kind: "capture", image: announcementsCapture } },
];
