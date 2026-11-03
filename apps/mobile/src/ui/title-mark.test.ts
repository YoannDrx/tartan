import { describe, expect, it } from "vitest";
import { splitTitle } from "./title-mark";

describe("splitTitle", () => {
  it("sépare le dernier mot", () => {
    expect(splitTitle("Salut Yoann")).toEqual({ lead: "Salut ", mark: "Yoann" });
    expect(splitTitle("Mes sauts")).toEqual({ lead: "Mes ", mark: "sauts" });
  });

  it("marque le mot entier quand il est seul", () => {
    expect(splitTitle("Aujourd'hui")).toEqual({ lead: "", mark: "Aujourd'hui" });
  });

  it("garde la ponctuation finale avec le dernier mot", () => {
    expect(splitTitle("Salut Yoann !")).toEqual({ lead: "Salut ", mark: "Yoann !" });
    expect(splitTitle("Salut Yoann !")).toEqual({ lead: "Salut ", mark: "Yoann !" });
  });

  it("reconstitue le titre entier", () => {
    const title = "Yoann t'invite à rejoindre Perche Élite";
    const { lead, mark } = splitTitle(title);
    expect(`${lead}${mark}`).toBe(title);
  });

  it("supporte les espaces en trop et le titre vide", () => {
    expect(splitTitle("  Ton profil ")).toEqual({ lead: "Ton ", mark: "profil" });
    expect(splitTitle("")).toEqual({ lead: "", mark: "" });
  });
});
