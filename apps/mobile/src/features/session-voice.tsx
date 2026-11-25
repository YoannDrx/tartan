import { useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { File } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { z } from "zod";
import { sessionHeaders } from "../lib/api";
import { config } from "../lib/config";
import { useIsOnline } from "../lib/network";
import { createNativeDictationRecorder } from "../lib/planner-recording";
import { DictationController, PLANNER_RECORDING_SECONDS, type DictationState } from "../lib/planner-recording-core";
import { useSession } from "../lib/session-store";
import { Mic, Pause, Play } from "../ui/icons";
import { Button, T } from "../ui/primitives";
import { space } from "../ui/theme";

const t = m.sessionVoice;
const base = (org: string) => `${config.apiUrl}/api/v1/orgs/${encodeURIComponent(org)}`;
export const instructionUrl = (org: string, clip: string, sessionId?: string) =>
  `${base(org)}/voice-instructions/${encodeURIComponent(clip)}${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`;
export const debriefUrl = (org: string, sessionId: string, athleteId?: string) =>
  `${base(org)}/sessions/${encodeURIComponent(sessionId)}/voice-debrief${athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : ""}`;

export function VoicePlayer({ url, label, local = false }: { url: string; label: string; local?: boolean }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);
  const playingUrl = useRef("");
  const sequence = useRef(0);
  const stop = useCallback(() => {
    sequence.current++;
    playingUrl.current = "";
    try {
      player.pause();
    } catch {
      // Au démontage, Expo peut avoir déjà libéré le lecteur.
    }
  }, [player]);
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
    const request = ++sequence.current;
    setError(false);
    try {
      if (player.playing) {
        player.pause();
        return;
      }
      if (playingUrl.current !== url || !player.isLoaded) {
        const headers = local ? undefined : await sessionHeaders();
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
  return (
    <View>
      <Button
        compact
        variant="secondary"
        icon={status.playing ? Pause : Play}
        label={status.playing ? m.video.pause : label}
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

type Preview = { uri: string; signal: AbortSignal; accept: () => void };

export function VoiceEditor({
  orgId,
  sessionId,
  clipId,
  hasDebrief = false,
  onChange,
  onBusyChange,
}: {
  orgId: string;
  sessionId?: string;
  clipId?: string;
  hasDebrief?: boolean;
  onChange: (clip?: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [state, setState] = useState<DictationState>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const online = useIsOnline();
  const control = useRef<DictationController<void> | null>(null);
  const action = useRef<AbortController | null>(null);
  const client = useQueryClient();
  const url = sessionId ? debriefUrl(orgId, sessionId) : `${base(orgId)}/voice-instructions`;
  const saved = sessionId ? hasDebrief : !!clipId;
  useEffect(() => {
    let alive = true;
    let phase: DictationState = "idle";
    const current = new DictationController<void>({
      create: createNativeDictationRecorder,
      // Le fichier reste dans le cache privé du micro jusqu'à l'envoi explicite ou l'annulation.
      transcribe: (file, signal) =>
        new Promise<void>((resolve, reject) => {
          const aborted = () => reject(new Error("dictation_cancelled"));
          if (signal.aborted || !alive) return aborted();
          signal.addEventListener("abort", aborted, { once: true });
          setPreview({
            uri: file.uri,
            signal,
            accept: () => {
              signal.removeEventListener("abort", aborted);
              resolve();
            },
          });
        }),
      onState: (next) => {
        phase = next;
        if (alive) {
          setState(next);
          if (next === "idle") setPreview(null);
        }
      },
      onError: (cause) => {
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
      if (next === "background" || (next === "inactive" && phase !== "starting")) cancel();
    });
    const session = useSession.subscribe((s) => {
      if (s.status !== "signed-in") cancel();
    });
    return () => {
      alive = false;
      background.remove();
      session();
      cancel();
      control.current = null;
    };
  }, [url]);
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
  const change = async (remove = false) => {
    if (action.current || (!remove && !preview)) return;
    if (remove && !sessionId) {
      onChange();
      return;
    }
    const abort = new AbortController();
    action.current = abort;
    setSending(true);
    setError("");
    const cancel = () => abort.abort();
    preview?.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 60_000);
    try {
      const headers = await sessionHeaders();
      const response = await expoFetch(url, {
        method: remove ? "DELETE" : sessionId ? "PUT" : "POST",
        headers: remove ? headers : { ...headers, "Content-Type": "audio/mp4" },
        credentials: "omit",
        signal: abort.signal,
        ...(remove ? {} : { body: new File(preview!.uri) }),
      });
      if (!response.ok) throw new Error("voice_upload_failed");
      const clip = !sessionId && !remove ? z.object({ id: z.uuid() }).parse(await response.json()).id : undefined;
      if (abort.signal.aborted) return;
      onChange(remove ? undefined : (clip ?? sessionId));
      preview?.accept();
      if (sessionId) {
        void client.invalidateQueries({ queryKey: ["session", orgId, sessionId] });
        void client.invalidateQueries({ queryKey: ["coach-session", orgId, sessionId] });
      }
    } catch {
      if (action.current === abort && !preview?.signal.aborted) setError(remove ? t.removeFailed : t.sendFailed);
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
      <T variant="smallStrong">{sessionId ? t.debrief : t.instruction}</T>
      {saved && state === "idle" ? (
        <VoicePlayer
          key={clipId ?? sessionId}
          url={sessionId ? url : instructionUrl(orgId, clipId!)}
          label={m.video.play}
        />
      ) : null}
      {state === "idle" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Button
            variant="secondary"
            compact
            icon={Mic}
            disabled={!online || sending}
            label={saved ? t.replace : t.record}
            onPress={() => {
              setError("");
              setSeconds(0);
              void control.current?.start();
            }}
          />
          {saved ? (
            <Button
              compact
              variant="ghost"
              label={t.remove}
              disabled={sending || (!!sessionId && !online)}
              onPress={() => void change(true)}
            />
          ) : null}
        </View>
      ) : state === "recording" ? (
        <Button label={`${t.stop} · ${seconds} ${m.units.seconds}`} onPress={() => void control.current?.finish()} />
      ) : preview ? (
        <>
          {!sending ? <VoicePlayer local url={preview.uri} label={t.preview} /> : null}
          <Button
            label={sessionId ? t.send : t.attach}
            loading={sending}
            disabled={sending || !online}
            onPress={() => void change()}
          />
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
