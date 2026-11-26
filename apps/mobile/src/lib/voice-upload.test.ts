import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), fetch: vi.fn() }));
vi.mock("expo-file-system", () => ({
  File: class {
    type = "audio/mpeg";
    bytes() {
      return Promise.resolve(native.bytes);
    }
  },
}));
vi.mock("expo/fetch", () => ({ fetch: native.fetch }));
import { uploadVoiceFile } from "./voice-upload";

describe("envoi des fichiers AAC enregistrés par le téléphone", () => {
  it.each([
    ["/orgs/org/voice-instructions", "POST", {}],
    ["/orgs/org/sessions/session/voice-debrief", "PUT", {}],
    ["/orgs/org/sessions/session/thread?itemRef=step", "POST", { "Idempotency-Key": "operation" }],
  ] as const)("préserve le type MP4, les octets et l’authentification vers %s", async (path, method, extra) => {
    const signal = new AbortController().signal;
    await uploadVoiceFile(path, method, "file:///recording.tartan.m4a", { Cookie: "fixture", ...extra }, signal);
    expect(native.fetch).toHaveBeenLastCalledWith(path, {
      method,
      signal,
      credentials: "omit",
      headers: { Cookie: "fixture", ...extra, "Content-Type": "audio/mp4" },
      body: native.bytes,
    });
  });
});
