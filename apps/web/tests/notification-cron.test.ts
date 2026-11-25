import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/cron/notifications/route";

const mocks = vi.hoisted(() => ({
  secret: "cron-test",
  dispatch: vi.fn(),
  health: vi.fn(),
  beta: vi.fn(),
  outbox: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: () => ({ CRON_SECRET: mocks.secret }) }));
vi.mock("@/server/notification-delivery.service", () => ({
  dispatchPending: mocks.dispatch,
  notificationDeliveryHealth: mocks.health,
}));
vi.mock("@/server/beta-testers.service", () => ({ dispatchBeta: mocks.beta }));
vi.mock("@/server/email-outbox.service", () => ({ flushEmailOutbox: mocks.outbox }));
beforeEach(() => {
  mocks.secret = "cron-test";
  mocks.beta.mockReset().mockResolvedValue(undefined);
  mocks.outbox.mockReset().mockResolvedValue(3);
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
    expect(mocks.beta).not.toHaveBeenCalled();
    expect(mocks.outbox).not.toHaveBeenCalled();
  });
  it("déclenche les reprises et ne renvoie que les compteurs techniques", async () => {
    const response = await GET(new Request("https://test.invalid", { headers: { authorization: "Bearer cron-test" } }));
    expect(mocks.beta).toHaveBeenCalledOnce();
    expect(mocks.outbox).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({
      dispatched: 2,
      outbox: 3,
      pending: 1,
      failedLast24h: 1,
      undeliveredLast24h: 0,
    });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
