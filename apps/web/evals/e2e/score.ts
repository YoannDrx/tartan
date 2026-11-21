// Notation d'un cas : pure, sans base ni réseau. Elle compare ce que le planificateur a rendu (`Observed`) aux
// propriétés attendues du cas, et se rejoue sur un ancien rapport sans refaire un seul appel.
import {
  sameName,
  foldName,
  type E2eBounds,
  type E2eCase,
  type E2eExpectedSession,
  type E2eFault,
  type E2eLoad,
  type E2eMovement,
  type E2eStep,
} from "./format";
import type { Observed, ObservedMovement, ObservedSession, ObservedStep } from "./observation";

export type CaseScore = {
  // Juste : aucun écart, aucune faute.
  passed: boolean;
  // Les écarts, par code. Une faute y figure toujours aussi.
  differences: string[];
  // Les fautes détectées, graves ou non pour ce cas.
  faults: E2eFault[];
  // Celles que le cas déclare graves.
  critical: E2eFault[];
  // Une question a arrêté le coach alors que la consigne suffisait.
  needlessQuestion: boolean;
  // Le détail lisible de chaque écart, pour relire un échec.
  notes: string[];
};

type Node<M> =
  | { kind: "movement"; movement: M }
  | { kind: "recovery"; seconds: number }
  | { kind: "group"; rounds: number; rest: number | undefined; steps: Node<M>[] };
type Flat<M> = {
  movements: M[];
  // Les mouvements de chaque groupe, par leur rang dans `movements`.
  groups: { members: number[]; rounds: number; rest: number | undefined }[];
  // Chaque pause explicite, placée après le mouvement de ce rang (−1 : avant le premier).
  recoveries: { after: number; seconds: number }[];
};

const expectedNodes = (steps: readonly E2eStep[]): Node<E2eMovement>[] =>
  steps.map((step) =>
    "rounds" in step
      ? {
          kind: "group",
          rounds: step.rounds,
          rest: step.restBetweenRoundsS,
          steps: expectedNodes(step.steps as E2eStep[]),
        }
      : "recoveryS" in step
        ? { kind: "recovery", seconds: step.recoveryS }
        : { kind: "movement", movement: step },
  );
const observedNodes = (steps: readonly ObservedStep[]): Node<ObservedMovement>[] =>
  steps.map((step) =>
    step.type === "group"
      ? { kind: "group", rounds: step.rounds, rest: step.restBetweenRoundsS, steps: observedNodes(step.steps) }
      : step.type === "recovery"
        ? { kind: "recovery", seconds: step.seconds }
        : { kind: "movement", movement: step },
  );

function flatten<M>(nodes: Node<M>[]): Flat<M> {
  const flat: Flat<M> = { movements: [], groups: [], recoveries: [] };
  const walk = (entries: Node<M>[]) => {
    for (const node of entries) {
      if (node.kind === "movement") flat.movements.push(node.movement);
      else if (node.kind === "recovery")
        flat.recoveries.push({ after: flat.movements.length - 1, seconds: node.seconds });
      else {
        const start = flat.movements.length;
        walk(node.steps);
        flat.groups.push({
          members: Array.from({ length: flat.movements.length - start }, (_, i) => start + i),
          rounds: node.rounds,
          rest: node.rest,
        });
      }
    }
  };
  walk(nodes);
  return flat;
}

// « Trois tours d'un seul exercice » et « trois séries » s'exécutent pareil : les deux écritures se valent.
const singleAsSets = (steps: readonly ObservedStep[]): ObservedStep[] =>
  steps.map((step) => {
    if (step.type !== "group") return step;
    const inner = singleAsSets(step.steps);
    const only = inner.length === 1 ? inner[0]! : null;
    return only?.type === "movement" && only.sets === 1
      ? { ...only, sets: step.rounds, restS: step.restBetweenRoundsS || only.restS }
      : { ...step, steps: inner };
  });

