"use client";

import { VoicePlayer } from "./voice-player";
import { SessionThread } from "./session-thread";
import { VoiceRecorder } from "./voice-recorder";
import { useEffect, useRef, useState } from "react";
import { m } from "@tartan/i18n";
const t = m.sessionVoice;
const root = (organizationId: string) => `/api/v1/orgs/${encodeURIComponent(organizationId)}`;

export function ExerciseVoice({
  organizationId,
  sessionId,
  clipId,
  itemRef,
  personal,
}: {
  organizationId: string;
  sessionId: string;
  clipId?: string;
  itemRef: string;
  personal?: boolean;
}) {
  const src = clipId
    ? `${root(organizationId)}/voice-instructions/${encodeURIComponent(clipId)}?sessionId=${encodeURIComponent(sessionId)}`
    : null;
  const player = src ? <VoicePlayer key={src} src={src} label={t.instruction} /> : null;
  return personal ? (
    player
  ) : (
    <SessionThread key={itemRef} organizationId={organizationId} sessionId={sessionId} itemRef={itemRef}>
      {player}
    </SessionThread>
  );
}

export function CoachDebrief({
  organizationId,
  sessionId,
  athleteId,
}: {
  organizationId: string;
  sessionId: string;
  athleteId: string;
}) {
  const src = `${root(organizationId)}/sessions/${sessionId}/voice-debrief?athleteId=${encodeURIComponent(athleteId)}`;
  return (
    <div className="mt-2 grid gap-1">
      <p className="t-caption">{t.debrief}</p>
      <VoicePlayer src={src} label={t.debrief} />
    </div>
  );
}

export function InstructionRecorder({
  organizationId,
  clipId,
  onChange,
  onPendingChange,
}: {
  organizationId: string;
  clipId?: string;
  onChange: (id?: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const endpoint = `${root(organizationId)}/voice-instructions`;
  const latestChange = useRef(onChange);
  useEffect(() => {
    latestChange.current = onChange;
  }, [onChange]);
  return (
    <VoiceRecorder
      label={t.instruction}
      saveLabel={t.attach}
      savedMessage={t.attached}
      src={clipId ? `${endpoint}/${clipId}` : undefined}
      onPendingChange={onPendingChange}
      onSave={async (audio, signal) => {
        const result = await fetch(endpoint, { method: "POST", body: audio, signal });
        if (!result.ok) throw new Error();
        const { id } = await result.json();
        if (typeof id !== "string") throw new Error();
        if (!signal.aborted) latestChange.current(id);
      }}
      onRemove={async () => latestChange.current(undefined)}
    />
  );
}

export function SessionDebrief({
  personal = false,
  organizationId,
  sessionId,
  initial,
  onPendingChange,
}: {
  personal?: boolean;
  organizationId: string;
  sessionId: string;
  initial: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [present, setPresent] = useState(initial);
  const [revision, setRevision] = useState(0);
  const endpoint = `${root(organizationId)}/sessions/${sessionId}/voice-debrief`;
  const [rootPending, setRootPending] = useState(false);
  const [replyPending, setReplyPending] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  useEffect(() => {
    onPendingChange?.(rootPending || replyPending);
    return () => onPendingChange?.(false);
  }, [rootPending, replyPending, onPendingChange]);
  return (
    <div className="grid min-w-0 gap-3">
      <VoiceRecorder
        disabled={replyPending}
        hideSavedAudio={threadOpen}
        label={t.debrief}
        saveLabel={t.send}
        savedMessage={t.sent}
        src={present ? `${endpoint}?v=${revision}` : undefined}
        onPendingChange={setRootPending}
        onSave={async (audio, signal) => {
          const result = await fetch(endpoint, { method: "PUT", body: audio, signal });
          if (!result.ok) throw new Error();
          setPresent(true);
          setThreadOpen(false);
          setRevision((value) => value + 1);
        }}
        onRemove={async (signal) => {
          const result = await fetch(endpoint, { method: "DELETE", signal });
          if (!result.ok) throw new Error();
          setPresent(false);
          setRevision((value) => value + 1);
          setThreadOpen(false);
        }}
      />
      {!personal ? (
        <SessionThread
          disabled={rootPending}
          onOpenChange={setThreadOpen}
          key={revision}
          organizationId={organizationId}
          sessionId={sessionId}
          onPendingChange={setReplyPending}
        />
      ) : null}
    </div>
  );
}
