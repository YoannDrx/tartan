import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ApiError, sessionThreadPath, type SessionThreadTarget } from "@tartan/api-client";
import type { SessionThreadMessage, SessionThreadVoice } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { api, sendSessionThreadAudio, sessionThreadAudioUrl } from "../lib/api";
import { useIsOnline } from "../lib/network";
import { Button, Field, T } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";
import { VoiceCapture, VoicePlayer } from "./session-voice";

const t = m.sessionThread;

function MessageBubble({
  author,
  children,
}: {
  author: Pick<SessionThreadMessage, "authorName" | "authorRole" | "mine">;
  children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        alignSelf: author.mine ? "flex-end" : "flex-start",
        maxWidth: "94%",
        minWidth: "55%",
        padding: space.md,
        gap: space.sm,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: author.mine ? palette.accent : palette.border,
        backgroundColor: palette.surface,
      }}
    >
      <T variant="smallStrong">
        {[author.authorName, t[author.authorRole], author.mine ? t.you : null].filter(Boolean).join(" · ")}
      </T>
      {children}
    </View>
  );
}

function MessageVoice({
  target,
  messageId,
  voice,
  mine,
  refresh,
}: {
  target: SessionThreadTarget;
  messageId: string;
  voice: SessionThreadVoice;
  mine: boolean;
  refresh: () => void;
}) {
  const [consenting, setConsenting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const transcript = voice.transcript ?? generated;
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const online = useIsOnline();
  const authorize = async () => {
    if (lock.current || !consenting || !mine || !voice.canTranscribe) return;
    lock.current = true;
    setConsenting(false);
    setProcessing(true);
    setError("");
    try {
      const result = await api.transcribeSessionMessage(target, messageId, voice.version, true);
      setGenerated(result.transcript);
      setShowTranscript(true);
      refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "voice_changed"
          ? t.sourceChanged
          : cause instanceof ApiError && cause.code === "transcription_in_progress"
            ? t.transcriptionBusy
            : t.transcriptionError,
      );
      refresh();
    } finally {
      lock.current = false;
      setProcessing(false);
    }
  };
  return (
    <View style={{ gap: space.xs }}>
      <VoicePlayer
        url={sessionThreadAudioUrl(target, messageId)}
        label={t.play}
        durationSeconds={voice.durationSeconds}
      />
      {transcript ? (
        <>
          <Button
            compact
            variant="ghost"
            expanded={showTranscript}
            label={showTranscript ? t.hideTranscript : t.showTranscript}
            onPress={() => setShowTranscript(!showTranscript)}
          />
          {showTranscript ? (
            <T variant="small" selectable>
              {transcript}
            </T>
          ) : null}
        </>
      ) : mine && voice.canTranscribe ? (
        consenting ? (
          <>
            <T variant="small">{t.agreeTranscription}</T>
            <Button
              variant="secondary"
              label={t.authorizeTranscription}
              disabled={!online}
              onPress={() => void authorize()}
            />
            <Button compact variant="ghost" label={t.cancelTranscription} onPress={() => setConsenting(false)} />
          </>
        ) : (
          <Button
            compact
            variant="ghost"
            label={processing ? t.transcribing : t.transcribe}
            disabled={!online}
            loading={processing}
            onPress={() => setConsenting(true)}
          />
        )
      ) : null}
      {error ? (
        <T tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function ThreadConversation({
  target,
  onBusyChange,
}: {
  target: SessionThreadTarget;
  onBusyChange?: (value: boolean) => void;
}) {
  const focused = useIsFocused();
  const query = useQuery({
    enabled: focused,
    queryKey: ["session-thread", target.orgId, target.sessionId, target.athleteId ?? null, target.itemRef ?? null],
    queryFn: ({ signal }) => api.sessionThread(target, signal),
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
  const online = useIsOnline();
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const sendLock = useRef(false);
  const attempt = useRef<{ id: string; text: string } | null>(null);
  useEffect(() => {
    onBusyChange?.(sending || recording);
    return () => onBusyChange?.(false);
  }, [sending, recording, onBusyChange]);
  const refresh = () => {
    void query.refetch();
  };
  const sendText = async () => {
    const text = draft.trim();
    if (sendLock.current || !text) return;
    sendLock.current = true;
    setSending(true);
    setError(false);
    if (attempt.current?.text !== text) attempt.current = { id: randomUUID(), text };
    try {
      await api.replyToSessionThread(target, { clientId: attempt.current.id, text });
      setDraft("");
      attempt.current = null;
      refresh();
    } catch {
      setError(true);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };
  const { data } = query;
  if ((!data && query.isError) || (query.error instanceof ApiError && query.error.status < 500)) {
    return (
      <View>
        <T tone="danger" accessibilityRole="alert">
          {t.loadError}
        </T>
        <Button compact variant="ghost" label={t.retry} onPress={refresh} />
      </View>
    );
  }
  if (!data)
    return (
      <T variant="small" accessibilityLiveRegion="polite">
        {online ? m.common.loading : m.sessionVoice.offline}
      </T>
    );
  return (
    <View style={{ gap: space.md }}>
      <T variant="caption" tone="muted">
        {t.privacyHint}
      </T>
      {data.root ? (
        <MessageBubble author={data.root}>
          <T variant="caption">{target.itemRef ? t.originalInstruction : t.originalDebrief}</T>
          <MessageVoice
            key={data.root.version}
            target={target}
            messageId="root"
            voice={data.root}
            mine={data.root.mine}
            refresh={refresh}
          />
        </MessageBubble>
      ) : null}
      {data.messages.map((message) => (
        <MessageBubble key={message.id} author={message}>
          {message.text ? <T selectable>{message.text}</T> : null}
          {message.voice ? (
            <MessageVoice
              key={message.voice.version}
              target={target}
              messageId={message.id}
              voice={message.voice}
              mine={message.mine}
              refresh={refresh}
            />
          ) : null}
        </MessageBubble>
      ))}
      {!data.root && data.messages.length === 0 ? <T variant="small">{t.emptyHint}</T> : null}
      <Field
        testID="thread-text"
        multiline
        label={t.write}
        maxLength={2000}
        value={draft}
        editable={!sending}
        onChangeText={setDraft}
      />
      {draft.trim() ? (
        <Button
          testID="thread-send-text"
          label={t.send}
          disabled={!online}
          loading={sending}
          onPress={() => void sendText()}
        />
      ) : null}
      {error ? (
        <T tone="danger" accessibilityRole="alert">
          {t.sendError}
        </T>
      ) : null}
      <VoiceCapture
        upload={async (uri, clientId, signal) => {
          await sendSessionThreadAudio(target, uri, clientId, signal);
          if (!signal.aborted) refresh();
        }}
        recordLabel={t.record}
        sendLabel={t.sendAudio}
        onBusyChange={setRecording}
      />
    </View>
  );
}

export function ThreadDisclosure({
  target,
  onBusyChange,
}: {
  target: SessionThreadTarget;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  return (
    <View style={{ gap: space.sm }}>
      <Button
        expanded={open}
        variant="secondary"
        label={target.itemRef ? t.exercise : t.debrief}
        disabled={busy}
        onPress={() => setOpen(!open)}
      />
      {open ? <ThreadConversation key={sessionThreadPath(target)} target={target} onBusyChange={setBusy} /> : null}
    </View>
  );
}
