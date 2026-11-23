import { describe, expect, it } from "vitest";
import { historyShareWidens, normalizeHistoryScopes, readableHistoryScopes } from "./history-share";

describe("partage de l'historique personnel", () => {
  it("garde les cases connues, sans doublon, dans l'ordre de l'écran ; la santé n'en est pas une", () => {
    expect(normalizeHistoryScopes(["sessions", "records", "records", "health", "injuries"])).toEqual([
      "records",
      "sessions",
    ]);
  });

  it("un partage retiré ou vide ne laisse rien lire", () => {
    expect(readableHistoryScopes(null)).toEqual([]);
    expect(readableHistoryScopes({ scopes: ["records"], revokedAt: new Date() })).toEqual([]);
    expect(readableHistoryScopes({ scopes: [], revokedAt: null })).toEqual([]);
    expect(readableHistoryScopes({ scopes: ["strength", "records"], revokedAt: null })).toEqual([
      "records",
      "strength",
    ]);
  });

  it("le coach est prévenu quand le partage s'ouvre ou s'élargit, pas quand il se resserre", () => {
    expect(historyShareWidens([], ["records"])).toBe(true);
    expect(historyShareWidens(["records"], ["records", "sessions"])).toBe(true);
    expect(historyShareWidens(["records", "sessions"], ["records"])).toBe(false);
  });
});
