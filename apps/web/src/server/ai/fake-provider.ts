import {
  plannerFailureCode,
  plannerStepName,
  type PlannerComposedNode,
  type PlannerComposition,
  type PlannerMatchGeneration,
  type PlannerUnderstanding,
} from "@tartan/contracts";
import {
  PlannerProviderError,
  type PlannerComposeInput,
  type PlannerMatchInput,
  type PlannerProvider,
  type PlannerStepOptions,
  type PlannerUnderstandInput,
} from "./pipeline/types";

// Prestataire simulé, pour les parcours de l'app native en CI, les parcours web et les essais de l'outil de
// mesure. Il ne s'allume que sur demande explicite, et jamais sur Vercel : aucune préversion ni production ne peut
// l'utiliser. Il implémente chaque étape, ne lit que ce qu'elle reçoit et ne contacte personne. Il ne comprend
// pas le français : il découpe la demande par règles simples. Les contrôles du serveur s'appliquent à ce qu'il
// rend, comme à OpenAI.
export const fakePlannerEnabled = (vars: NodeJS.ProcessEnv = process.env): boolean =>
  vars.AI_PLANNER_FAKE_PROVIDER === "true" && !vars.VERCEL;

// Recette des erreurs lisibles : « #panne-saturated » simule cette cause à la première étape, et
// « #panne-compose-timeout » à l'étape nommée, sans réseau.
function failAt(step: "understand" | "match" | "compose" | "repair", text: string) {
  const match = /#panne-(?:(understand|match|compose|repair)-)?([a-z_]+)/.exec(text);
  if (!match) return;
  const at = plannerStepName.safeParse(match[1] ?? "understand");
  const code = plannerFailureCode.safeParse(match[2]);
  if (code.success && at.success && at.data === step) throw new PlannerProviderError(code.data, step);
}

const NUMBER =
  "\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|soixante";