const matches = (expected: E2eMovement, actual: ObservedMovement) =>
  expected.key !== undefined
    ? actual.ref.kind === "catalog" &&
      (actual.ref.key === expected.key || (expected.accept ?? []).includes(actual.ref.key))
    : expected.private !== undefined
      ? actual.ref.kind === "private" && sameName(actual.ref.name, expected.private)
      : actual.ref.kind === "placeholder";

const sameLoad = (a: E2eLoad | null, b: E2eLoad | null) =>
  a === null ? b === null : b !== null && a.unit === b.unit && a.value === b.value;
const loadsOf = (load: E2eLoad | null, plan: readonly { load: E2eLoad | null }[] | null | undefined) =>
  [load, ...(plan ?? []).map((set) => set.load)].filter((value): value is E2eLoad => value !== null);
const refLabel = (movement: ObservedMovement) =>
  movement.ref.kind === "catalog" ? movement.ref.key : `${movement.ref.kind}:${movement.ref.name}`;
const expectedLabel = (movement: E2eMovement) => movement.key ?? movement.private ?? `absent:${movement.said}`;

type Sink = {
  add: (code: string, note?: string) => void;
  fault: (fault: E2eFault, note?: string) => void;
};

function comparePrescription(expected: E2eMovement, actual: ObservedMovement, where: string, sink: Sink) {
  const field = (code: string, want: number | undefined, got: number | null) => {
    if (want !== undefined && got !== want) sink.add(code, `${where} : ${code} ${got ?? "absent"} au lieu de ${want}`);
  };
  field("sets", expected.sets, actual.sets);
  field("reps", expected.reps, actual.reps);
  field("duration", expected.durationS, actual.durationS);
  field("distance", expected.distanceM, actual.distanceM);
  field("rest", expected.restS, actual.restS ?? 0);
  if (!sameLoad(expected.load, actual.load))
    sink.add("load", `${where} : charge ${JSON.stringify(actual.load)} au lieu de ${JSON.stringify(expected.load)}`);
  // Une charge que le coach n'a pas dite, sur la prescription ou sur une série détaillée.
  const allowed = loadsOf(expected.load, expected.setPlan);
  const invented = loadsOf(actual.load, actual.setPlan).filter((load) => !allowed.some((a) => sameLoad(a, load)));
  if (invented.length) sink.fault("invented_load", `${where} : charge inventée ${JSON.stringify(invented[0])}`);
  if (expected.setPlan) {
    const plan = actual.setPlan ?? [];
    const same =
      plan.length === expected.setPlan.length &&
      expected.setPlan.every(
        (set, index) =>
          sameLoad(set.load, plan[index]!.load) && (set.reps === undefined || set.reps === plan[index]!.reps),
      );
    if (!same) sink.add("set_plan", `${where} : séries détaillées différentes`);
  }
}

// Plus longue suite commune, dans l'ordre : ce qui reste d'un côté est en trop, de l'autre il manque.
function commonOrder(expected: E2eMovement[], actual: ObservedMovement[]): [number, number][] {
  const n = expected.length,
    m = actual.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i]![j] = matches(expected[i]!, actual[j]!)
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (matches(expected[i]!, actual[j]!)) pairs.push([i++, j++]);
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  return pairs;
}

