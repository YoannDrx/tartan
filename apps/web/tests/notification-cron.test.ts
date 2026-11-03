import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/cron/notifications/route";

const mocks = vi.hoisted(() => ({ secret: "cron-test", dispatch: vi.fn(), health: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({ CRON_SECRET: mocks.secret }) }));
vi.mock("@/server/notification-delivery.service", () => ({
  dispatchPending: mocks.dispatch,
  notificationDeliveryHealth: mocks.health,
}));
beforeEach(() => {
  mocks.secret = "cron-test";
  mocks.dispatch.mockReset().mockResolvedValue(2);
  mocks.health.mockReset().mockResolvedValue({ pending: 1, failedLast24h: 1, undeliveredLast24h: 0 });
});
describe("cron notifications", () => {
  it("refuse les appels sans secret, incorrects ou non configurés", async () => {
    for (const token of ["", "wrong"]) {
      expect(
        (await GET(new Request("https://test.invalid", { headers: { authorization: `Bearer ${token}` } }))).status,
      ).toBe(401);
    }
    mocks.secret = "";
    expect((await GET(new Request("https://test.invalid", { headers: { authorization: "Bearer " } }))).status).toBe(
      401,
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("déclenche les reprises et ne renvoie que les compteurs techniques", async () => {
    const response = await GET(new Request("https://test.invalid", { headers: { authorization: "Bearer cron-test" } }));
    expect(await response.json()).toEqual({ dispatched: 2, pending: 1, failedLast24h: 1, undeliveredLast24h: 0 });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
