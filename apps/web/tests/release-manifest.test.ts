import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareVersions } from "@tartan/domain";
import { releases } from "@tartan/i18n";
import { describe, expect, it } from "vitest";

const config = readFileSync(join(import.meta.dirname, "../../mobile/app.config.ts"), "utf8");
const configured = /version:\s*"(\d+\.\d+\.\d+)"/.exec(config)?.[1];

describe("manifeste des versions", () => {
  it("n'annonce jamais un binaire plus récent que celui configuré", () => {
    expect(configured).toBeDefined();
    for (const release of releases) {
      for (const target of [release.targets.ios, release.targets.android]) {
        if (target) expect(compareVersions(target.version, configured)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("a des identifiants uniques et des notes pour au moins un public", () => {
    expect(new Set(releases.map((release) => release.id)).size).toBe(releases.length);
    for (const release of releases) {
      expect(release.coach.length + release.athlete.length).toBeGreaterThan(0);
      expect(release.title).not.toBe("À rédiger");
    }
  });
});
