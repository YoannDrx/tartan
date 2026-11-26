"use client";

import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { SessionThreadVoice, SessionThreadView } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { VoicePlayer } from "./voice-player";
import { VoiceRecorder } from "./voice-recorder";

const t = m.sessionThread;

function ThreadVoice({
  url,
  label,
  voice,
  reload,
}: {
  url: (suffix: string) => string;
  label: string;
  voice: SessionThreadVoice;
  reload: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [asking, setAsking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const transcriptId = useId();
  const text = voice.transcript ?? result;
  useEffect(() => () => request.current?.abort(), []);
  async function transcribe() {
    if (!consent || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setPending(true);
    try {
      const response = await fetch(url("transcript"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: voice.version, consent: true }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        if (failure?.code === "voice_changed") {
          setError(t.sourceChanged);
          void reload();
        } else setError(failure?.code === "transcription_in_progress" ? t.transcriptionBusy : t.transcriptionError);
        return;
      }
      const { transcript } = await response.json();
      if (typeof transcript !== "string") throw new Error();
      setResult(transcript);
      setShow(true);
      setAsking(false);
      setConsent(false);
      void reload();
    } catch {
      if (!controller.signal.aborted) setError(t.transcriptionError);
    } finally {
      request.current = null;
      setPending(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-2">
      <VoicePlayer src={url("audio")} label={label} durationSeconds={voice.durationSeconds} />
      {text ? (
        <>
          <Button
            variant="quiet"
            size="sm"
            className="justify-self-start"
            aria-expanded={show}
            aria-controls={transcriptId}
            onClick={() => setShow(!show)}
          >
            {show ? t.hideTranscript : t.showTranscript}
          </Button>
          {show ? (
            <div id={transcriptId} className="grid gap-1 border-t border-card-line pt-2">
              <p className="t-caption">{t.transcript}</p>
              <p className="whitespace-pre-wrap break-words">{text}</p>
            </div>
          ) : null}
        </>
      ) : voice.canTranscribe ? (
        asking ? (
          <div className="grid gap-2 border-t border-card-line pt-2">
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-accent"
                checked={consent}
                disabled={pending}
                onChange={(event) => setConsent(event.target.checked)}
              />
              {t.agreeTranscription}
            </label>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" disabled={!consent || pending} onClick={() => void transcribe()}>
                {pending ? t.transcribing : t.authorizeTranscription}
              </Button>
              <Button
                size="sm"
                variant="quiet"
                disabled={pending}
                onClick={() => {
                  setAsking(false);
                  setConsent(false);
                  setError("");
                }}
              >
                {m.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="quiet" className="justify-self-start" onClick={() => setAsking(true)}>
            {t.transcribe}
          </Button>
        )
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

function OpenThread({
  base,
  query,
  itemRef,
  onPendingChange,
}: {
  base: string;
  query: string;
  itemRef?: string;
  onPendingChange: (active: boolean) => void;
}) {
  const [view, setView] = useState<SessionThreadView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const textRequest = useRef<AbortController | null>(null);
  const loadRequest = useRef<AbortController | null>(null);
  const textKey = useRef<{ id: string; text: string } | null>(null);
  const audioKeys = useRef(new WeakMap<Blob, string>());
  const endpoint = base + query;
  const reload = useCallback(async () => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        if ([401, 403, 404, 409, 410].includes(response.status) && !controller.signal.aborted) setView(null);
        throw new Error();
      }
      const next: SessionThreadView = await response.json();
      if (!controller.signal.aborted) {
        setView(next);
        setLoadError(false);
      }
    } catch {
      if (!controller.signal.aborted) setLoadError(true);
    } finally {
      if (loadRequest.current === controller) loadRequest.current = null;
    }
  }, [endpoint]);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !loadRequest.current) void reload();
    };
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      loadRequest.current?.abort();
      textRequest.current?.abort();
    };
  }, [reload]);
  const pending = Boolean(text.trim()) || sending || voicePending;
  useEffect(() => {
    onPendingChange(pending);
    return () => onPendingChange(false);
  }, [onPendingChange, pending]);
  async function sendText() {
    const value = text.trim();
    if (!value || textRequest.current) return;
    if (textKey.current?.text !== value) textKey.current = { id: crypto.randomUUID(), text: value };
    const controller = new AbortController();
    textRequest.current = controller;
    setSendError(false);
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: textKey.current.id, text: value }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      textKey.current = null;
      setText("");
      await reload();
    } catch {
      if (!controller.signal.aborted) setSendError(true);
    } finally {
      textRequest.current = null;
      setSending(false);
    }
  }
  async function sendAudio(audio: Blob, signal: AbortSignal) {
    const id = audioKeys.current.get(audio) ?? crypto.randomUUID();
    audioKeys.current.set(audio, id);
    const response = await fetch(endpoint, { method: "POST", headers: { "Idempotency-Key": id }, body: audio, signal });
    if (!response.ok) throw new Error();
    await reload();
  }
  const entries = [
    ...(view?.root ? [{ ...view.root, id: "root", createdAt: null, text: null, voice: view.root }] : []),
    ...(view?.messages ?? []),
  ];
  return (
    <div className="grid min-w-0 gap-3">
      <p className="t-caption font-normal text-soft">{t.privacyHint}</p>
      {loadError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert">{t.loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {m.common.retry}
          </Button>
        </div>
      ) : !view ? (
        <p role="status">{m.common.loading}</p>
      ) : null}
      {entries.length ? (
        <ol aria-live="polite" aria-relevant="additions" className="grid min-w-0 gap-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "grid w-fit min-w-0 max-w-[94%] gap-2 rounded-card border border-card-line px-3 py-2",
                entry.mine ? "justify-self-end bg-card-raised" : "justify-self-start bg-card",
              )}
            >
              <p className="t-caption flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 max-w-full break-words">{entry.authorName}</span>
                <span className="font-normal text-soft">
                  {entry.authorRole === "coach" ? t.coach : t.athlete}
                  {entry.mine ? ` · ${t.you}` : ""}
                </span>
                {entry.createdAt ? (
                  <time className="font-normal text-soft" dateTime={entry.createdAt}>
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Paris",
                    }).format(new Date(entry.createdAt))}
                  </time>
                ) : null}
              </p>
              {entry.text ? <p className="whitespace-pre-wrap break-words">{entry.text}</p> : null}
              {entry.voice ? (
                <ThreadVoice
                  key={entry.voice.version}
                  voice={entry.voice}
                  reload={reload}
                  label={
                    entry.id === "root" ? (itemRef ? m.sessionVoice.instruction : m.sessionVoice.debrief) : t.voiceReply
                  }
                  url={(suffix) => `${base}/${encodeURIComponent(entry.id)}/${suffix}${query}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {view ? (
        <div className="grid gap-2 border-t border-card-line pt-3">
          <div className="rounded-control border border-card-line bg-card p-2 focus-within:border-current">
            <Field label={t.write}>
              {(attrs) => (
                <Textarea
                  {...attrs}
                  rows={2}
                  className="min-h-14 border-0"
                  maxLength={2000}
                  value={text}
                  disabled={sending}
                  onChange={(event) => {
                    setText(event.target.value);
                    setSendError(false);
                  }}
                />
              )}
            </Field>
            <VoiceRecorder
              label={t.attachAudio}
              saveLabel={t.sendAudio}
              savedMessage={t.sent}
              recordLabel={t.record}
              onSave={sendAudio}
              onPendingChange={setVoicePending}
            />
          </div>
          {text.trim() ? (
            <Button disabled={sending} size="sm" className="justify-self-start" onClick={() => void sendText()}>
              <Send aria-hidden className="size-4" />
              {t.send}
            </Button>
          ) : null}
          {sendError ? <p role="alert">{t.sendError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function SessionThread({
  organizationId,
  sessionId,
  athleteId,
  itemRef,
  children,
  onPendingChange,
  onOpenChange,
  disabled = false,
}: {
  organizationId: string;
  sessionId: string;
  athleteId?: string;
  itemRef?: string;
  children?: ReactNode;
  onPendingChange?: (pending: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const regionId = useId();
  const params = new URLSearchParams();
  if (athleteId) params.set("athleteId", athleteId);
  if (itemRef) params.set("itemRef", itemRef);
  const query = params.size ? `?${params}` : "";
  const base = `/api/v1/orgs/${encodeURIComponent(organizationId)}/sessions/${encodeURIComponent(sessionId)}/thread`;
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [onPendingChange, pending]);
  return (
    <div className="grid min-w-0 gap-2">
      {!open ? children : null}
      <Button
        size="sm"
        variant="secondary"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={regionId}
        disabled={pending || disabled}
        onClick={() => {
          setOpen(!open);
          onOpenChange?.(!open);
        }}
      >
        <MessageCircle aria-hidden className="size-4" />
        {itemRef ? t.exercise : t.debrief}
        <ChevronDown aria-hidden className={cn("size-4", open && "rotate-180")} />
      </Button>
      <div id={regionId} hidden={!open}>
        {open ? (
          <OpenThread key={base + query} base={base} query={query} itemRef={itemRef} onPendingChange={setPending} />
        ) : null}
      </div>
    </div>
  );
}
