import type { ExerciseGuide } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { guideAuthorship, guideMediaModes, showsReviewedText, shownGuideText } from "./exercise-guide-text";

const guide = (over: Partial<ExerciseGuide> = {}): ExerciseGuide => ({
  catalogKey: "back-squat",
  version: 1,
  family: "strength",
  level: "intermediate",
  objective: "Renforcer les cuisses et les fessiers en flexion complète, dos neutre, sous charge contrôlée.",
  setup: ["Barre sur les trapèzes.", "Pieds largeur d'épaules."],
  steps: ["Descends hanches en arrière.", "Remonte en poussant le sol."],
  breathing: "Inspire en haut, bloque, souffle en remontant.",
  mistakes: ["Genoux qui rentrent."],
  easier: "Squat au poids du corps.",
  progression: "Squat avant.",
  counting: { unit: "repetitions", sides: "total", explanation: "Une répétition par remontée." },
  loadExplanation: "La charge totale de la barre.",
  illustration: {
    status: "ready",
    path: "/exercise-guides/back-squat-v1.svg",
    alt: "Squat arrière",
    positions: ["Debout", "En bas"],
    source: "tartan-original",
    rights: "Tartan",
  },
  technicalReview: "approved",
  ...over,
});

describe("fiche concise", () => {
  it("affiche la version concise du catalogue quand elle existe", () => {
    const concise = {
      objective: "Renforcer les cuisses, dos neutre.",
      setup: "Barre sur les trapèzes, pieds largeur d'épaules.",
      steps: ["Descends.", "Remonte."],
      mistakes: ["Genoux qui rentrent."],
      easier: { text: "Squat au poids du corps", catalogKey: "air-squat" },
      harder: null,
      review: "review" as const,
    };
    const shown = shownGuideText(guide({ concise }));
    expect(shown.objective).toBe(concise.objective);
    expect(shown.easier?.catalogKey).toBe("air-squat");
    expect(showsReviewedText(guide({ concise }))).toBe(true);
    expect(showsReviewedText(guide({ concise: { ...concise, review: "approved" } }))).toBe(false);
  });

  it("sans version concise, garde le texte enregistré : mise en place en une ligne, variantes sans lien", () => {
    const shown = shownGuideText(guide());
    expect(shown.setup).toBe("Barre sur les trapèzes. Pieds largeur d'épaules.");
    expect(shown.easier).toEqual({ text: "Squat au poids du corps.", catalogKey: null });
    expect(shown.harder).toEqual({ text: "Squat avant.", catalogKey: null });
    expect(showsReviewedText(guide())).toBe(false);
  });

  it("dit qui a écrit le guide", () => {
    expect(guideAuthorship(guide({ author: "coach" }))).toBe("coach");
    expect(guideAuthorship(guide())).toBe("approved");
    expect(guideAuthorship(guide({ technicalReview: "pending" }))).toBe("pending");
  });

  it("présente la vidéo filmée seule dès qu’elle est lisible", () => {
    const video = { view: "side" as const, streamUrl: "https://stream.example/v.mp4", hlsUrl: null, posterUrl: null };
    const withVideo = guide({ illustration: { ...guide().illustration, videos: [video] } });
    const illustrated = {
      ...withVideo,
      illustration: {
        ...withVideo.illustration,
        photo: { path: "/exercise-photos/step-up-v1.webp", alt: "Pied sur la marche." },
      },
    };
    expect(guideMediaModes(illustrated, true)).toEqual(["video"]);
    expect(guideMediaModes(illustrated, true, false)).toEqual(["video"]);
    expect(guideMediaModes(withVideo, true)).toEqual(["video"]);
    expect(guideMediaModes(withVideo, false)).toEqual(["video"]);
    expect(guideMediaModes(guide(), true)).toEqual(["motion"]);
    expect(guideMediaModes(guide(), false)).toEqual([]);
  });
});
