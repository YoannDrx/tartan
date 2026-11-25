import type { ExerciseGuide } from "@tartan/contracts";

// Ce que la fiche affiche, comme sur le web : la version concise du catalogue, sinon le texte enregistré (celui qu'un
// coach a écrit pour sa copie). Le texte complet déjà relu reste sous « Détail » tant que la version courte attend
// la validation du fondateur.
export type ShownGuide = {
  objective: string;
  setup: string;
  steps: readonly string[];
  mistakes: readonly string[];
  easier: { text: string; catalogKey: string | null } | null;
  harder: { text: string; catalogKey: string | null } | null;
};

export const shownGuideText = (guide: ExerciseGuide): ShownGuide =>
  guide.concise ?? {
    objective: guide.objective,
    setup: guide.setup.join(" "),
    steps: guide.steps,
    mistakes: guide.mistakes,
    easier: guide.easier ? { text: guide.easier, catalogKey: null } : null,
    harder: guide.progression ? { text: guide.progression, catalogKey: null } : null,
  };

// Le texte long n'est montré sous « Détail » que s'il diffère de ce qui s'affiche : une version courte en relecture.
export const showsReviewedText = (guide: ExerciseGuide) => guide.concise?.review === "review";

// La mention sous la fiche : un guide de coach n'est plus le texte relu par Tartan.
export const guideAuthorship = (guide: ExerciseGuide): "coach" | "approved" | "pending" =>
  guide.author === "coach" ? "coach" : guide.technicalReview === "approved" ? "approved" : "pending";

// La fiche commune a sa vidéo : on choisit entre le geste animé et la vidéo ; sans geste, la vidéo seule.
export { guideMediaModes } from "@tartan/domain";
