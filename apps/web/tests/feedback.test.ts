import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Environnement de navigateur minimal : stockage, document visible, contexte audio et vibration espionnés.
const started = vi.fn();
const vibrate = vi.fn();
let visibility = "visible";
let store: Record<string, string> = {};

class FakeContext {
  sampleRate = 22050;
  state = "running";
  destination = {};
  resume = vi.fn();
  createBuffer = (_channels: number, length: number) => ({ length, copyToChannel: vi.fn() });
  createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: started });
}

beforeEach(() => {
  vi.resetModules();
  started.mockReset();
  vibrate.mockReset();
  visibility = "visible";
  store = {};
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    querySelectorAll: () => [],
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => (store[key] = value),
  });
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("AudioContext", FakeContext);
});

afterEach(() => vi.unstubAllGlobals());

describe("retours sensoriels du web", () => {
  it("joue un son et vibre sur téléphone, activés par défaut", async () => {
    const { playFeedback, soundsEnabled } = await import("@/lib/feedback");
    expect(soundsEnabled()).toBe(true);
    playFeedback("success");
    expect(started).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([20, 40, 30]);
  });

  it("coupés sur cet appareil : plus aucun son", async () => {
    const { playFeedback, setSoundsEnabled } = await import("@/lib/feedback");
    setSoundsEnabled(false);
    playFeedback("tap");
    expect(started).not.toHaveBeenCalled();
  });

  it("se taisent pendant un enregistrement, puis reprennent", async () => {
    const { holdFeedback, playFeedback } = await import("@/lib/feedback");
    const release = holdFeedback();
    playFeedback("tap");
    expect(started).not.toHaveBeenCalled();
    release();
    release();
    playFeedback("tap");
    expect(started).toHaveBeenCalledTimes(1);
  });

  it("se taisent quand la page est en arrière-plan", async () => {
    const { playFeedback } = await import("@/lib/feedback");
    visibility = "hidden";
    playFeedback("restEnd");
    expect(started).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
