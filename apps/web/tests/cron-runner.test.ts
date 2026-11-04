import { describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { runCronJobs } from "@/server/cron-runner";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), flush: vi.fn().mockResolvedValue(true) }));

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
  it("une tâche en panne remonte à Sentry par son nom, sans le contenu de l'erreur", async () => {
    vi.mocked(Sentry.captureMessage).mockClear();
    await runCronJobs({
      billing: async () => {
        throw new Error("athlete@example.com douleur");
      },
    });
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = vi.mocked(Sentry.captureMessage).mock.calls[0]!;
    expect(message).toBe("cron_job_failed");
    expect(context).toEqual({ level: "error", tags: { job: "billing" } });
    expect(Sentry.flush).toHaveBeenCalled();
  });
  it("sans panne, Sentry n'est pas sollicité", async () => {
    vi.mocked(Sentry.captureMessage).mockClear();
    await runCronJobs({ billing: async () => 1 });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
