import { describe, expect, it } from "vitest";
import { avatarSource, initialsOf, knownAvatarPreset } from "./avatar";

describe("initialsOf", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(initialsOf("Léa", "Martin")).toBe("LM");
    expect(initialsOf("léa", "martin")).toBe("LM");
  });
  it("garde les accents, et un prénom composé donne sa première lettre", () => {
    expect(initialsOf("Élodie", "Ébène")).toBe("ÉÉ");
    expect(initialsOf("Jean-Pierre", "Dupont")).toBe("JD");
    expect(initialsOf("Marie Claire", "Durand")).toBe("MD");
  });
  it("lit un nom complet quand le nom de famille manque", () => {
    expect(initialsOf("Inès Moreau", null)).toBe("IM");
    expect(initialsOf("Malo", "")).toBe("M");
    expect(initialsOf("", "Diallo")).toBe("D");
  });
  it("ignore les signes et les espaces en trop", () => {
    expect(initialsOf("  « Noé »  ", " d'Arc ")).toBe("ND");
    expect(initialsOf("", "")).toBe("");
    expect(initialsOf(null, undefined)).toBe("");
  });
});

describe("avatarSource", () => {
  const base = { firstName: "Awa", lastName: "Diallo" };
  it("la photo passe devant l'avatar choisi, qui passe devant les initiales", () => {
    expect(avatarSource({ ...base, avatarUrl: "https://x.test/a.webp", avatarPreset: "animal:fox" })).toEqual({
      kind: "photo",
      url: "https://x.test/a.webp",
    });
    expect(avatarSource({ ...base, avatarPreset: "animal:fox" })).toEqual({ kind: "preset", preset: "animal:fox" });
    expect(avatarSource({ ...base, avatarPreset: "athlete:highJump" })).toEqual({
      kind: "preset",
      preset: "athlete:highJump",
    });
    expect(avatarSource(base)).toEqual({ kind: "initials", initials: "AD" });
  });
  it("un avatar inconnu retombe sur les initiales", () => {
    expect(knownAvatarPreset("animal:dragon")).toBeNull();
    expect(knownAvatarPreset(null)).toBeNull();
    expect(avatarSource({ ...base, avatarPreset: "animal:dragon" }).kind).toBe("initials");
  });
});