const PRESCRIPTION = new RegExp(
  `^(?:${NUMBER})(?:[- ](?:${NUMBER}))*\\s*(?:x|×|\\*|fois|series?|séries?|passages?|tours?|repetitions?|répétitions?|reps?)(?![a-zà-ÿ])`,
  "i",
);
const NOT_A_MOVEMENT =
  /^(?:\d|aujourd|demain|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|repos|recup|récup|circuit|superset|pour |group_|athlete_|#)/i;
const NAMED_INLINE = new RegExp(`^(.+?)\\s+(?:${NUMBER})\\s*(?:x|×|fois|series?|séries?)(?![a-zà-ÿ])(.*)$`, "i");

/** Les mouvements nommés devant une prescription : « Squat arrière, 3 séries de 4 », « squat arrière 3 x 8 ». */
function fakeMovements(request: string) {
  const clauses = request
    .split(/[,;:.\n]|\s+(?:puis|ensuite)\s+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const movements: { said: string; prescription: string | null }[] = [];
  clauses.forEach((clause, index) => {
    if (PRESCRIPTION.test(clause) || NOT_A_MOVEMENT.test(clause)) return;
    const inline = NAMED_INLINE.exec(clause);
    // Un nom tient en quelques mots : une dictée sans ponctuation n'est pas découpée, tout y est laissé à composer.
    if (inline)
      return void (
        inline[1]!.trim().split(/\s+/).length <= 6 &&
        movements.push({ said: inline[1]!.trim(), prescription: clause.slice(inline[1]!.length).trim() })
      );
    const next = clauses[index + 1] ?? "";
    if (!PRESCRIPTION.test(next)) return;
    // La prescription : les propositions qui suivent, jusqu'au prochain mouvement.
    const said: string[] = [];
    for (let at = index + 1; at < clauses.length; at++) {
      const following = clauses[at]!;
      // Le repère de panne (« #panne-match-timeout ») suit la prescription jusqu'à l'étape qu'il vise.
      if (at > index + 1 && !PRESCRIPTION.test(following) && !/^(?:repos|recup|récup|\d|#)/i.test(following)) break;
      said.push(following);
    }
    movements.push({ said: clause, prescription: said.join(", ") || null });
  });
  return movements.filter((movement) => /\p{L}{3,}/u.test(movement.said)).slice(0, 20);
}

async function fakeUnderstanding(input: PlannerUnderstandInput): Promise<PlannerUnderstanding> {
  failAt("understand", [input.request, ...input.followUps].join("\n"));
  // Indice des clients d'avant le champ unique : en mode « Proposer », tout est à composer. Un ajustement
  // (« Passe à quatre séries ») modifie la séance déjà écrite : il ne cite aucun nouveau mouvement.
  const movements = input.hints.intent === "objective" || input.adjusting ? [] : fakeMovements(input.request);
  const recipients = input.recipients
    .map((recipient) => recipient.token)
    .filter((token) => [input.request, ...input.followUps].join("\n").includes(token));
  return {
    summary: movements.length
      ? `Tu décris une séance de ${movements.length} exercice${movements.length > 1 ? "s" : ""}.`
      : "Tu me laisses composer la séance.",
    offTopic: /#hors-sujet/.test(input.request),
    intent: movements.length ? "described" : "objective",
    sessions: [
      {
        date: null,
        dateSaid: null,
        startTime: null,
        targetTokens: recipients,
        movements: movements.map((movement, index) => ({
          id: `m${index + 1}`,
          said: movement.said.slice(0, 120),
          prescription: movement.prescription?.slice(0, 300) ?? null,
          replaces: null,
        })),
        structure: null,
        proposal: movements.length
          ? null
          : {
              objective: input.request.slice(0, 500),
              durationMin: input.hints.durationMin,
              level: input.hints.level,
              equipment: null,
              families: [],
            },
      },
    ],
    corrections: [],
  };
}

const words = (label: string) =>
  label
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map((word) => (word.length > 3 ? word.replace(/s$/, "") : word));

/** Rapprochement simulé, par mots : tous les mots du terme dans une seule fiche, sûr ; plusieurs fiches, probable. */
async function fakeMatches(input: PlannerMatchInput): Promise<PlannerMatchGeneration> {
  failAt("match", input.movements.map((movement) => `${movement.said} ${movement.prescription ?? ""}`).join("\n"));
  return {
    matches: input.movements.map((movement) => {
      const wanted = words(movement.said);
      const scored = input.library
        .map((entry) => {
          const labels = [entry.name, ...entry.aliases].map(words);
          const best = Math.max(0, ...labels.map((label) => wanted.filter((word) => label.includes(word)).length));
          return { key: entry.key, shared: best };
        })
        .filter((entry) => entry.shared > 0)
        .sort((a, b) => b.shared - a.shared);
      const full = scored.filter((entry) => entry.shared === wanted.length && wanted.length > 0);
      if (full.length === 1)
        return { id: movement.id, confidence: "sure" as const, key: full[0]!.key, others: [], suggestion: null };
      if (full.length > 1)
        return {
          id: movement.id,
          confidence: "probable" as const,
          key: full[0]!.key,
          others: full.slice(1, 4).map((entry) => entry.key),
          suggestion: null,
        };
      return {
        id: movement.id,
        confidence: "absent" as const,
        key: null,
        others: scored.slice(0, 3).map((entry) => entry.key),
        // De quoi préremplir la création : le terme tel quel, et les valeurs les plus prudentes.
        suggestion: {
          name: movement.said.slice(0, 120),
          category: "strength" as const,
          movement: "other" as const,
          loadKind: "bodyweight" as const,
        },
      };
    }),
  };
}

function fakeComposition(input: PlannerComposeInput): PlannerComposition {
  const text = [input.request, ...input.followUps, input.adjustment ?? ""].join("\n");
  failAt("compose", text);
  // « 80 % » dans la demande : une charge en pourcentage du maximum, que Tartan résout pour chacun.
  const percent = Number(/(\d{2,3})\s?%/.exec(text)?.[1] ?? Number.NaN);
  // Un ajustement passe à quatre séries ; un circuit répète deux fiches trois fois.
  const sets = input.previous ? 4 : 3;
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
    setPlan: null,
  });
  const lower = text.toLocaleLowerCase("fr");
  // Un ajustement modifie la séance reçue, il n'en écrit pas une autre : chaque exercice passe à quatre séries,
  // et tout le reste (fiches, ordre, répétitions, charges, tours) reste tel que le coach l'avait à l'écran.
  if (input.previous) {
    type Content = PlannerComposition["sessions"][number]["blocks"][number]["content"];
    // Dans un circuit, les tours sont ceux du groupe : ses exercices ne changent pas.
    const adjust = (nodes: Content): Content =>
      nodes.map((node) =>
        node.kind === "exercise" && !node.prescription.setPlan
          ? { ...node, prescription: { ...node.prescription, sets } }
          : node,
      );
    return {
      assumptions: [],
      suggestions: [],
      sessions: input.previous.sessions.map((session) => ({
        ...session,
        blocks: session.blocks.map((block) => ({ ...block, content: adjust(block.content) })),
      })),
    };
  }
  return {
    assumptions: [],
    suggestions: [],
    sessions: input.understanding.sessions.map((session) => {
      const exercise = (movementId: string | null, token: string, count: number): PlannerComposedNode => ({
        kind: "exercise",
        movementId,
        exerciseToken: token,
        prescription: prescription(count),
        reason: movementId ? null : "Proposé par le prestataire simulé.",
        autonomous: null,
      });
      // Les fiches proposables : celle que la demande nomme d'abord, puis les candidates dans l'ordre reçu.
      const proposable = input.exercises.filter(
        (entry) => input.candidates.includes(entry.token) || !session.movements.length,
      );
      const named = proposable.find((entry) => lower.includes(entry.name.toLocaleLowerCase("fr")));
      const first = named ?? proposable[0] ?? input.exercises[0];
      const second = proposable.find((entry) => entry.token !== first?.token);
      const cited = session.movements.filter((movement) => !movement.replaces);
      const circuit = /\bcircuit\b/i.test(text);
      const content: PlannerComposedNode[] = cited.length
        ? cited.map((movement) => exercise(movement.id, movement.exerciseToken, sets))
        : circuit && first && second
          ? [
              {
                kind: "repeat",
                name: "Circuit",
                rounds: 3,
                restBetweenRoundsS: 60,
                children: [exercise(null, first.token, 1), exercise(null, second.token, 1)] as never,
              },
            ]
          : first
            ? [exercise(null, first.token, sets)]
            : [];
      const label = cited[0]?.said ?? first?.name ?? "Séance";
      return {
        index: session.index,
        title: input.request.slice(0, 120) || label,
        type: "strength" as const,
        durationMin: session.proposal?.durationMin ?? 45,
        // Une séance sans aucune fiche utilisable reste vide : le contrôle du serveur en fait une panne lisible.
        blocks: content.length ? [{ name: circuit && !cited.length ? "Circuit" : label.slice(0, 80), content }] : [],
      };
    }) as PlannerComposition["sessions"],
  };
}

const streamed = async <T>(result: T, options: PlannerStepOptions): Promise<T> => {
  // Recette de la réponse diffusée : la réponse par morceaux, à petite allure.
  if (options.onDelta) {
    const text = JSON.stringify(result);
    for (let at = 0; at < text.length; at += 48) {
      options.onDelta(text.slice(at, at + 48));
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }
  return result;
};

export const fakePlannerProvider = (): PlannerProvider => ({
  understand: async (input, options = {}) => streamed(await fakeUnderstanding(input), options),
  match: (input) => fakeMatches(input),
  compose: async (input, options = {}) => streamed(fakeComposition(input), options),
  // La réparation simulée rend la même réponse : les règles du serveur gardent alors la meilleure.
  repair: async (input) => {
    failAt("repair", input.request);
    return fakeComposition(input);
  },
});
