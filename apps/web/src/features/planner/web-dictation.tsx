"use client";

import { ApiError, createApiClient } from "@tartan/api-client";
import type { PlannerTranscriptionResponse } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { useEffect, useRef, useState } from "react";
import { BrowserPlannerRecording, WEB_DICTATION_SECONDS, type BrowserRecordingState } from "./browser-recording";

const api = createApiClient({ baseUrl: "" });
const t = w.planner.dictation;

/**
 * La dictée du champ de demande : un bouton pour parler, un pour arrêter, le texte transcrit ajouté à la demande.
 * L'accord a été donné une fois, avec celui du planificateur : aucune case n'est à cocher ici. Les enregistrements
 * et les identifiants de reprise ne quittent pas la mémoire de cet écran.
 */
export function usePlannerDictation(orgId: string, onText: (text: string) => void) {
  const [state, setState] = useState<BrowserRecordingState>("idle");
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkLabel, setNetworkLabel] = useState<string>(t.transcribing);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const capture = useRef<BrowserPlannerRecording | null>(null);
  const captureState = useRef<BrowserRecordingState>("idle");
  const activeRequest = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const delivered = useRef<string | null>(null);
  // Les événements du micro lisent la fonction du rendu courant : jamais une ancienne demande du formulaire.
  const deliver = useRef(onText);
  useEffect(() => {
    deliver.current = onText;
  }, [onText]);

  const accept = (result: PlannerTranscriptionResponse) => {
    if (result.state === "ready" && result.text) {
      if (delivered.current !== result.id) {
        delivered.current = result.id;
        deliver.current(result.text);
      }
      setRequestId(null);
      setNotice(t.ready);
    } else if (result.state === "processing") setNotice(t.pending);
    else {
      setRequestId(null);
      setError(t.failed);
    }
  };
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
          ? t.denied
          : code === "dictation_unsupported"
            ? t.unsupported
            : code === "dictation_invalid_audio"
              ? t.invalid
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
        setNetworkLabel(t.transcribing);
        const id = crypto.randomUUID();
        setRequestId(id);
        const timeout = setTimeout(() => controller.abort(), 120_000);
        void (async () => {
          try {
            const body = new FormData();
            body.set(
              "metadata",
              // L'accord de transcription est celui du planificateur, donné une fois : le serveur l'exige aussi.
              JSON.stringify({ id, requestedAt: new Date().toISOString(), audioProcessingAccepted: true }),
            );
            body.set("audio", audio, audio.type.startsWith("audio/mp4") ? "dictee.m4a" : "dictee.webm");
            const result = await api.transcribePlannerAudio(orgId, body, controller.signal);
            if (mounted && !controller.signal.aborted) acceptResult.current(result);
          } catch (cause) {
            if (mounted)
              setError(
                controller.signal.aborted ? t.responseUnknown : cause instanceof ApiError ? cause.message : t.failed,
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
        if (mounted) setNotice(t.interrupted);
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
    };
  }, [orgId]);

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
    if (activeRequest.current || captureState.current !== "idle") return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setNetworkBusy(true);
    setError("");
    setNotice("");
    setSeconds(0);
    setNetworkLabel(t.checkingAccess);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      // Le droit effectif est vérifié avant toute demande d'accès au micro.
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
    setNetworkLabel(t.checkingResult);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const result = await api.plannerTranscription(orgId, requestId, controller.signal);
      if (alive.current && activeRequest.current === controller && !controller.signal.aborted)
        acceptResult.current(result);
    } catch (cause) {
      if (alive.current && activeRequest.current === controller) {
        if (cause instanceof ApiError && [404, 410].includes(cause.status)) setRequestId(null);
        setError(cause instanceof ApiError ? cause.message : t.failed);
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (alive.current) setNetworkBusy(false);
      }
    }
  };

  const recording = state === "recording";
  const busy = state !== "idle" || networkBusy;
  return {
    busy,
    recording,
    // Ce qui se passe, en une ligne : l'enregistrement et sa durée, une étape, ou le résultat.
    status: recording
      ? t.progress(seconds)
      : busy
        ? networkBusy
          ? networkLabel
          : state === "starting"
            ? t.starting
            : t.finalizing
        : notice,
    error,
    // Une transcription envoyée dont la réponse n'est pas arrivée : elle se relit sans redicter.
    canRecover: Boolean(requestId) && !busy,
    start: () => void start(),
    stop: () => capture.current?.finish(),
    cancel: () => {
      activeRequest.current?.abort();
      capture.current?.cancel();
    },
    recover: () => void recover(),
  };
}
