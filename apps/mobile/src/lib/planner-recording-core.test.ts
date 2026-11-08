import { describe, expect, it, vi } from "vitest";
import {
  DictationController,
  PLANNER_AUDIO_MAX_BYTES,
  isPlannerRecordingName,
  type DictationRecorder,
  type DictationState,
} from "./planner-recording-core";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup() {
  const recorder: DictationRecorder = {
    prepare: vi.fn(async () => undefined),
    start: vi.fn(),
    stop: vi.fn(async () => ({ uri: "file:///cache/recording-test.tartan.m4a", size: 3000 })),
    dispose: vi.fn(async () => undefined),
  };
  const states: DictationState[] = [];
  const transcribe = vi.fn(async (_file: unknown, _signal: AbortSignal) => "Consigne fictive");
  const onResult = vi.fn();
  const onError = vi.fn();
  const create = vi.fn(() => recorder);
  const controller = new DictationController({ create, transcribe, onResult, onError, onState: (s) => states.push(s) });
  return { controller, recorder, create, transcribe, states, onResult, onError };
}

describe("cycle de dictée native", () => {
  it("une double action démarre et envoie une seule dictée, puis libère le micro et le fichier", async () => {
    const s = setup();
    await Promise.all([s.controller.start(), s.controller.start()]);
    await Promise.all([s.controller.finish(), s.controller.finish()]);
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(s.recorder.start).toHaveBeenCalledTimes(1);
    expect(s.transcribe).toHaveBeenCalledTimes(1);
    expect(s.onResult).toHaveBeenCalledWith("Consigne fictive");
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(s.states.at(-1)).toBe("idle");
  });

  it("un refus du micro ne déclenche aucun envoi", async () => {
    const s = setup();
    vi.mocked(s.recorder.prepare).mockRejectedValueOnce(new Error("dictation_permission_denied"));
    await s.controller.start();
    expect(s.recorder.start).not.toHaveBeenCalled();
    expect(s.transcribe).not.toHaveBeenCalled();
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(s.onError).toHaveBeenCalledWith(new Error("dictation_permission_denied"));
  });

  it("une fermeture pendant la permission attend prepare sans commencer à enregistrer", async () => {
    const s = setup();
    const permission = deferred<void>();
    vi.mocked(s.recorder.prepare).mockReturnValueOnce(permission.promise);
    const start = s.controller.start();
    const cancelled = s.controller.cancel();
    expect(s.recorder.dispose).not.toHaveBeenCalled();
    permission.resolve();
    await Promise.all([start, cancelled]);
    expect(s.recorder.start).not.toHaveBeenCalled();
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it("le passage en arrière-plan pendant la capture nettoie sans transcrire", async () => {
    const s = setup();
    await s.controller.start();
    await s.controller.cancel();
    expect(s.transcribe).not.toHaveBeenCalled();
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(s.states.at(-1)).toBe("idle");
  });

  it("une annulation pendant stop ne laisse pas partir le fichier", async () => {
    const s = setup();
    const stopped = deferred<{ uri: string; size: number }>();
    vi.mocked(s.recorder.stop).mockReturnValueOnce(stopped.promise);
    await s.controller.start();
    const finish = s.controller.finish();
    const cancel = s.controller.cancel();
    stopped.resolve({ uri: "file:///audio", size: 123 });
    await Promise.all([finish, cancel]);
    expect(s.transcribe).not.toHaveBeenCalled();
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it("une réponse tardive après déconnexion est ignorée et la requête est annulée", async () => {
    const s = setup();
    const response = deferred<string>();
    s.transcribe.mockReturnValueOnce(response.promise);
    await s.controller.start();
    const finish = s.controller.finish();
    await Promise.resolve();
    const signal = s.transcribe.mock.calls[0]![1];
    const cancel = s.controller.cancel();
    expect(signal.aborted).toBe(true);
    response.resolve("Texte du compte précédent");
    await Promise.all([finish, cancel]);
    expect(s.onResult).not.toHaveBeenCalled();
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([0, PLANNER_AUDIO_MAX_BYTES + 1, NaN])(
    "refuse une taille invalide %s et détruit le fichier",
    async (size) => {
      const s = setup();
      vi.mocked(s.recorder.stop).mockResolvedValueOnce({ uri: "file:///audio", size });
      await s.controller.start();
      await s.controller.finish();
      expect(s.transcribe).not.toHaveBeenCalled();
      expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
      expect(s.onError).toHaveBeenCalledWith(new Error("dictation_invalid_audio"));
    },
  );

  it("un échec réseau détruit le fichier sans réessayer automatiquement", async () => {
    const s = setup();
    s.transcribe.mockRejectedValueOnce(new Error("network"));
    await s.controller.start();
    await s.controller.finish();
    expect(s.transcribe).toHaveBeenCalledTimes(1);
    expect(s.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(s.onResult).not.toHaveBeenCalled();
  });

  it("un échec de suppression reste visible et aucun nouveau micro ne s'ouvre pendant le nettoyage", async () => {
    const s = setup();
    const cleanup = deferred<void>();
    vi.mocked(s.recorder.dispose).mockImplementationOnce(async () => {
      await cleanup.promise;
      throw new Error("dictation_cleanup_failed");
    });
    await s.controller.start();
    const cancel = s.controller.cancel();
    await Promise.resolve();
    await s.controller.start();
    expect(s.create).toHaveBeenCalledTimes(1);
    cleanup.resolve();
    await cancel;
    expect(s.onError).toHaveBeenCalledWith(new Error("dictation_cleanup_failed"));
  });

  it("ne sélectionne pas les vidéos, autres audios ou chemins pour le nettoyage de reprise", () => {
    expect(isPlannerRecordingName("recording-7146CA86-005B.tartan.m4a")).toBe(true);
    for (const name of [
      "recording-abc.m4a",
      "video.tartan.m4a",
      "../recording-a.tartan.m4a",
      "recording-a.tartan.m4a.bak",
      "recording-a.mp4",
    ]) {
      expect(isPlannerRecordingName(name)).toBe(false);
    }
  });
});
