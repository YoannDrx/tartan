import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { sendHeartbeat } from "@/server/heartbeat";

describe("signal de vie des tâches planifiées", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    env().CRON_HEARTBEAT_URL = "https://sonde.test/horaire";
    env().CRON_HEARTBEAT_NOTIFICATIONS_URL = "https://sonde.test/notifications";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    env().CRON_HEARTBEAT_URL = undefined;
    env().CRON_HEARTBEAT_NOTIFICATIONS_URL = undefined;
  });
  it("chaque tâche appelle sa propre adresse", async () => {
    await sendHeartbeat("hourly", []);
    await sendHeartbeat("notifications");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://sonde.test/horaire",
      "https://sonde.test/notifications",
    ]);
  });
  it("aucun appel si une tâche a échoué", async () => {
    await sendHeartbeat("hourly", ["billing"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("aucun appel sans adresse configurée", async () => {
    env().CRON_HEARTBEAT_URL = undefined;
    await sendHeartbeat("hourly", []);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("une sonde injoignable ne fait pas échouer la tâche", async () => {
    fetchMock.mockRejectedValueOnce(new Error("réseau"));
    await expect(sendHeartbeat("hourly", [])).resolves.toBeUndefined();
  });
});