function compareSteps(
  expectedSteps: readonly E2eStep[],
  actualSteps: readonly ObservedStep[],
  options: { extrasAllowed: boolean; where: string },
  sink: Sink,
): { matched: Set<number>; actual: Flat<ObservedMovement> } {
  const expected = flatten(expectedNodes(expectedSteps));
  const actual = flatten(observedNodes(singleAsSets(actualSteps)));
  const E = expected.movements,
    O = actual.movements;
  let pairs: [number, number][];
  if (!options.extrasAllowed && E.length === O.length && E.every((movement, i) => matches(movement, O[i]!)))
    pairs = E.map((_, i) => [i, i]);
  else {
    // Mêmes exercices, autre ordre : un écart d'ordre, pas une substitution.
    const used = new Set<number>();
    const anyOrder = E.map((movement, i): [number, number] => {
      const j = O.findIndex((candidate, index) => !used.has(index) && matches(movement, candidate));
      if (j >= 0) used.add(j);
      return [i, j];
    });
    if (!options.extrasAllowed && E.length === O.length && anyOrder.every(([, j]) => j >= 0)) {
      sink.add("order", `${options.where} : mêmes exercices, dans un autre ordre`);
      pairs = anyOrder;
    } else pairs = commonOrder(E, O);
  }
  const matchedExpected = new Set(pairs.map(([i]) => i)),
    matchedActual = new Set(pairs.map(([, j]) => j));
  let missing = E.map((_, i) => i).filter((i) => !matchedExpected.has(i));
  let extra = O.map((_, j) => j).filter((j) => !matchedActual.has(j));
  if (!options.extrasAllowed) {
    // Un exercice attendu, présent mais ailleurs dans la séance : un écart d'ordre, pas un exercice remplacé.
    for (const i of [...missing]) {
      const j = extra.find((candidate) => matches(E[i]!, O[candidate]!));
      if (j === undefined) continue;
      sink.add("order", `${options.where} · ${expectedLabel(E[i]!)} : présent, à une autre place`);
      pairs.push([i, j]);
      matchedActual.add(j);
      missing = missing.filter((index) => index !== i);
      extra = extra.filter((index) => index !== j);
    }
  }
  const substitutions = options.extrasAllowed ? 0 : Math.min(missing.length, extra.length);
  for (let k = 0; k < substitutions; k++) {
    const want = E[missing[k]!]!,
      got = O[extra[k]!]!;
    const where = `${options.where} · ${expectedLabel(want)}`;
    if (got.ref.kind === "placeholder")
      sink.add("fiche_not_found", `${where} : laissé à compléter alors que la fiche existe`);
    else {
      sink.add(want.absent ? "absent_filled" : "exercise", `${where} : ${refLabel(got)} à la place`);
      // Un rapprochement montré « À vérifier » est un doute affiché ; sans marque, c'est un remplacement silencieux.
      if (!got.toVerify) sink.fault("wrong_exercise", `${where} : ${refLabel(got)} choisi sans « À vérifier »`);
    }
    comparePrescription(want, got, where, sink);
  }
  for (const i of missing.slice(substitutions))
    sink.add("missing_exercise", `${options.where} · ${expectedLabel(E[i]!)} : absent de la séance`);
  if (!options.extrasAllowed)
    for (const j of extra.slice(substitutions))
      sink.fault("added_exercise", `${options.where} : ${refLabel(O[j]!)} ajouté, le coach ne l'a pas dit`);
  for (const [i, j] of pairs) comparePrescription(E[i]!, O[j]!, `${options.where} · ${expectedLabel(E[i]!)}`, sink);

  // La structure ne se compare que si chaque mouvement attendu a été retrouvé, à sa place.
  const ordered = [...pairs].sort((a, b) => a[0] - b[0]);
  const inOrder = ordered.every(([, j], index) => index === 0 || ordered[index - 1]![1] < j);
  if (pairs.length === E.length && inOrder) {
    const map = new Map(pairs);
    const key = (members: number[]) => [...members].sort((a, b) => a - b).join(",");
    const claimed = new Set<string>();
    for (const group of expected.groups) {
      const mapped = group.members.map((i) => map.get(i)!);
      const found = options.extrasAllowed
        ? actual.groups
            .filter((candidate) => mapped.every((j) => candidate.members.includes(j)))
            .sort((a, b) => a.members.length - b.members.length)[0]
        : actual.groups.find((candidate) => key(candidate.members) === key(mapped));
      if (!found) {
        sink.add("structure", `${options.where} : les tours attendus ne regroupent pas ces exercices`);
        continue;
      }
      claimed.add(key(found.members));
      if (found.rounds !== group.rounds)
        sink.add("rounds", `${options.where} : ${found.rounds} tours au lieu de ${group.rounds}`);
      if (group.rest !== undefined && (found.rest ?? 0) !== group.rest)
        sink.add("round_rest", `${options.where} : ${found.rest ?? 0} s entre les tours au lieu de ${group.rest}`);
    }
    if (!options.extrasAllowed) {
      if (actual.groups.some((group) => !claimed.has(key(group.members))))
        sink.add("structure", `${options.where} : des tours que le coach n'a pas demandés`);
      for (const recovery of expected.recoveries) {
        const after = recovery.after < 0 ? -1 : map.get(recovery.after)!;
        if (!actual.recoveries.some((r) => r.after === after && r.seconds === recovery.seconds))
          sink.add("recovery", `${options.where} : pause de ${recovery.seconds} s absente`);
      }
    }
  }
  return { matched: matchedActual, actual };
}

