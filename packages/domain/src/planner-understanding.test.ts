import type { PlannerUnderstanding } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { plannerMovementTerm, plannerNormalizeUnderstanding } from "./planner-understanding";

// Lundi 23 novembre 2026.
const today = "2026-11-23";
const period = { from: "2026-11-23", to: "2026-12-20" };
const targets = [{ token: "group_1" }, { token: "group_2" }];
const session = (patch: Partial<PlannerUnderstanding["sessions"][number]> = {}) => ({
  date: null,
  dateSaid: null,
  startTime: null,
  targetTokens: [],
  movements: [],
  structure: null,
  proposal: null,
  ...patch,
});
const understood = (patch: Partial<PlannerUnderstanding> = {}): PlannerUnderstanding => ({
  summary: "Tu veux une séance.",
  offTopic: false,
  intent: "described",
  sessions: [session()],
  corrections: [],
  ...patch,
});
const movement = (id: string, said: string, prescription: string | null = null) => ({
  id,
  said,
  prescription,
  replaces: null,
});
const normalize = (raw: PlannerUnderstanding, text: string, extra = {}) =>
  plannerNormalizeUnderstanding(raw, { text, today, period, targets, targetsChosen: true, ...extra });

describe("dates", () => {
  it("la date écrite par le coach l'emporte sur celle du modèle", () => {
    const request = normalize(
      understood({ sessions: [session({ date: "2026-11-25", dateSaid: "demain" })] }),
      "Demain pour group_1 : squat arrière, 3 séries de 8.",
    );
    expect(request.sessions[0]!.date).toBe("2026-11-24");
    expect(request.blockers).toEqual([]);
  });
  it("un jour de semaine seul donne sa première occurrence, pas le premier jour de la période", () => {
    const request = normalize(understood(), "Jeudi, squat arrière 3 séries de 8.");
    expect(request.sessions[0]!.date).toBe("2026-11-26");
  });
  it("garde une date du modèle appuyée sur les mots du coach, quand aucune règle ne la reconnaît", () => {
    const request = normalize(
      understood({ sessions: [session({ date: "2026-11-26", dateSaid: "dans trois jours" })] }),
      "Dans trois jours, squat arrière 3 séries de 8.",
    );
    expect(request.sessions[0]!.date).toBe("2026-11-26");
  });
  it("aucune date déductible : un blocage nommé, jamais une date inventée", () => {
    const request = normalize(
      understood({ sessions: [session({ date: "2026-11-23", dateSaid: "quand la météo le permettra" })] }),
      "Séance de côtes pour group_1 quand la météo le permettra : 8 fois course en côte.",
    );
    expect(request.sessions[0]!.date).toBeNull();
    expect(request.blockers).toEqual([
      { kind: "no_date", session: 0, said: "quand la météo le permettra", outOfPeriod: false },
    ]);
  });
  it("une date hors de la période est dite hors période", () => {
    const request = normalize(understood(), "Le 3 janvier, squat arrière 3 séries de 8.");
    expect(request.blockers).toMatchObject([{ kind: "no_date", outOfPeriod: true }]);
  });
  it("une suite de jours (« du lundi au vendredi ») donne une séance par jour, sans question", () => {
    const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];
    const request = normalize(
      understood({ sessions: week.map((date) => session({ date, dateSaid: "du lundi au vendredi" })) }),
      "Du lundi au vendredi pour group_1 : gainage ventral 3 fois 40 secondes.",
    );
    expect(request.sessions.map((entry) => entry.date)).toEqual(week);
    expect(request.blockers).toEqual([]);
    // Deux jours nommés seulement : un troisième jour, que rien ne cite, reste une question.
    const two = normalize(
      understood({ sessions: [session({ date: "2026-11-24" }), session({ date: "2026-11-25" })] }),
      "Mardi et jeudi pour group_1 : gainage ventral 3 fois 40 secondes.",
    );
    expect(two.blockers).toEqual([{ kind: "no_date", session: 1, said: null, outOfPeriod: false }]);
  });
  it("sans jour dans la demande, le jour choisi à l'écran vaut", () => {
    const request = normalize(understood(), "Squat arrière, 3 séries de 8.", { hints: { date: "2026-11-27" } });
    expect(request.sessions[0]!.date).toBe("2026-11-27");
    expect(request.blockers).toEqual([]);
  });
});

