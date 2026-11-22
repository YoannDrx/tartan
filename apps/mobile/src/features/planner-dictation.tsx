import type { PlannerTranscriptionResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useSession } from "../lib/session-store";
import { DictationController, PLANNER_RECORDING_SECONDS, type DictationState } from "../lib/planner-recording-core";

const t = m.aiPlanner;

/**
 * La dictée du champ unique : le micro est dans le champ, sans case à cocher. L'accord du planificateur, donné une
 * fois, couvre l'écrit comme la dictée ; le serveur l'exige avant toute transcription, et l'écran envoie toujours
 * `audioProcessingAccepted`, que le contrat demande.
 *
 * Monté uniquement dans le planificateur autorisé. Ni audio ni transcription dans AsyncStorage, la file de
 * synchronisation ou le cache React Query.
 */
export function usePlannerDictation(orgId: string, onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const controller = useRef<DictationController<PlannerTranscriptionResponse> | null>(null);
  const callback = useRef(onText);
  const checkRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => {
    let alive = true;
    let captureState: DictationState = "idle";
    let nativeRecorder: typeof import("../lib/planner-recording") | null = null;
    const fail = (cause: unknown) => {
      if (!alive) return;
      const code = cause instanceof Error ? cause.message : "";
      setDenied(code === "dictation_permission_denied");
      setError(
        code === "dictation_permission_denied"
          ? t.microphoneDenied
          : code === "dictation_cleanup_failed"
            ? t.audioCleanupFailed
            : code === "dictation_invalid_audio"
              ? t.audioInvalid
              : code.startsWith("dictation_")
                ? t.recordingFailed
                : errorMessage(cause),
      );
    };
    const settle = (result: PlannerTranscriptionResponse) => {
      if (result.state === "ready" && result.text) {
        callback.current(result.text);
        setRequestId(null);
        setNotice(t.dictationReady);
      } else if (result.state === "processing") setNotice(t.dictationPending);
      else {
        setRequestId(null);
        setError(t.transcriptionFailed);
      }
    };
    const current = new DictationController<PlannerTranscriptionResponse>({
      create: () => {
        // Charger le module natif seulement après l'action explicite du coach.
        let recorder: ReturnType<NonNullable<typeof nativeRecorder>["createNativeDictationRecorder"]> | null = null;
        return {
          prepare: async (signal) => {
            nativeRecorder ??= await import("../lib/planner-recording");
            if (signal.aborted) throw new Error("dictation_cancelled");
            recorder = nativeRecorder.createNativeDictationRecorder();
            await recorder.prepare(signal);
          },
          start: () => recorder!.start(),
          stop: () => recorder!.stop(),
          dispose: async () => {
            await recorder?.dispose();
          },
        };
      },
      transcribe: async (file, signal) => {
        const id = randomUUID();
        if (alive) setRequestId(id);
        const data = new FormData();
        data.append(
          "metadata",
          JSON.stringify({ id, requestedAt: new Date().toISOString(), audioProcessingAccepted: true }),
        );
        // FormData React Native lit ce fichier local ; pas de base64 ni de copie persistante.
        data.append("audio", { uri: file.uri, name: "dictee.m4a", type: "audio/mp4" } as unknown as Blob);
        const timeout = new AbortController();
        const abort = () => timeout.abort();
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
        const timer = setTimeout(abort, 120_000);
        try {
          return await api.transcribePlannerAudio(orgId, data, timeout.signal);
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
        }
      },
      onState: (next) => {
        captureState = next;
        if (alive) setState(next);
      },
      onError: fail,
      onResult: (result) => {
        if (alive) settle(result);
      },
    });
    controller.current = current;
    const appState = AppState.addEventListener("change", (next) => {
      // iOS devient inactive pendant sa propre demande de permission : seule la
      // vraie mise en arrière-plan annule cette demande encore en préparation.
      if (next === "background" || (next === "inactive" && captureState !== "starting")) {
        checkRequest.current?.abort();
        void current.cancel();
      }
    });
    const session = useSession.subscribe((next) => {
      if (next.status !== "signed-in") {
        checkRequest.current?.abort();
        void current.cancel();
      }
    });
    return () => {
      alive = false;
      appState.remove();
      session();
      checkRequest.current?.abort();
      void current.cancel();
    };
  }, [orgId]);

  useEffect(() => {
    if (state !== "recording") return;
    const began = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.min(PLANNER_RECORDING_SECONDS, Math.floor((Date.now() - began) / 1000));
      setSeconds(elapsed);
      if (elapsed >= PLANNER_RECORDING_SECONDS) void controller.current?.finish();
    }, 250);
    return () => clearInterval(timer);
  }, [state]);

  const check = async () => {
    if (!requestId || checkRequest.current) return;
    const abort = new AbortController();
    checkRequest.current = abort;
    setChecking(true);
    setError("");
    const timer = setTimeout(() => abort.abort(), 30_000);
    try {
      const result = await api.plannerTranscription(orgId, requestId, abort.signal);
      if (abort.signal.aborted) return;
      if (result.state === "ready" && result.text) {
        callback.current(result.text);
        setRequestId(null);
        setNotice(t.dictationReady);
      } else if (result.state === "processing") setNotice(t.dictationPending);
      else {
        setRequestId(null);
        setError(t.transcriptionFailed);
      }
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause));
    } finally {
      clearTimeout(timer);
      if (checkRequest.current === abort) checkRequest.current = null;
      setChecking(false);
    }
  };

  const busy = state !== "idle" || checking;
  // Ce que la ligne d'état du champ dit : l'enregistrement, la transcription, puis le résultat.
  const status =
    state === "recording"
      ? t.dictationProgress(seconds)
      : state === "starting"
        ? t.dictationStarting
        : state === "transcribing"
          ? t.dictationTranscribing
          : state === "cleaning"
            ? t.dictationCleaning
            : notice;
  return {
    state,
    busy,
    recording: state === "recording",
    status,
    error,
    denied,
    canCheck: Boolean(requestId) && !busy,
    canCancel: busy && state !== "cleaning",
    start: () => {
      setError("");
      setNotice("");
      setDenied(false);
      setRequestId(null);
      setSeconds(0);
      void controller.current?.start();
    },
    stop: () => {
      void controller.current?.finish();
    },
    cancel: () => {
      checkRequest.current?.abort();
      setChecking(false);
      void controller.current?.cancel();
    },
    check: () => {
      void check();
    },
    openSettings: () => {
      void Linking.openSettings().catch(() => setError(t.microphoneDenied));
    },
  };
}
