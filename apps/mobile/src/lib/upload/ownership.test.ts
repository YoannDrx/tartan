import { describe, expect, it } from "vitest";
import { isOwnUpload } from "./ownership";

describe("propriétaire d'une vidéo en file", () => {
  it("n'envoie et n'affiche une vidéo que pour le compte qui l'a ajoutée", () => {
    expect(isOwnUpload({ ownerId: "lea" }, "lea")).toBe(true);
    expect(isOwnUpload({ ownerId: "lea" }, "tom")).toBe(false);
    expect(isOwnUpload({ ownerId: "lea" }, null)).toBe(false);
    expect(isOwnUpload({}, "lea")).toBe(false);
    expect(isOwnUpload({ ownerId: null }, null)).toBe(false);
  });
});
