"use client";

import { VoicePlayer } from "./voice-player";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import {
  browserAudio,
  BrowserPlannerRecording,
  type BrowserRecordingState,
} from "@/features/planner/browser-recording";

const t = m.sessionVoice;
type RecorderProps = {
  label: string;
  saveLabel: string;
  savedMessage: string;
  src?: string;
  onSave: (audio: Blob, signal: AbortSignal) => Promise<void>;
  onRemove?: (signal: AbortSignal) => Promise<void>;
  recordLabel?: string;
  hideSavedAudio?: boolean;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
};

export function VoiceRecorder({
  label,
  saveLabel,
  savedMessage,
  src,
  onSave,
  onRemove,
  recordLabel,
  hideSavedAudio,
  disabled,
  onPendingChange,
}: RecorderProps) {
  const [state, setState] = useState<BrowserRecordingState>("idle");
  const [draft, setDraft] = useState<{ audio: Blob; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const capture = useRef<BrowserPlannerRecording | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    const recorder = new BrowserPlannerRecording({
      audio: () => browserAudio(true),
      onState: (s) => {
        if (active) setState(s);
      },
      onAudio: (audio) => {
        if (active) setDraft({ audio, url: URL.createObjectURL(audio) });
      },
      onError: (cause) => {
        if (active)
          setError(
            cause instanceof Error && cause.name === "NotAllowedError"
              ? t.denied
              : cause instanceof Error && cause.message === "dictation_unsupported"
                ? t.unsupported
                : t.failed,
          );
      },
    });
    capture.current = recorder;
    const interrupt = () => recorder.cancel();
    const visibility = () => {
      if (document.hidden) interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", interrupt);
    return () => {
      active = false;
      recorder.cancel();
      request.current?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", interrupt);
    };
  }, []);
  useEffect(
    () => () => {
      if (draft) URL.revokeObjectURL(draft.url);
    },
    [draft],
  );
  const pending = state !== "idle" || Boolean(draft) || saving;
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [onPendingChange, pending]);

  async function persist(remove: boolean) {
    if (request.current || (!remove && !draft)) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    setError("");
    setNotice("");
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      if (remove) await onRemove?.(controller.signal);
      else if (draft) await onSave(draft.audio, controller.signal);
      setDraft(null);
      setNotice(remove ? t.removed : savedMessage);
    } catch {
      setError(remove ? t.removeFailed : t.sendFailed);
    } finally {
      clearTimeout(timeout);
      request.current = null;
      setSaving(false);
    }
  }

  const status =
    state === "starting"
      ? t.starting
      : state === "recording"
        ? t.recording
        : state === "finishing"
          ? t.finishing
          : saving
            ? t.sending
            : draft
              ? t.ready
              : notice;
  return (
    <fieldset disabled={disabled} className="col-span-full grid min-w-0 gap-2">
      <legend className="t-caption mb-1">{label}</legend>
      {draft || (src && !hideSavedAudio) ? (
        <VoicePlayer key={draft?.url ?? src} src={draft?.url ?? src!} label={draft ? t.preview : label} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {state === "idle" && !draft ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setNotice("");
              setError("");
              void capture.current?.start();
            }}
          >
            <Mic aria-hidden className="size-4" />
            {src ? t.replace : (recordLabel ?? t.record)}
          </Button>
        ) : null}
        {state === "recording" ? (
          <Button size="sm" onClick={() => capture.current?.finish()}>
            <Square aria-hidden className="size-4" />
            {t.stop}
          </Button>
        ) : null}
        {draft ? (
          <Button size="sm" disabled={saving} onClick={() => void persist(false)}>
            {saveLabel}
          </Button>
        ) : null}
        {draft || state !== "idle" ? (
          <Button
            size="sm"
            variant="quiet"
            disabled={saving}
            onClick={() => {
              capture.current?.cancel();
              setDraft(null);
              setError("");
              setNotice("");
            }}
          >
            {t.discard}
          </Button>
        ) : src && onRemove ? (
          <Button size="sm" variant="quiet" disabled={saving} onClick={() => void persist(true)}>
            {t.remove}
          </Button>
        ) : null}
      </div>
      {status ? (
        <p role="status" className="t-caption font-normal text-soft">
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="t-caption">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