describe("destinataires", () => {
  it("choisis à l'écran, ils valent tous ; un destinataire désigné vaut seul", () => {
    expect(normalize(understood(), "Demain, squat arrière 3 x 8.").sessions[0]!.targetTokens).toEqual([
      "group_1",
      "group_2",
    ]);
    expect(normalize(understood(), "Demain pour group_2, squat arrière 3 x 8.").sessions[0]!.targetTokens).toEqual([
      "group_2",
    ]);
  });
  it("aucun destinataire choisi ni cité : une question, pas une erreur de saisie", () => {
    const request = normalize(
      understood({ sessions: [session({ targetTokens: ["group_1"] })] }),
      "Demain, squat arrière 3 x 8.",
      { targetsChosen: false },
    );
    expect(request.sessions[0]!.targetTokens).toEqual([]);
    expect(request.blockers).toEqual([{ kind: "no_recipient", session: 0 }]);
  });
  it("aucun destinataire choisi, mais un groupe cité : il est retenu", () => {
    const request = normalize(understood(), "Demain pour group_2, squat arrière 3 x 8.", { targetsChosen: false });
    expect(request.sessions[0]!.targetTokens).toEqual(["group_2"]);
    expect(request.blockers).toEqual([]);
  });
});

describe("mouvements", () => {
  it("un jeton de destinataire n'est jamais un mouvement", () => {
    expect(plannerMovementTerm("group_1")).toBeNull();
    expect(plannerMovementTerm("group_1 quand la météo le permettra")).toBe("quand la météo le permettra");
    const request = normalize(
      understood({
        sessions: [
          session({
            date: "2026-11-24",
            movements: [movement("m1", "group_1"), movement("m2", "athlete_3, squat arrière", "3 x 8")],
          }),
        ],
      }),
      "Demain pour group_1 : squat arrière, 3 x 8.",
    );
    // Le jeton disparaît, le mouvement réel garde le terme du coach et reprend le premier identifiant.
    expect(request.sessions[0]!.movements).toMatchObject([{ id: "m1", said: "squat arrière", prescription: "3 x 8" }]);
  });
  it("rend le terme tel que le coach l'a écrit, à la casse et aux accents près", () => {
    const request = normalize(
      understood({ sessions: [session({ movements: [movement("m1", "developpe couche")] })] }),
      "Demain : Développé couché, 4 x 6.",
    );
    expect(request.sessions[0]!.movements[0]!.said).toBe("Développé couché");
  });
});

describe("nature de la demande et partie à composer", () => {
  it("se lit dans le contenu : décrite, objectif ou mixte", () => {
    const proposal = { objective: "Mobilité", durationMin: 15, level: null, equipment: null, families: ["mobility" as const] };
    expect(
      normalize(understood({ sessions: [session({ movements: [movement("m1", "footing")] })] }), "Demain footing 20 min.")
        .intent,
    ).toBe("described");
    expect(normalize(understood({ sessions: [session({ proposal })] }), "Demain, mobilité.").intent).toBe("objective");
    expect(
      normalize(
        understood({ sessions: [session({ movements: [movement("m1", "footing")], proposal })] }),
        "Demain footing puis propose de la mobilité.",
      ).intent,
    ).toBe("mixed");
  });
  it("rien de décrit : tout est à composer, avec le matériel de l'espace quand la demande n'en dit rien", () => {
    const request = normalize(understood(), "Demain, une séance de renforcement.", {
      spaceEquipment: ["barbell", "bodyweight"],
    });
    expect(request.intent).toBe("objective");
    expect(request.sessions[0]!.proposal).toMatchObject({ equipment: ["barbell", "bodyweight"], durationMin: null });
  });
  it("les indices d'un client d'avant complètent ce que la demande ne dit pas", () => {
    const request = normalize(understood(), "Préparation physique générale.", {
      hints: { intent: "objective", date: "2026-11-25", durationMin: 30, level: "beginner", equipment: ["cones"] },
    });
    expect(request.sessions[0]).toMatchObject({
      date: "2026-11-25",
      proposal: { durationMin: 30, level: "beginner", equipment: ["cones"] },
    });
  });
});

describe("blocages", () => {
  it("hors sujet, vide ou trop long : une seule question", () => {
    expect(normalize(understood({ offTopic: true }), "Publie la séance de demain.").blockers).toEqual([
      { kind: "off_topic" },
    ]);
    expect(normalize(understood({ sessions: [] }), "Bonjour").blockers).toEqual([{ kind: "empty" }]);
    expect(
      normalize(understood({ sessions: Array.from({ length: 15 }, () => session()) }), "Quinze séances.").blockers,
    ).toEqual([{ kind: "too_many_sessions" }]);
  });
});
