import { describe, expect, it } from "vitest";
import { plannerExerciseMentions, plannerUnknownExerciseTerms } from "./planner-mentions";

const catalog = [
  { token: "back", name: "Squat arrière", aliases: ["Back squat"] },
  { token: "front", name: "Squat avant", aliases: ["Front squat"] },
  { token: "stairs", name: "Montées d'escaliers", aliases: ["Marche dans les escaliers"] },
  { token: "pullup", name: "Tractions", aliases: [] },
  { token: "lunge", name: "Fentes avant", aliases: [] },
  { token: "knees", name: "Gammes : montées de genoux", aliases: [] },
  { token: "rotation", name: "Fente avec rotation du buste", aliases: [] },
];

describe("passe déterministe du planificateur", () => {
  it("repère un nom inconnu placé devant sa prescription", () => {
    expect(
      plannerUnknownExerciseTerms(
        "Mercredi pour le groupe : Squat du dragon, trois séries de six, récupération 45 secondes.",
        catalog,
      ),
    ).toEqual(["Squat du dragon"]);
    expect(plannerUnknownExerciseTerms("Combo coach 42 : 3 x 8, repos 1 min", catalog)).toEqual(["Combo coach 42"]);
  });
  it("ne signale ni une fiche connue, ni une date, ni le contexte", () => {
    for (const text of [
      "Lundi : squat arrière 4 séries de 5 à 60 kg, récupération 120 secondes.",
      "Pour le groupe : lundi 3 juin 2030 squat arrière, 3 séries de 4 à 40 kg",
      "Samedi, marche dans les escaliers : 4 passages de 12 marches, repos 60 secondes.",
      "Tractions au poids du corps, 4 séries de 6 répétitions, repos 2 minutes.",
      "Dimanche, deux séries de huit fentes avant par jambe, repos 90 secondes.",
      "Circuit A marche dans les escaliers puis B pompes. A : douze marches ; B : huit répétitions.",
      "Fentes avant avec deux haltères de 20, 3 séries de 10, repos 90 secondes.",
      "Mardi, gammes : montées de genoux, 4 x 20 m",
      "Fente avec rotation du buste, 3 séries de 8",
    ])
      expect(plannerUnknownExerciseTerms(text, catalog), text).toEqual([]);
  });
  it("une variante non couverte reste inconnue malgré un mot connu", () => {
    expect(plannerUnknownExerciseTerms("Squat arrière à la machine guidée, 3 séries de 4", catalog)).toEqual([
      "Squat arrière à la machine guidée",
    ]);
  });
  it("un choix du coach couvre le terme", () => {
    expect(
      plannerUnknownExerciseTerms("Squat du dragon, 3 séries de 6", catalog, [
        { term: "Squat du dragon", token: "back" },
      ]),
    ).toEqual([]);
  });
  it("retient le nom le plus long, jamais un alias partagé", () => {
    expect(plannerExerciseMentions("front squat puis squat arrière", catalog)).toEqual([
      { term: "front squat", token: "front" },
      { term: "squat arriere", token: "back" },
    ]);
  });
});
