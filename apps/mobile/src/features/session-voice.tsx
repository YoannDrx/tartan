import { useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { uploadVoiceFile } from "../lib/voice-upload";
import { randomUUID } from "expo-crypto";
import { useFocusEffect } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { z } from "zod";
import { create } from "zustand";
import { sessionHeaders } from "../lib/api";
import { config } from "../lib/config";
import { useIsOnline } from "../lib/network";
import { createNativeDictationRecorder } from "../lib/planner-recording";
import { DictationController, PLANNER_RECORDING_SECONDS, type DictationState } from "../lib/planner-recording-core";
import { useSession } from "../lib/session-store";
import { Mic, Pause, Play } from "../ui/icons";
import { Button, IconButton, T } from "../ui/primitives";
import { space } from "../ui/theme";

// Le téléphone a une seule sortie et un seul micro, même si plusieurs fils sont ouverts.
const useVoiceMic = create<{ owner: symbol | null; recording: boolean }>(() => ({ owner: null, recording: false }));
let pauseCurrentVoice: (() => void) | null = null;

const t = m.sessionVoice;
const base = (org: string) => `${config.apiUrl}/api/v1/orgs/${encodeURIComponent(org)}`;
export const instructionUrl = (org: string, clip: string, sessionId?: string) =>
  `${base(org)}/voice-instructions/${encodeURIComponent(clip)}${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`;
export const debriefUrl = (org: string, sessionId: string, athleteId?: string) =>
  `${base(org)}/sessions/${encodeURIComponent(sessionId)}/voice-debrief${athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : ""}`;

export function VoicePlayer({
  url,
  label,
  local = false,
  durationSeconds,
}: {
  url: string;
  label: string;
  local?: boolean;
  durationSeconds?: number | null;
}) {
  const micActive = useVoiceMic((s) => s.recording);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);
  const playingUrl = useRef("");
  const sequence = useRef(0);
  const pause = useCallback(() => {
    sequence.current++;
    try {
      player.pause();
    } catch {
      // Au démontage, Expo peut avoir déjà libéré le lecteur.
    }
  }, [player]);
  const stop = useCallback(() => {
    if (pauseCurrentVoice === pause) pauseCurrentVoice = null;
    playingUrl.current = "";
    pause();
  }, [pause]);
  useFocusEffect(
    useCallback(() => {
      const background = AppState.addEventListener("change", (next) => {
        if (next === "background") stop();
      });
      const account = useSession.subscribe((next) => {
        if (next.status !== "signed-in") stop();
      });
      return () => {
        background.remove();
        account();
        stop();
      };
    }, [stop]),
  );
  const toggle = async () => {
    if (useVoiceMic.getState().recording) return;
    if (pauseCurrentVoice !== pause) pauseCurrentVoice?.();
    pauseCurrentVoice = pause;
    const request = ++sequence.current;
    setError(false);
    try {
      if (player.playing) {
        player.pause();
        return;
      }
      if (playingUrl.current !== url || !player.isLoaded) {
        const headers = local ? undefined : await sessionHeaders();
        if (request !== sequence.current || useVoiceMic.getState().recording) return;
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false });
        if (request !== sequence.current) return;
        player.replace({ uri: url, headers });
        playingUrl.current = url;
      } else if (player.duration > 0 && player.currentTime >= player.duration - 0.05) {
        await player.seekTo(0);
      }
      if (request === sequence.current) player.play();
    } catch {
      if (request === sequence.current) setError(true);
    }
  };
  const duration = status.duration > 0 ? status.duration : durationSeconds;
  const actionLabel = status.playing ? m.sessionThread.pause : label;
  const display = duration ? `${actionLabel} · ${m.sessionThread.duration(duration)}` : actionLabel;
  return (
    <View>
      <Button
        disabled={micActive}
        variant="secondary"
        icon={status.playing ? Pause : Play}
        label={display}
        onPress={() => void toggle()}
      />
      {error || status.playbackState === "error" || status.playbackState === "failed" ? (
        <T tone="danger" accessibilityRole="alert">
          {t.listenFailed}
        </T>
      ) : null}
    </View>
  );
}

