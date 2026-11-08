import { afterEach, expect, it, vi } from "vitest";
import {
  BrowserPlannerRecording,
  WEB_DICTATION_MAX_BYTES,
  WEB_DICTATION_SECONDS,
} from "@/features/planner/browser-recording";

afterEach(() => vi.useRealTimers());

function setup() {
  const track = { stop: vi.fn(), onended: null as (() => void) | null };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
  const recorder = {
    state: "inactive",
    mimeType: "audio/webm;codecs=opus",
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
    onerror: null as (() => void) | null,
    start: vi.fn(() => {
      recorder.state = "recording";
    }),
    stop: vi.fn(() => {
      recorder.state = "inactive";
    }),
  };
  const getStream = vi.fn(async () => stream);
  const createRecorder = vi.fn(() => recorder as unknown as MediaRecorder);
  const onState = vi.fn(),
    onAudio = vi.fn(),
    onError = vi.fn();
  const capture = new BrowserPlannerRecording({
    onState,
    onAudio,
    onError,
    audio: () => ({ getStream, createRecorder }),
  });
  const data = (text: string) => recorder.ondataavailable?.({ data: new Blob([text]) });
  return { capture, track, stream, recorder, getStream, createRecorder, onState, onAudio, onError, data };
}

it("attend le dernier paquet après stop, déduplique les appuis et libère le micro avant de livrer l'audio", async () => {
  const s = setup();
  await Promise.all([s.capture.start(), s.capture.start()]);
  expect(s.getStream).toHaveBeenCalledTimes(1);
  s.data("premier");
  s.capture.finish();
  s.capture.finish();
  expect(s.recorder.stop).toHaveBeenCalledTimes(1);
  expect(s.onAudio).not.toHaveBeenCalled();
  s.data("dernier");
  const stopped = s.recorder.onstop!;
  stopped();
  stopped();
  expect(s.onAudio).toHaveBeenCalledTimes(1);
  expect(await (s.onAudio.mock.calls[0]![0] as Blob).text()).toBe("premierdernier");
  expect(s.track.stop).toHaveBeenCalledTimes(1);
  expect(s.track.stop.mock.invocationCallOrder[0]).toBeLessThan(s.onAudio.mock.invocationCallOrder[0]!);
  expect(s.onError).not.toHaveBeenCalled();
});

it("annule immédiatement une permission en attente et libère ses pistes si elle arrive plus tard", async () => {
  const s = setup();
  let allow!: (stream: MediaStream) => void;
  s.getStream.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        allow = resolve;
      }),
  );
  const pending = s.capture.start();
  s.capture.cancel();
  expect(s.onState).toHaveBeenLastCalledWith("idle");
  allow(s.stream);
  await pending;
  expect(s.track.stop).toHaveBeenCalledTimes(1);
  expect(s.createRecorder).not.toHaveBeenCalled();
  expect(s.onAudio).not.toHaveBeenCalled();
});

it("un refus tardif d'une ancienne permission ne perturbe pas la nouvelle capture", async () => {
  const s = setup();
  let deny!: (error: Error) => void;
  s.getStream.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        deny = reject;
      }),
  );
  const pending = s.capture.start();
  s.capture.cancel();
  await s.capture.start();
  deny(new DOMException("Permission refusée", "NotAllowedError"));
  await pending;
  expect(s.onError).not.toHaveBeenCalled();
  expect(s.onState).toHaveBeenLastCalledWith("recording");
  s.capture.cancel();
});

it("annuler pendant la finalisation ignore tous les paquets et événements tardifs", async () => {
  const s = setup();
  await s.capture.start();
  s.data("avant");
  s.capture.finish();
  const data = s.recorder.ondataavailable!,
    stopped = s.recorder.onstop!;
  s.capture.cancel();
  s.capture.cancel();
  data({ data: new Blob(["tardif"]) });
  stopped();
  expect(s.onAudio).not.toHaveBeenCalled();
  expect(s.onError).not.toHaveBeenCalled();
  expect(s.track.stop).toHaveBeenCalledTimes(1);
});

it("borne les octets à l'arrivée des paquets sans transmettre un fichier surdimensionné", async () => {
  const s = setup();
  await s.capture.start();
  s.recorder.ondataavailable!({ data: new Blob([new Uint8Array(WEB_DICTATION_MAX_BYTES + 1)]) });
  expect(s.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "dictation_invalid_audio" }));
  expect(s.track.stop).toHaveBeenCalledTimes(1);
  expect(s.onAudio).not.toHaveBeenCalled();
});

it("une perte de périphérique ou un arrêt spontané ne déclenche jamais un envoi", async () => {
  for (const cause of ["track", "recorder"] as const) {
    const s = setup();
    await s.capture.start();
    s.data("interrompu");
    if (cause === "track") s.track.onended!();
    else s.recorder.onstop!();
    expect(s.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "dictation_interrupted" }));
    expect(s.onAudio).not.toHaveBeenCalled();
    expect(s.track.stop).toHaveBeenCalledTimes(1);
  }
});

it("arrête à 179 secondes puis libère un enregistreur qui ne finalise jamais", async () => {
  vi.useFakeTimers();
  const s = setup();
  await s.capture.start();
  s.data("audio");
  vi.advanceTimersByTime(WEB_DICTATION_SECONDS * 1000);
  expect(s.recorder.stop).toHaveBeenCalledTimes(1);
  expect(s.onState).toHaveBeenLastCalledWith("finishing");
  vi.advanceTimersByTime(5000);
  expect(s.track.stop).toHaveBeenCalledTimes(1);
  expect(s.onError).toHaveBeenCalledTimes(1);
  expect(s.onAudio).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("libère le flux après erreur de construction, démarrage ou encodage", async () => {
  for (const stage of ["create", "start", "encode"] as const) {
    const s = setup();
    if (stage === "create")
      s.createRecorder.mockImplementationOnce(() => {
        throw new Error("unsupported");
      });
    if (stage === "start")
      s.recorder.start.mockImplementationOnce(() => {
        throw new Error("start failed");
      });
    await s.capture.start();
    if (stage === "encode") s.recorder.onerror!();
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    expect(s.onError).toHaveBeenCalledTimes(1);
    expect(s.onAudio).not.toHaveBeenCalled();
  }
});

it("refuse un résultat vide et conserve un conteneur MP4 reconnu pour Safari", async () => {
  const empty = setup();
  await empty.capture.start();
  empty.capture.finish();
  empty.recorder.onstop!();
  expect(empty.onError).toHaveBeenCalledTimes(1);
  expect(empty.onAudio).not.toHaveBeenCalled();
  const mp4 = setup();
  mp4.recorder.mimeType = "audio/mp4";
  await mp4.capture.start();
  mp4.data("mp4");
  mp4.capture.finish();
  mp4.recorder.onstop!();
  expect((mp4.onAudio.mock.calls[0]![0] as Blob).type).toBe("audio/mp4");
});
