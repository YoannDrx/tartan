import { describe, expect, it, vi } from "vitest";
import { runCronJobs } from "@/server/cron-runner";

describe("isolation des tâches planifiées", () => {
  it("un échec n'interrompt ni Stripe, ni les notifications, ni la sauvegarde des résultats", async () => {
    const billing = vi.fn().mockResolvedValue({ synced: 2, failed: 0 });
    const dispatched = vi.fn().mockResolvedValue(3);
    const result = await runCronJobs({
      closed: async () => {
        throw new Error("contenu sensible qui ne doit pas être renvoyé");
      },
      billing,
      dispatched,
    });
    expect(billing).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ closed: null, billing: { synced: 2, failed: 0 }, dispatched: 3, errors: ["closed"] });
  });
});