type VoiceUpload = (uri: string, clientId: string, signal: AbortSignal) => Promise<void>;
type Preview = { uri: string; clientId: string; signal: AbortSignal; accept: () => void };

export function VoiceCapture({
  upload,
  recordLabel,
  sendLabel,
  onBusyChange,
}: {
  upload: VoiceUpload;
  recordLabel: string;
  sendLabel: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const micId = useRef(Symbol("voice"));
  const otherMicActive = useVoiceMic((s) => s.owner !== null && s.owner !== micId.current);
  const [state, setState] = useState<DictationState>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const online = useIsOnline();
  const control = useRef<DictationController<void> | null>(null);
  const action = useRef<AbortController | null>(null);
  useEffect(() => {
    let alive = true;
    let permissionDialog = false;
    const owner = micId.current;
    const releaseMic = () => {
      if (useVoiceMic.getState().owner === owner) useVoiceMic.setState({ owner: null, recording: false });
    };
    const current = new DictationController<void>({
      create: () =>
        createNativeDictationRecorder((open) => {
          permissionDialog = open;
        }),
      // Le fichier reste dans le cache privé du micro jusqu'à l'envoi explicite ou l'annulation.
      transcribe: (file, signal) =>
        new Promise<void>((resolve, reject) => {
          const aborted = () => reject(new Error("dictation_cancelled"));
          if (signal.aborted || !alive) return aborted();
          signal.addEventListener("abort", aborted, { once: true });
          useVoiceMic.setState({ recording: false });
          setPreview({
            uri: file.uri,
            clientId: randomUUID(),
            signal,
            accept: () => {
              signal.removeEventListener("abort", aborted);
              resolve();
            },
          });
        }),
      onState: (next) => {
        if (next === "idle") releaseMic();
        if (alive) {
          setState(next);
          if (next === "idle") setPreview(null);
        }
      },
      onError: (cause) => {
        releaseMic();
        if (alive)
          setError(cause instanceof Error && cause.message === "dictation_permission_denied" ? t.denied : t.failed);
      },
      onResult: () => undefined,
    });
    control.current = current;
    const cancel = () => {
      action.current?.abort();
      void current.cancel();
    };
    const background = AppState.addEventListener("change", (next) => {
      if ((next === "background" || next === "inactive") && !permissionDialog) cancel();
    });
    const session = useSession.subscribe((s) => {
      if (s.status !== "signed-in") cancel();
    });
    return () => {
      alive = false;
      background.remove();
      session();
      cancel();
      releaseMic();
      control.current = null;
    };
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        action.current?.abort();
        void control.current?.cancel();
      },
      [],
    ),
  );
  useEffect(() => {
    const busy = state !== "idle" || sending;
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [onBusyChange, state, sending]);
  useEffect(() => {
    if (state !== "recording") return;
    const began = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - began) / 1000);
      setSeconds(elapsed);
      if (elapsed >= PLANNER_RECORDING_SECONDS) void control.current?.finish();
    }, 250);
    return () => clearInterval(timer);
  }, [state]);
  const send = async () => {
    if (action.current || !preview) return;
    const abort = new AbortController();
    action.current = abort;
    setSending(true);
    setError("");
    const cancel = () => abort.abort();
    preview?.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 60_000);
    try {
      await upload(preview.uri, preview.clientId, abort.signal);
      if (!abort.signal.aborted) preview.accept();
    } catch {
      if (action.current === abort && !preview.signal.aborted) setError(t.sendFailed);
    } finally {
      clearTimeout(timeout);
      preview?.signal.removeEventListener("abort", cancel);
      if (action.current === abort) {
        action.current = null;
        setSending(false);
      }
    }
  };
  return (
    <View style={{ gap: space.sm }}>
      {state === "idle" ? (
        <View style={{ alignSelf: "flex-end" }}>
          <IconButton
            tone="filled"
            icon={Mic}
            disabled={!online || sending || otherMicActive}
            label={recordLabel}
            onPress={() => {
              if (useVoiceMic.getState().owner || !control.current) return;
              useVoiceMic.setState({ owner: micId.current, recording: true });
              pauseCurrentVoice?.();
              setError("");
              setSeconds(0);
              void control.current?.start();
            }}
          />
        </View>
      ) : state === "recording" ? (
        <Button label={`${t.stop} · ${seconds} ${m.units.seconds}`} onPress={() => void control.current?.finish()} />
      ) : preview ? (
        <>
          {!sending ? <VoicePlayer local url={preview.uri} label={t.preview} durationSeconds={seconds} /> : null}
          <Button label={sendLabel} loading={sending} disabled={sending || !online} onPress={() => void send()} />
        </>
      ) : (
        <T accessibilityLiveRegion="polite">{state === "starting" ? t.starting : t.finishing}</T>
      )}
      {state !== "idle" && state !== "cleaning" && !sending ? (
        <Button compact variant="ghost" label={t.discard} onPress={() => void control.current?.cancel()} />
      ) : null}
      {!online ? <T variant="caption">{t.offline}</T> : null}
      {error ? (
        <T tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function VoiceEditor({
  orgId,
  sessionId,
  hasDebrief = false,
  clipId,
  onChange,
  onBusyChange,
}: {
  orgId: string;
  sessionId?: string;
  hasDebrief?: boolean;
  clipId?: string;
  onChange: (clip?: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const removal = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => () => removal.current?.abort(), []));
  const online = useIsOnline();
  const client = useQueryClient();
  const saved = sessionId ? hasDebrief : !!clipId;
  const url = sessionId ? debriefUrl(orgId, sessionId) : `${base(orgId)}/voice-instructions`;
  const refresh = () => {
    if (!sessionId) return;
    void client.invalidateQueries({ queryKey: ["session", orgId, sessionId] });
    void client.invalidateQueries({ queryKey: ["coach-session", orgId, sessionId] });
    void client.invalidateQueries({ queryKey: ["session-thread", orgId, sessionId] });
  };
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => {
    busyRef.current?.(busy || removing);
    return () => busyRef.current?.(false);
  }, [busy, removing]);
  const upload: VoiceUpload = async (uri, _clientId, signal) => {
    const headers = await sessionHeaders();
    const response = await uploadVoiceFile(url, sessionId ? "PUT" : "POST", uri, headers, signal);
    if (!response.ok) throw new Error("voice_upload_failed");
    const id = sessionId ?? z.object({ id: z.uuid() }).parse(await response.json()).id;
    if (!signal.aborted) {
      onChange(id);
      refresh();
    }
  };
  const remove = async () => {
    if (!sessionId) {
      onChange();
      return;
    }
    if (removal.current) return;
    const abort = new AbortController();
    removal.current = abort;
    const timer = setTimeout(() => abort.abort(), 60_000);
    setRemoving(true);
    setRemoveError(false);
    try {
      const response = await expoFetch(url, {
        method: "DELETE",
        headers: await sessionHeaders(),
        credentials: "omit",
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (!response.ok) throw new Error("voice_remove_failed");
      onChange();
      refresh();
    } catch {
      setRemoveError(true);
    } finally {
      clearTimeout(timer);
      removal.current = null;
      setRemoving(false);
    }
  };
  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">{sessionId ? t.debrief : t.instruction}</T>
      {saved && !busy ? (
        <VoicePlayer
          key={clipId ?? sessionId}
          url={sessionId ? url : instructionUrl(orgId, clipId!)}
          label={m.sessionThread.play}
        />
      ) : null}
      {!removing ? (
        <VoiceCapture
          key={url}
          recordLabel={saved ? t.replace : t.record}
          sendLabel={sessionId ? t.send : t.attach}
          upload={upload}
          onBusyChange={setBusy}
        />
      ) : null}
      {saved && !busy ? (
        <Button
          compact
          variant="ghost"
          label={t.remove}
          loading={removing}
          disabled={!!sessionId && !online}
          onPress={() => void remove()}
        />
      ) : null}
      {removeError ? (
        <T tone="danger" accessibilityRole="alert">
          {t.removeFailed}
        </T>
      ) : null}
    </View>
  );
}
