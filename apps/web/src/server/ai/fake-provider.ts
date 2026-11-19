import { plannerFailureCode } from "@tartan/contracts";
import { PlannerProviderError, type PlannerProvider, type PlannerProviderContext } from "./provider";

// Prestataire factice, pour les parcours de l'app native en CI : le web simule le planificateur dans le navigateur,
// l'app native n'a pas cette possibilité. Il ne s'allume que sur demande explicite, et jamais sur Vercel : aucune
// préversion ni production ne peut l'utiliser. Il ne lit que le contexte reçu et ne contacte personne.
export const fakePlannerEnabled = (vars: NodeJS.ProcessEnv = process.env): boolean =>
  vars.AI_PLANNER_FAKE_PROVIDER === "true" && !vars.VERCEL;

// Une séance, le premier jour de la période, pour le premier destinataire, avec le premier exercice de la
// bibliothèque autorisée. La consigne relue est recopiée telle quelle, comme l'exige la validation.
export const fakePlannerProvider = (): PlannerProvider => ({
  async interpret(context: PlannerProviderContext, options = {}) {
    const result = await fakeInterpretation(context);
    // Recette de la réponse diffusée : les étapes, puis la réponse par morceaux, à petite allure.
    options.onProgress?.({ step: "model" });
    if (options.onDelta) {
      const text = JSON.stringify(result);
      for (let at = 0; at < text.length; at += 48) {
        options.onDelta(text.slice(at, at + 48));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
    }
    options.onProgress?.({ step: "checks" });
    return result;
  },
});

async function fakeInterpretation(context: PlannerProviderContext) {
  // Recette des erreurs lisibles : « #panne-saturated » dans la consigne simule cette cause, sans réseau.
  const failure = plannerFailureCode.safeParse(context.instructions.join("\n").match(/#panne-([a-z_]+)/)?.[1]);
  if (failure.success) throw new PlannerProviderError(failure.data);
  const fixtureMovement = context.instructions[0]?.match(/Mouvement natif de recette(?: \d+)?/)?.[0];
  const unknownFixture = Boolean(fixtureMovement);
  const resolved = context.exercises.find((exercise) => exercise.name === fixtureMovement);
  if (unknownFixture && !resolved)
    return {
      status: "clarification" as const,
      sessions: [],
      assumptions: [],
      suggestions: [],
      questions: [
        {
          id: "native-exercise",
          field: "exercise" as const,
          question: `Quel exercice correspond au ${fixtureMovement} ?`,
          exerciseName: fixtureMovement,
          options: [],
        },
      ],
    };
  // La fiche : celle que le coach a rattachée, sinon celle que la consigne nomme, sinon la première autorisée.
  const text = context.instructions.join("\n").toLocaleLowerCase("fr");
  const chosen = context.resolvedExercises?.length
    ? context.exercises.find((e) => e.token === context.resolvedExercises![0]!.token)
    : context.exercises.find((e) => text.includes(e.name.toLocaleLowerCase("fr")));
  const exercise = (unknownFixture ? resolved : (chosen ?? context.exercises[0]))!;
  const target = context.targets[0]!;
  const instruction = context.instructions[0]!.slice(0, 2000);
  // « 80 % » dans la consigne : une charge en pourcentage du maximum, que Tartan résout pour chacun.
  const percent = Number(/(\d{2,3})\s?%/.exec(text)?.[1] ?? Number.NaN);
  // Un ajustement change le nombre de séries ; un circuit répète les deux premières fiches trois fois.
  const sets = context.previous ? 4 : 3;
  const prescription = (count: number) => ({
    sets: count,
    reps: 8,
    distanceM: null,
    durationS: null,
    restS: count > 1 ? 90 : null,
    load: Number.isFinite(percent) ? { type: "pct_1rm" as const, value: percent } : null,
    intensityTarget: null,
    tempo: null,
    contacts: null,
    notes: null,
  });
  const second = context.exercises.find((e) => e.token !== exercise.token);
  if (/\bcircuit\b/i.test(instruction) && second)
    return {
      status: "proposal" as const,
      questions: [],
      assumptions: [],
      suggestions: [],
      sessions: [
        {
          date: context.mode === "propose" ? context.brief!.date : context.period.from,
          startTime: null,
          title: instruction.slice(0, 120),
          type: "strength" as const,
          durationMin: context.mode === "propose" ? context.brief!.durationMin : 45,
          targetTokens: [target.token],
          blocks: [
            {
              name: "Circuit",
              items: [
                { ref: "a", exerciseToken: exercise.token, prescription: prescription(1), instruction },
                { ref: "b", exerciseToken: second.token, prescription: prescription(1), instruction },
              ],
              sequence: [
                {
                  kind: "repeat" as const,
                  ref: "tours",
                  name: "Circuit",
                  rounds: 3,
                  restBetweenRoundsS: 60,
                  children: [
                    { kind: "exercise" as const, itemRef: "a" },
                    { kind: "exercise" as const, itemRef: "b" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  return {
    status: "proposal" as const,
    questions: [],
    assumptions: [],
    suggestions: [],
    sessions: [
      {
        date: context.mode === "propose" ? context.brief!.date : context.period.from,
        startTime: null,
        title: instruction.slice(0, 120),
        type: "strength" as const,
        durationMin: context.mode === "propose" ? context.brief!.durationMin : 45,
        targetTokens: [target.token],
        blocks: [
          {
            name: exercise.name.slice(0, 80),
            items: [
              {
                exerciseToken: exercise.token,
                prescription: prescription(sets),
                instruction,
              },
            ],
          },
        ],
      },
    ],
  };
}
