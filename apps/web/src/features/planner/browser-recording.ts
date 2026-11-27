import { holdFeedback } from "@/lib/feedback";

export const WEB_DICTATION_MAX_BYTES = 3 * 1024 * 1024;
export const WEB_DICTATION_SECONDS = 179;
export type BrowserRecordingState = "idle" | "starting" | "recording" | "finishing";

type BrowserAudio = {
  getStream: () => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => MediaRecorder;
};
export function browserAudio(preferMp4 = false): BrowserAudio {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
    throw new Error("dictation_unsupported");
  // AAC est lisible par le lecteur natif iOS quand une consigne voyage entre appareils.
  const mp4 = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  const webm = "audio/webm;codecs=opus";
  const mimeType = (preferMp4 ? [...mp4, webm] : [webm, ...mp4]).find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("dictation_unsupported");
  return {
    getStream: () =>
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false }),
    createRecorder: (stream) => new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 }),
  };
}

type Capture = {
  closed: boolean;
  finishing: boolean;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  chunks: Blob[];
  bytes: number;
  timer?: ReturnType<typeof setTimeout>;
  // Les sons de l'app se taisent pendant l'enregistrement : ils finiraient dans la dictée.
  silence?: () => void;
};

// Aucun fichier, URL de blob, stockage local ou envoi ici. Le composant reçoit
// un seul Blob en mémoire ; le serveur vérifie à nouveau son contenu et sa durée.
export class BrowserPlannerRecording {
  private capture: Capture | null = null;
  constructor(
    private readonly callbacks: {
      onState: (state: BrowserRecordingState) => void;
      onAudio: (audio: Blob) => void;
      onError: (error: unknown) => void;
      audio?: () => BrowserAudio;
    },
  ) {}

  private release(capture: Capture) {
    if (capture.closed) return;
    capture.closed = true;
    capture.silence?.();
    clearTimeout(capture.timer);
    const recorder = capture.recorder;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* pistes libérées ci-dessous */
      }
    }
    for (const track of capture.stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    capture.chunks = [];
    capture.bytes = 0;
    if (this.capture === capture) {
      this.capture = null;
      this.callbacks.onState("idle");
    }
  }

  private fail(capture: Capture, error: unknown) {
    if (capture.closed) return;
    this.release(capture);
    this.callbacks.onError(error);
  }

  async start() {
    if (this.capture) return;
    const capture: Capture = { closed: false, finishing: false, chunks: [], bytes: 0, silence: holdFeedback() };
    this.capture = capture;
    this.callbacks.onState("starting");
    try {
      const audio = (this.callbacks.audio ?? browserAudio)();
      const stream = await audio.getStream();
      // getUserMedia peut rester en attente indéfiniment. Annuler n'attend pas
      // cette permission ; une réponse tardive libère immédiatement ses pistes.
      if (capture.closed) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      capture.stream = stream;
      if (stream.getAudioTracks().length !== 1 || stream.getVideoTracks().length)
        throw new Error("dictation_invalid_audio");
      const recorder = audio.createRecorder(stream);
      capture.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (capture.closed || !event.data.size) return;
        capture.bytes += event.data.size;
        if (capture.bytes > WEB_DICTATION_MAX_BYTES) {
          this.fail(capture, new Error("dictation_invalid_audio"));
          return;
        }
        capture.chunks.push(event.data);
      };
      recorder.onerror = () => this.fail(capture, new Error("dictation_recorder_failed"));
      recorder.onstop = () => {
        if (capture.closed) return;
        // Un arrêt du périphérique ou du navigateur n'est pas un accord d'envoi.
        if (!capture.finishing) {
          this.fail(capture, new Error("dictation_interrupted"));
          return;
        }
        if (!capture.bytes || !/^audio\/(webm|mp4)(;|$)/i.test(recorder.mimeType)) {
          this.fail(capture, new Error("dictation_invalid_audio"));
          return;
        }
        const blob = new Blob(capture.chunks, { type: recorder.mimeType });
        this.release(capture);
        this.callbacks.onAudio(blob);
      };
      for (const track of stream.getTracks())
        track.onended = () => this.fail(capture, new Error("dictation_interrupted"));
      recorder.start(1000);
      if (capture.closed) return;
      capture.timer = setTimeout(() => this.finish(), WEB_DICTATION_SECONDS * 1000);
      this.callbacks.onState("recording");
    } catch (error) {
      this.fail(capture, error);
    }
  }

  finish() {
    const capture = this.capture;
    if (!capture?.recorder || capture.closed || capture.finishing) return;
    capture.finishing = true;
    clearTimeout(capture.timer);
    this.callbacks.onState("finishing");
    // Certains navigateurs échouent à finaliser le conteneur. Borne aussi ce cas.
    capture.timer = setTimeout(() => this.fail(capture, new Error("dictation_recorder_failed")), 5000);
    try {
      capture.recorder.stop();
    } catch (error) {
      this.fail(capture, error);
    }
  }

  cancel() {
    if (this.capture) this.release(this.capture);
  }
}