function checkBounds(
  bounds: E2eBounds,
  session: ObservedSession,
  flat: Flat<ObservedMovement>,
  described: Set<number>,
  where: string,
  sink: Sink,
) {
  const count = flat.movements.length;
  if (count < bounds.exercises.min || count > bounds.exercises.max)
    sink.add(
      "exercise_count",
      `${where} : ${count} exercices, attendu ${bounds.exercises.min} à ${bounds.exercises.max}`,
    );
  if (bounds.durationMin) {
    if (session.durationMin === null) sink.add("duration_missing", `${where} : durée absente`);
    else if (session.durationMin > bounds.durationMin.max)
      sink.add("duration_over", `${where} : ${session.durationMin} min, au plus ${bounds.durationMin.max}`);
    else if (bounds.durationMin.min !== undefined && session.durationMin < bounds.durationMin.min)
      sink.add("duration_under", `${where} : ${session.durationMin} min, au moins ${bounds.durationMin.min}`);
  }
  if (bounds.equipment) {
    const allowed = new Set<string>(bounds.equipment);
    for (const movement of flat.movements) {
      if (movement.ref.kind === "placeholder") continue;
      if (movement.equipment === null)
        sink.add("equipment_unknown", `${where} · ${refLabel(movement)} : matériel inconnu`);
      else if (movement.equipment.some((item) => !allowed.has(item)))
        sink.add("equipment", `${where} · ${refLabel(movement)} : matériel non permis`);
    }
  }
  for (const family of bounds.families ?? [])
    if (!flat.movements.some((movement) => movement.family === family))
      sink.add("family_missing", `${where} : famille ${family} non couverte`);
  if (bounds.noKg)
    flat.movements.forEach((movement, index) => {
      // Les mouvements que le coach a décrits gardent leurs kilos : ils ont déjà été comparés.
      if (described.has(index)) return;
      if (loadsOf(movement.load, movement.setPlan).some((load) => load.unit === "kg"))
        sink.fault("invented_load", `${where} · ${refLabel(movement)} : kilos que le coach n'a pas donnés`);
    });
}

function scoreSession(test: E2eCase, expected: E2eExpectedSession, actual: ObservedSession, sink: Sink) {
  const where = `séance du ${actual.date}`;
  const want = expected.recipients ?? test.recipients;
  const names = (values: readonly string[]) => values.map(foldName).sort().join("|");
  if (
    names(want.groups) !== names(actual.recipients.groups) ||
    names(want.athletes) !== names(actual.recipients.athletes)
  )
    sink.add("recipients", `${where} : destinataires différents`);
  if (expected.steps) {
    const { matched, actual: flat } = compareSteps(
      expected.steps,
      actual.steps,
      { extrasAllowed: test.kind === "mixed", where },
      sink,
    );
    if (expected.bounds) checkBounds(expected.bounds, actual, flat, matched, where, sink);
  } else if (expected.bounds) {
    const flat = flatten(observedNodes(actual.steps));
    if (flat.movements.some((movement) => movement.ref.kind === "placeholder"))
      sink.add("placeholder", `${where} : un emplacement à compléter dans une séance proposée`);
    checkBounds(expected.bounds, actual, flat, new Set(), where, sink);
  }
}

