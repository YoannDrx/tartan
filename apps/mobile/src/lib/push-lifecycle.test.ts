import { describe, expect, it, vi } from "vitest";
import { forgetDevicePush, stopDevicePush } from "./push-lifecycle";

const deps = () => ({
  currentToken: vi.fn().mockResolvedValue("ExponentPushToken[1]"),
  unregisterOnServer: vi.fn().mockResolvedValue(undefined),
  unregisterOnDevice: vi.fn().mockResolvedValue(undefined),
});

describe("déconnexion et notifications", () => {
  it("retire le jeton du serveur et désinscrit l'appareil", async () => {
    const d = deps();
    await forgetDevicePush(d);
    expect(d.unregisterOnServer).toHaveBeenCalledWith("ExponentPushToken[1]");
    expect(d.unregisterOnDevice).toHaveBeenCalled();
  });
  it("hors ligne, l'appareil se désinscrit quand même", async () => {
    const d = deps();
    d.unregisterOnServer.mockRejectedValue(new Error("réseau"));
    await expect(forgetDevicePush(d)).resolves.toBeUndefined();
    expect(d.unregisterOnDevice).toHaveBeenCalled();
  });
  it("sans jeton connu, l'appareil se désinscrit aussi", async () => {
    const d = deps();
    d.currentToken.mockRejectedValue(new Error("simulateur"));
    await forgetDevicePush(d);
    expect(d.unregisterOnServer).not.toHaveBeenCalled();
    expect(d.unregisterOnDevice).toHaveBeenCalled();
  });
  it("une session expirée coupe l'appareil, sans erreur", async () => {
    const d = deps();
    d.unregisterOnDevice.mockRejectedValue(new Error("indisponible"));
    await expect(stopDevicePush(d)).resolves.toBeUndefined();
  });
});
