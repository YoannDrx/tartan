import { describe, expect, it } from "vitest";
import { switchAccount, type AccountSwitchSteps } from "./account-switch";

const recorder = () => {
  const calls: string[] = [];
  const step = (name: string) => async () => void calls.push(name);
  const steps: AccountSwitchSteps = {
    cancelQueries: step("cancel"),
    clearCookie: step("clear-cookie"),
    storeCookie: async (cookie) => void calls.push(`store:${cookie}`),
    clearData: step("clear-data"),
    forgetActiveSpace: () => void calls.push("forget-space"),
    refreshSession: step("refresh"),
    resetNavigation: () => void calls.push("reset"),
  };
  return { calls, steps };
};

describe("changement de compte par lien magique", () => {
  it("remplace le cookie avant de vider les données, puis repart de l'aiguillage", async () => {
    const { calls, steps } = recorder();
    await switchAccount("nouveau", steps);
    expect(calls).toEqual([
      "cancel",
      "clear-cookie",
      "store:nouveau",
      "clear-data",
      "forget-space",
      "refresh",
      "reset",
    ]);
  });

  it("ne vide rien et ne navigue pas si le nouveau cookie ne peut pas être enregistré", async () => {
    const { calls, steps } = recorder();
    steps.storeCookie = async () => {
      throw new Error("stockage indisponible");
    };
    await expect(switchAccount("nouveau", steps)).rejects.toThrow();
    expect(calls).toEqual(["cancel", "clear-cookie"]);
  });
});
