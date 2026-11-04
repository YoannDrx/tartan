import { describe, expect, it, vi } from "vitest";
import { createLaunchRoute } from "./notification-launch";

describe("toucher une notification, app fermée", () => {
  it("garde la route tant que la navigation n'est pas prête, puis l'efface après usage", () => {
    const launch = createLaunchRoute();
    const navigate = vi.fn();
    launch.offer("/session/1", navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(launch.take()).toBe("/session/1");
    expect(launch.take()).toBeNull();
  });
  it("une fois l'app prête, navigue tout de suite", () => {
    const launch = createLaunchRoute();
    const navigate = vi.fn();
    launch.take();
    launch.offer("/today", navigate);
    expect(navigate).toHaveBeenCalledWith("/today");
  });
  it("une route non consommée n'est pas perdue si la session n'est pas prête", () => {
    const launch = createLaunchRoute();
    const navigate = vi.fn();
    launch.offer("/video/1", navigate);
    launch.offer("/video/2", navigate);
    expect(launch.take()).toBe("/video/2");
  });
});