const ASK_REASONS = { no_date: ["date"], no_recipient: ["recipient"], off_topic: ["off_topic", "other"] } as const;

export function scoreCase(test: E2eCase, actual: Observed): CaseScore {
  const differences = new Set<string>(),
    faults = new Set<E2eFault>(),
    notes: string[] = [];
  let needlessQuestion = false;
  const sink: Sink = {
    add: (code, note) => {
      differences.add(code);
      if (note) notes.push(note);
    },
    fault: (fault, note) => {
      faults.add(fault);
      differences.add(fault);
      if (note) notes.push(note);
    },
  };
  const { expect } = test;
  if (actual.status === "error") sink.add("error", `panne : ${actual.error ?? "inconnue"}`);
  else if (expect.mustAsk) {
    const reasons: readonly string[] = ASK_REASONS[expect.mustAsk.reason];
    if (!actual.blocked) {
      sink.add("missing_question", `une question était attendue (${expect.mustAsk.reason})`);
      // Sans date possible, toute date est fausse ; hors sujet, tout exercice est ajouté.
      if (actual.sessions.length && expect.mustAsk.reason === "no_date") sink.fault("wrong_date", "date inventée");
      if (actual.sessions.length && expect.mustAsk.reason === "off_topic")
        sink.fault("added_exercise", "séance inventée pour une demande hors sujet");
    } else if (!actual.questions.some((question) => reasons.includes(question.reason)))
      sink.add(
        "question_reason",
        `question sur ${actual.questions.map((q) => q.reason).join(", ") || "rien"}, attendue : ${expect.mustAsk.reason}`,
      );
  } else if (actual.blocked) {
    needlessQuestion = true;
    sink.add(
      "needless_question",
      `question inutile sur ${actual.questions.map((q) => q.exerciseName ?? q.reason).join(", ") || "rien"}`,
    );
  } else {
    // Les séances s'apparient par date ; ce qui reste d'un côté ou de l'autre est une date fausse ou une séance absente.
    const free = actual.sessions.map((_, index) => index);
    const pairs: [E2eExpectedSession, ObservedSession][] = [];
    const unpaired: E2eExpectedSession[] = [];
    for (const expected of expect.sessions) {
      const at = free.findIndex((index) => actual.sessions[index]!.date === expected.date);
      if (at < 0) unpaired.push(expected);
      else pairs.push([expected, actual.sessions[free.splice(at, 1)[0]!]!]);
    }
    const dates = new Set(expect.sessions.map((session) => session.date));
    const leftover = free.map((index) => actual.sessions[index]!);
    for (const session of leftover) {
      if (dates.has(session.date)) sink.add("extra_session", `une séance de trop le ${session.date}`);
      else sink.fault("wrong_date", `séance placée le ${session.date}, attendu ${[...dates].join(", ")}`);
    }
    if (actual.sessions.length !== expect.sessions.length)
      sink.add("session_count", `${actual.sessions.length} séances au lieu de ${expect.sessions.length}`);
    // Une séance mal datée est quand même comparée : une charge inventée ne se cache pas derrière une date fausse.
    unpaired.forEach((expected, index) => {
      if (leftover[index]) pairs.push([expected, leftover[index]]);
      else sink.add("session_missing", `aucune séance le ${expected.date}`);
    });
    for (const [expected, session] of pairs) scoreSession(test, expected, session, sink);
  }
  const found = [...faults];
  return {
    passed: differences.size === 0,
    differences: [...differences],
    faults: found,
    critical: found.filter((fault) => expect.critical.includes(fault)),
    needlessQuestion,
    notes,
  };
}
