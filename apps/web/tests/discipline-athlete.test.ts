import { describe, expect, it } from "vitest";
import { disciplineAthlete } from "@/lib/discipline-athlete";

describe("athlète d'une discipline", () => {
  it("prend l'athlète de l'épreuve, quelle que soit l'écriture du coach", () => {
    expect(disciplineAthlete("110 m haies")).toBe("hurdles");
    expect(disciplineAthlete("Saut à la perche")).toBe("poleVault");
    expect(disciplineAthlete("Triple saut")).toBe("tripleJump");
    expect(disciplineAthlete("Lancer du disque 1,5 kg")).toBe("discus");
    expect(disciplineAthlete("Saut en longueur")).toBe("longJump");
    expect(disciplineAthlete("HAUTEUR")).toBe("highJump");
  });

  it("une autre discipline prend l'athlète des progrès", () => {
    expect(disciplineAthlete("100 m")).toBe("poleVault");
  });
});
