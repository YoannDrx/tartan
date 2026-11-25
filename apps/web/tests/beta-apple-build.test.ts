import { expect, it } from "vitest";
import { canInviteToAppleBuild } from "@/server/beta-apple";
const build = (state: string, expired = false) => ({
  data: {
    attributes: { expired },
    relationships: { betaGroups: { data: [{ id: "terrain" }] }, buildBetaDetail: { data: { id: "candidate" } } },
  },
  included: [
    { type: "buildBetaDetails", id: "candidate", attributes: { externalBuildState: state } },
    { type: "betaGroups", id: "terrain", attributes: {} },
  ],
});
it("vérifie auprès d’Apple le candidat, son groupe, son expiration et sa disponibilité externe", () => {
  expect(canInviteToAppleBuild(build("READY_FOR_BETA_TESTING"), "terrain")).toBe(true);
  expect(canInviteToAppleBuild(build("IN_BETA_TESTING"), "terrain")).toBe(true);
  expect(canInviteToAppleBuild(build("WAITING_FOR_BETA_REVIEW"), "terrain")).toBe(false);
  expect(canInviteToAppleBuild(build("IN_BETA_TESTING", true), "terrain")).toBe(false);
  expect(canInviteToAppleBuild(build("IN_BETA_TESTING"), "autre")).toBe(false);
  const other = build("IN_BETA_TESTING");
  other.included[0]!.id = "other";
  expect(canInviteToAppleBuild(other, "terrain")).toBe(false);
});
