// Cycle indépendant du micro natif : une seule dictée, aucune file persistante.
export const PLANNER_AUDIO_MAX_BYTES = 3 * 1024 * 1024;
// Une seconde de marge pour l'amorce AAC, comptée dans la durée vérifiée au serveur.
export const PLANNER_RECORDING_SECONDS = 179;
export const PLANNER_AUDIO_EXTENSION = ".tartan.m4a";

export type DictationState = "idle" | "starting" | "recording" | "transcribing" | "cleaning";
export type DictationFile = { uri: string; size: number };
export type DictationRecorder = {
  prepare: (signal: AbortSignal) => Promise<void>;
  start: () => void;
  stop: () => Promise<DictationFile>;
  dispose: () => Promise<void>;
};

type Run = {
  recorder: DictationRecorder;
  abort: AbortController;
  cancelled: boolean;
  task: Promise<void>;
  cleanup?: Promise<void>;
};

export class DictationController<T> {
  private run: Run | null = null;
  private state: DictationState = "idle";

  constructor(
    private readonly options: {
      create: () => DictationRecorder;
      transcribe: (file: DictationFile, signal: AbortSignal) => Promise<T>;
      onState: (state: DictationState) => void;
      onResult: (result: T) => void;
      onError: (error: unknown) => void;
    },
  ) {}

  private change(state: DictationState) {
    this.state = state;
    this.options.onState(state);
  }

  private async cleanup(run: Run) {
    this.change("cleaning");
    // Même promesse si l'annulation arrive pendant stop, l'envoi ou le nettoyage.
    run.cleanup ??= run.recorder.dispose();
    try {
      await run.cleanup;
    } catch (error) {
      this.options.onError(error);
    } finally {
      if (this.run === run) this.run = null;
      this.change("idle");
    }
  }

  start(): Promise<void> {
    if (this.run) return Promise.resolve();
    let recorder: DictationRecorder;
    try {
      recorder = this.options.create();
    } catch (error) {
      this.options.onError(error);
      return Promise.resolve();
    }
    const run: Run = { recorder, abort: new AbortController(), cancelled: false, task: Promise.resolve() };
    this.run = run;
    this.change("starting");
    run.task = (async () => {
      try {
        await recorder.prepare(run.abort.signal);
        if (run.cancelled) return;
        recorder.start();
        this.change("recording");
      } catch (error) {
        if (!run.cancelled) this.options.onError(error);
        run.cancelled = true;
      } finally {
        if (run.cancelled) await this.cleanup(run);
      }
    })();
    return run.task;
  }

  finish(): Promise<void> {
    const run = this.run;
    if (!run || this.state !== "recording") return Promise.resolve();
    this.change("transcribing");
    run.task = (async () => {
      try {
        const file = await run.recorder.stop();
        if (run.cancelled) return;
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > PLANNER_AUDIO_MAX_BYTES) {
          throw new Error("dictation_invalid_audio");
        }
        const result = await this.options.transcribe(file, run.abort.signal);
        if (!run.cancelled) this.options.onResult(result);
      } catch (error) {
        if (!run.cancelled) this.options.onError(error);
      } finally {
        await this.cleanup(run);
      }
    })();
    return run.task;
  }

  async cancel(): Promise<void> {
    const run = this.run;
    if (!run) return;
    const wasRecording = this.state === "recording";
    run.cancelled = true;
    run.abort.abort();
    this.change("cleaning");
    // prepare() doit terminer avant de libérer le micro et supprimer son fichier.
    await run.task;
    if (wasRecording) await this.cleanup(run);
  }
}

export const isPlannerRecordingName = (name: string): boolean => /^recording-[a-z0-9-]+\.tartan\.m4a$/i.test(name);
