import type { PlannerProvider, PlannerProviderContext } from "./provider";

// Prestataire factice, pour les parcours de l'app native en CI : le web simule le planificateur dans le navigateur,
// l'app native n'a pas cette possibilité. Il ne s'allume que sur demande explicite, et jamais sur Vercel : aucune
// préversion ni production ne peut l'utiliser. Il ne lit que le contexte reçu et ne contacte personne.
export const fakePlannerEnabled = (vars: NodeJS.ProcessEnv = process.env): boolean =>
  vars.AI_PLANNER_FAKE_PROVIDER === "true" && !vars.VERCEL;

// Une séance, le premier jour de la période, pour le premier destinataire, avec le premier exercice de la
// bibliothèque autorisée. La consigne relue est recopiée telle quelle, comme l'exige la validation.
export const fakePlannerProvider = (): PlannerProvider => ({
  async interpret(context: PlannerProviderContext) {
    const exercise = context.exercises[0]!;
    const target = context.targets[0]!;
    const instruction = context.instructions[0]!.slice(0, 2000);
    return {
      status: "proposal" as const,
      questions: [],
      assumptions: [],
      suggestions: [],
      sessions: [
        {
          date: context.period.from,
          startTime: null,
          title: instruction.slice(0, 120),
          type: "strength" as const,
          durationMin: 45,
          targetTokens: [target.token],
          blocks: [
            {
              name: exercise.name.slice(0, 80),
              items: [
                {
                  exerciseToken: exercise.token,
                  prescription: {
                    sets: 3,
                    reps: 8,
                    distanceM: null,
                    durationS: null,
                    restS: 90,
                    load: null,
                    intensityTarget: null,
                    tempo: null,
                    contacts: null,
                    notes: null,
                  },
                  instruction,
                },
              ],
            },
          ],
        },
      ],
    };
  },
});
