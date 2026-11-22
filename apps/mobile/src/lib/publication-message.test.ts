import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import { publishedMessage } from "./publication-message";

describe("message de publication", () => {
  it("dit qu'un groupe vide ne reçoit rien, au lieu de promettre une notification", () => {
    expect(publishedMessage({ athletes: 0, notified: 0 })).toBe(m.nativePublication.empty);
    expect(publishedMessage({ athletes: 0, notified: 0 })).not.toBe(m.builder.published);
  });

  it("dit qu'aucune notification n'est partie quand personne n'a de compte", () => {
    expect(publishedMessage({ athletes: 3, notified: 0 })).toBe(
      "Séance publiée pour 3 athlètes. Aucun n'a encore de compte, donc aucune notification n'est partie : invite-les avec le lien du groupe.",
    );
  });

  it("compte les athlètes prévenus, au singulier comme au pluriel", () => {
    expect(publishedMessage({ athletes: 1, notified: 1 })).toBe("Séance publiée. 1 athlète reçoit la notification.");
    expect(publishedMessage({ athletes: 4, notified: 4 })).toBe(
      "Séance publiée. 4 athlètes reçoivent la notification.",
    );
    expect(publishedMessage({ athletes: 5, notified: 2 })).toBe(
      "Séance publiée pour 5 athlètes. 2 reçoivent la notification ; les autres n'ont pas encore de compte.",
    );
  });

  it("ne compte jamais plus de prévenus que de destinataires", () => {
    expect(publishedMessage({ athletes: 2, notified: 7 })).toBe(
      "Séance publiée. 2 athlètes reçoivent la notification.",
    );
  });

  it("reste neutre sans décompte du serveur", () => {
    expect(publishedMessage(undefined)).toBe(m.builder.published);
    expect(publishedMessage(null)).toBe(m.builder.published);
  });
});
