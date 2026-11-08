"use client";

import { ApiError, createApiClient } from "@tartan/api-client";
import type { PlannerTranscriptionResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/field";
import { BrowserPlannerRecording, WEB_DICTATION_SECONDS, type BrowserRecordingState } from "./browser-recording";

const api = createApiClient({ baseUrl: "" });
const t = m.aiPlanner;

// Monté dans le planificateur autorisé, avec une clé d'espace/utilisateur.
// Les blobs et identifiants de reprise ne quittent pas la mémoire de cet écran.
export function WebPlannerDictation({
  orgId,
  disabled,
  onText,
  onBusyChange,
}: {
  orgId: string;
  disabled: boolean;
  onText: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState<BrowserRecordingState>("idle");
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkLabel, setNetworkLabel] = useState<string>(t.dictationTranscribing);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const capture = useRef<BrowserPlannerRecording | null>(null);
  const captureState = useRef<BrowserRecordingState>("idle");
  const activeRequest = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const delivered = useRef<string | null>(null);
  const callbacks = useRef({ onText, onBusyChange });
  useEffect(() => {
    callbacks.current = { onText, onBusyChange };
  }, [onText, onBusyChange]);

  const accept = (result: PlannerTranscriptionResponse) => {
    if (result.state === "ready" && result.text) {
      if (delivered.current !== result.id) {
        delivered.current = result.id;
        callbacks.current.onText(result.text);
      }
      setRequestId(null);
      setNotice(t.dictationReady);
    } else if (result.state === "processing") setNotice(t.dictationPending);
    else {
      setRequestId(null);
      setError(t.transcriptionFailed);
    }
  };

  // Réf vers les fonctions du rendu courant, pour que les événements du micro ne
  // capturent ni ancien espace ni ancienne consigne du formulaire parent.
  const acceptResult = useRef(accept);
  useEffect(() => {
    acceptResult.current = accept;
  });

  useEffect(() => {
    let mounted = true;
    alive.current = true;
    const fail = (cause: unknown) => {
      if (!mounted) return;
      const name = cause instanceof Error ? cause.name : "";
      const code = cause instanceof Error ? cause.message : "";
      setError(
        name === "NotAllowedError"
          ? t.browserMicrophoneDenied
          : code === "dictation_unsupported"
            ? t.browserAudioUnavailable
            : code === "dictation_invalid_audio"
              ? t.audioInvalid
              : t.recordingFailed,
      );
    };
    const current = new BrowserPlannerRecording({
      onState: (value) => {
        if (!mounted) return;
        captureState.current = value;
        setState(value);
      },
      onError: fail,
      onAudio: (audio) => {
        if (!mounted || document.hidden || activeRequest.current) return;
        const controller = new AbortController();
        activeRequest.current = controller;
        setNetworkBusy(true);
        setNetworkLabel(t.dictationTranscribing);
        const id = crypto.randomUUID();
        setRequestId(id);
        const timeout = setTimeout(() => controller.abort(), 120_000);
        void (async () => {
          try {
            const body = new FormData();
            body.set(
              "metadata",
              JSON.stringify({ id, requestedAt: new Date().toISOString(), audioProcessingAccepted: true }),
            );
            body.set("audio", audio, audio.type.startsWith("audio/mp4") ? "dictee.m4a" : "dictee.webm");
            const result = await api.transcribePlannerAudio(orgId, body, controller.signal);
            if (mounted && !controller.signal.aborted) acceptResult.current(result);
          } catch (cause) {
            if (mounted)
              setError(
                controller.signal.aborted
                  ? t.dictationResponseUnknown
                  : cause instanceof ApiError
                    ? cause.message
                    : t.transcriptionFailed,
              );
          } finally {
            clearTimeout(timeout);
            if (activeRequest.current === controller) {
              activeRequest.current = null;
              if (mounted) setNetworkBusy(false);
            }
          }
        })();
      },
    });
    capture.current = current;
    const interrupt = () => {
      if (captureState.current !== "idle" || activeRequest.current) {
        activeRequest.current?.abort();
        current.cancel();
        if (mounted) setNotice(t.dictationInterrupted);
      }
    };
    const visibility = () => {
      if (document.hidden) interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", interrupt);
    return () => {
      mounted = false;
      alive.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
      current.cancel();
      captureState.current = "idle";
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", interrupt);
      callbacks.current.onBusyChange?.(false);
    };
  }, [orgId]);

  const busy = state !== "idle" || networkBusy;
  useEffect(() => {
    callbacks.current.onBusyChange?.(busy);
  }, [busy]);
  useEffect(() => {
    if (state !== "recording") return;
    const began = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.min(WEB_DICTATION_SECONDS, Math.floor((Date.now() - began) / 1000))),
      500,
    );
    return () => clearInterval(timer);
  }, [state]);

  const start = async () => {
    if (disabled || !accepted || activeRequest.current || captureState.current !== "idle") return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setNetworkBusy(true);
    setError("");
    setNotice("");
    setSeconds(0);
    setNetworkLabel(t.dictationCheckingAccess);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      // Vérifier le droit effectif avant toute demande de permission du micro.
      await api.plannerUsage(orgId, controller.signal);
      if (!alive.current || activeRequest.current !== controller || controller.signal.aborted || document.hidden)
        return;
      setRequestId(null);
      void capture.current?.start();
    } catch (cause) {
      if (alive.current && activeRequest.current === controller)
        setError(cause instanceof ApiError ? cause.message : t.recordingFailed);
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (alive.current) setNetworkBusy(false);
      }
    }
  };
  const recover = async () => {
    if (!requestId || activeRequest.current || captureState.current !== "idle") return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setNetworkBusy(true);
    setError("");
    setNotice("");
    setNetworkLabel(t.dictationCheckingResult);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const result = await api.plannerTranscription(orgId, requestId, controller.signal);
      if (alive.current && activeRequest.current === controller && !controller.signal.aborted)
        acceptResult.current(result);
    } catch (cause) {
      if (alive.current && activeRequest.current === controller) {
        if (cause instanceof ApiError && [404, 410].includes(cause.status)) setRequestId(null);
        setError(cause instanceof ApiError ? cause.message : t.transcriptionFailed);
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (alive.current) setNetworkBusy(false);
      }
    }
  };
  return (
    <section aria-label={t.dictate} className="flex min-w-0 flex-col gap-3 rounded-card border border-card-line p-4">
      <p>{t.browserDictationNotice}</p>
      <p className="text-soft">{t.dictationLimit}</p>
      <CheckRow
        label={t.acceptAudio}
        checked={accepted}
        disabled={disabled || busy}
        onChange={(event) => setAccepted(event.target.checked)}
      />
      {!busy ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !accepted}
          onClick={() => {
            void start();
          }}
        >
          {t.dictate}
        </Button>
      ) : null}
      {state === "recording" ? (
        <>
          <p>{t.dictationProgress(seconds)}</p>
          <Button type="button" onClick={() => capture.current?.finish()}>
            {t.stopDictation}
          </Button>
        </>
      ) : null}
      {busy && state !== "recording" ? (
        <p role="status">
          {networkBusy ? networkLabel : state === "starting" ? t.dictationStarting : t.dictationFinalizing}
        </p>
      ) : null}
      {busy ? (
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            activeRequest.current?.abort();
            capture.current?.cancel();
          }}
        >
          {t.cancelDictation}
        </Button>
      ) : null}
      {requestId && !busy ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            void recover();
          }}
        >
          {t.recover}
        </Button>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
