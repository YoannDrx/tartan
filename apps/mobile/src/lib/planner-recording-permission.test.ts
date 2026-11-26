import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  return {
    get: vi.fn(),
    ask: vi.fn(),
    mode: vi.fn(),
    record: vi.fn(),
    listeners,
    app: {
      currentState: "active",
      addEventListener: (_: string, listener: (state: string) => void) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
  };
});
vi.mock("react-native", () => ({ AppState: device.app, Platform: { OS: "android" } }));
vi.mock("expo-file-system", () => ({ File: class {} }));
vi.mock("./planner-recording-files", () => ({ claimPlannerRecorder: () => () => {} }));
vi.mock("expo-audio", () => ({
  AudioQuality: { MEDIUM: 1 },
  IOSOutputFormat: { MPEG4AAC: "aac" },
  setAudioModeAsync: device.mode,
  AudioModule: {
    getRecordingPermissionsAsync: device.get,
    requestRecordingPermissionsAsync: device.ask,
    AudioRecorder: class {
      prepareToRecordAsync() {
        return Promise.resolve();
      }
      record = device.record;
    },
  },
}));
import { createNativeDictationRecorder } from "./planner-recording";
function state(value: string) {
  device.app.currentState = value;
  for (const listener of device.listeners) listener(value);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  state("active");
  device.get.mockResolvedValue({ granted: false, canAskAgain: true });
  device.ask.mockImplementation(async () => {
    state("background");
    return { granted: true };
  });
});
afterEach(() => vi.useRealTimers());
describe("autorisation native du microphone", () => {
  it("prépare après le premier accord Android et le retour réel au premier plan", async () => {
    const prompt = vi.fn();
    const recorder = createNativeDictationRecorder(prompt);
    const ready = recorder.prepare(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(prompt.mock.calls).toEqual([[true]]);
    expect(device.mode).not.toHaveBeenCalled();
    state("active");
    await ready;
    recorder.start();
    expect(prompt.mock.calls).toEqual([[true], [false]]);
    expect(device.record).toHaveBeenCalledOnce();
  });
  it("ne rouvre pas le dialogue après un accord et ne démarre pas après une vraie sortie", async () => {
    device.get.mockResolvedValue({ granted: true });
    const prompt = vi.fn();
    const recorder = createNativeDictationRecorder(prompt);
    await recorder.prepare(new AbortController().signal);
    expect(device.ask).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    state("background");
    expect(() => recorder.start()).toThrow("dictation_cancelled");
    expect(device.record).not.toHaveBeenCalled();
  });
  it("abandonne quand l’app reste en arrière-plan après la décision du système", async () => {
    const prompt = vi.fn();
    const recorder = createNativeDictationRecorder(prompt);
    const refused = expect(recorder.prepare(new AbortController().signal)).rejects.toThrow("dictation_cancelled");
    await vi.advanceTimersByTimeAsync(3000);
    await refused;
    state("active");
    expect(prompt.mock.calls).toEqual([[true], [false]]);
    expect(device.mode).not.toHaveBeenCalled();
    expect(device.listeners.size).toBe(0);
  });
  it("respecte une annulation pendant le retour de la permission et un refus définitif", async () => {
    const controller = new AbortController();
    const recorder = createNativeDictationRecorder(vi.fn());
    const cancelled = expect(recorder.prepare(controller.signal)).rejects.toThrow("dictation_cancelled");
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await cancelled;
    device.get.mockResolvedValue({ granted: false, canAskAgain: false });
    state("active");
    await expect(recorder.prepare(new AbortController().signal)).rejects.toThrow("dictation_permission_denied");
    expect(device.ask).toHaveBeenCalledOnce();
    expect(device.record).not.toHaveBeenCalled();
  });
});
