import { ModerationSheet } from "../../src/features/comments";
import { tokens } from "@tartan/design-tokens";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JumpPhase } from "@tartan/contracts";
import {
  formatHeight,
  hasHighJumpContext,
  formatTimecode,
  frameStepMs,
  isHighFrameRate,
  isStaff,
  toFileSeconds,
  toRealMs,
} from "@tartan/domain";
import { capitalize, formatDayMonth, m } from "@tartan/i18n";
import { useEvent, useEventListener } from "expo";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useMemo, useRef, useState } from "react";
import { AccessibilityActionEvent, Alert, PanResponder, Pressable, ScrollView, View } from "react-native";
import { CommentsSection } from "../../src/features/comments";
import { BarSheetRow, resultLabel } from "../../src/features/video-bits";
import { VideoExerciseLink } from "../../src/features/video-exercise-link";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { PHASE_ORDER, phaseSegments, preciseTimecode, segmentAt, type PhaseSegment } from "../../src/lib/phases";
import { defaultSpeed, playerRate, speedsFor } from "../../src/lib/playback";
import { useActiveSpace, useVideo } from "../../src/lib/queries";
import { ArrowUp, Flag, Pause, Play, Repeat, Share, SkipBack, SkipForward, Trash } from "../../src/ui/icons";
import { Button, Chip, Field, IconButton, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { color, radius, scene, space } from "../../src/ui/theme";

const Timeline = ({
  positionMs,
  durationMs,
  segments,
  markers,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  segments: PhaseSegment[];
  markers: number[];
  onSeek: (ms: number) => void;
}) => {
  const width = useRef(1);
  const seekFromX = useRef((x: number) => {});
  seekFromX.current = (x: number) => onSeek(Math.max(0, Math.min(1, x / width.current)) * durationMs);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => seekFromX.current(e.nativeEvent.locationX),
        onPanResponderMove: (e) => seekFromX.current(e.nativeEvent.locationX),
      }),
    [],
  );
  const pct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const current = segmentAt(segments, positionMs);
  const step = Math.max(100, durationMs / 20);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <View
        {...pan.panHandlers}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={m.mobile.video.seek}
        accessibilityValue={{ text: formatTimecode(positionMs) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e: AccessibilityActionEvent) =>
          onSeek(
            Math.max(0, Math.min(durationMs, positionMs + (e.nativeEvent.actionName === "increment" ? step : -step))),
          )
        }
        style={{ height: 44, justifyContent: "center" }}
      >
        <View pointerEvents="none" style={{ flexDirection: "row", gap: 2, height: 12 }}>
          {segments.length === 0 ? (
            <View style={{ flex: 1, borderRadius: 3, backgroundColor: color.ink3 }} />
          ) : (
            segments.map((s, i) => (
              <View
                key={s.phase}
                style={{
                  flex: Math.max(1, s.endMs - s.startMs),
                  borderRadius: 3,
                  backgroundColor:
                    current?.phase === s.phase ? scene.actionOnCard : i % 2 === 0 ? color.ink3 : scene.textMuted,
                }}
              />
            ))
          )}
        </View>
        {markers.map((t) => (
          <View
            key={t}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 4,
              left: `${durationMs > 0 ? (t / durationMs) * 100 : 0}%`,
              width: 8,
              height: 8,
              marginLeft: -4,
              borderRadius: 4,
              backgroundColor: scene.actionOnCard,
            }}
          />
        ))}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 10,
            bottom: 8,
            left: `${pct}%`,
            width: 3,
            marginLeft: -1.5,
            borderRadius: 2,
            backgroundColor: color.white,
          }}
        />
      </View>
      {segments.length > 0 ? (
        <View
          style={{ flexDirection: "row", gap: 2 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {segments.map((s) => (
            <T
              key={s.phase}
              variant="caption"
              numberOfLines={1}
              tone={current?.phase === s.phase ? "default" : "muted"}
              maxFontSizeMultiplier={1.1}
              style={{ flex: Math.max(1, s.endMs - s.startMs), fontSize: 12 }}
            >
              {m.mobile.jumpPhaseShort[s.phase]}
            </T>
          ))}
        </View>
      ) : (
        <T variant="caption" tone="muted">
          {m.mobile.video.timelineEmpty}
        </T>
      )}
    </View>
  );
};

const Player = ({
  uri,
  fps,
  timeScale,
  knownDurationMs,
  annotations,
  canAnnotate,
  highJump,
  orgId,
  videoId,
  onRetry,
}: {
  onRetry: () => void;
  uri: string;
  fps: number | null;
  // Tout l'écran raisonne en temps réel : seuls les échanges avec le lecteur passent par le temps du fichier étiré.
  timeScale: number;
  knownDurationMs: number | null;
  annotations: { id: string; tMs: number; phase: JumpPhase | null; text: string | null; authorName: string | null }[];
  canAnnotate: boolean;
  highJump: boolean;
  orgId: string;
  videoId: string;
}) => {
  const client = useQueryClient();
  const startSpeed = defaultSpeed(timeScale);
  const speeds = speedsFor(timeScale);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Son coupé : l'étirement l'a ralenti avec l'image.
    p.muted = true;
    p.preservesPitch = false;
    p.timeUpdateEventInterval = 0.04;
    // Pas image par image exact : aucune tolérance de positionnement.
    p.seekTolerance = { toleranceBefore: 0, toleranceAfter: 0 };
    p.playbackRate = playerRate(startSpeed, timeScale);
    p.play();
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const playable = status !== "error";
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(knownDurationMs ?? 0);
  const [rate, setRate] = useState<number>(startSpeed);
  const [loop, setLoop] = useState<PhaseSegment | null>(null);
  const [text, setText] = useState("");
  const [showJumpTools, setShowJumpTools] = useState(highJump);
  const [phase, setPhase] = useState<JumpPhase | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEventListener(player, "sourceLoad", ({ duration }) => {
    if (duration > 0) setDurationMs(Math.round(toRealMs(duration, timeScale)));
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const ms = toRealMs(currentTime, timeScale);
    setPositionMs(ms);
    if (loop && ms >= loop.endMs) player.currentTime = toFileSeconds(loop.startMs, timeScale);
  });

  const stepMs = frameStepMs(fps);
  const seek = (ms: number) => {
    setPositionMs(ms);
    player.currentTime = toFileSeconds(ms, timeScale);
  };
  const stepFrame = (direction: 1 | -1) => {
    player.pause();
    seek(Math.max(0, Math.min(durationMs || Infinity, positionMs + direction * stepMs)));
  };

  const segments = useMemo(() => phaseSegments(annotations, durationMs), [annotations, durationMs]);
  const currentSegment = segmentAt(segments, positionMs);

  const add = useMutation({
    mutationFn: () => api.addAnnotation(orgId, videoId, { tMs: Math.round(positionMs), phase, text: text.trim() }),
    onSuccess: () => {
      setText("");
      setFormError(null);
      void client.invalidateQueries({ queryKey: ["videos", orgId, videoId] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (annotationId: string) => api.deleteAnnotation(orgId, videoId, annotationId),
    onSuccess: () => {
      setLoop(null);
      setFormError(null);
      void client.invalidateQueries({ queryKey: ["videos", orgId, videoId] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });
  const confirmRemove = (annotationId: string) =>
    Alert.alert(m.mobile.video.deleteAnnotation, m.mobile.video.deleteAnnotationConfirm, [
      { text: m.common.cancel, style: "cancel" },
      { text: m.common.delete, style: "destructive", onPress: () => remove.mutate(annotationId) },
    ]);

  return (
    <>
      <View style={{ height: 260, borderRadius: radius.block, overflow: "hidden", backgroundColor: color.ink2 }}>
        {status === "error" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md }}>
            <T variant="small" tone="muted" style={{ textAlign: "center" }}>
              {m.mobile.video.playError}
            </T>
            <Button label={m.mobile.video.retryPlayback} variant="secondary" compact onPress={onRetry} />
          </View>
        ) : (
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="contain"
            style={{ flex: 1 }}
            accessibilityLabel={m.mobile.a11y.videoStatus}
          />
        )}
      </View>

      {playable ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <IconButton
              testID="frame-back"
              icon={SkipBack}
              label={m.video.previousFrame}
              tone="filled"
              shape="square"
              onPress={() => stepFrame(-1)}
            />
            <IconButton
              testID="play-toggle"
              icon={isPlaying ? Pause : Play}
              label={isPlaying ? m.video.pause : m.video.play}
              tone="inverse"
              size={52}
              onPress={() => (isPlaying ? player.pause() : player.play())}
            />
            <IconButton
              testID="frame-forward"
              icon={SkipForward}
              label={m.video.nextFrame}
              tone="filled"
              shape="square"
              onPress={() => stepFrame(1)}
            />
            <T
              variant="figure"
              style={{ flex: 1, textAlign: "right" }}
              accessibilityLabel={m.mobile.a11y.playback(formatTimecode(positionMs))}
            >
              {preciseTimecode(positionMs)}
            </T>
            {currentSegment ? (
              <IconButton
                icon={Repeat}
                label={loop ? m.mobile.video.unloop : m.mobile.video.loopPhase}
                tone={loop ? "inverse" : "filled"}
                shape="square"
                selected={Boolean(loop)}
                onPress={() => {
                  if (loop) setLoop(null);
                  else {
                    setLoop(currentSegment);
                    seek(currentSegment.startMs);
                    player.play();
                  }
                }}
              />
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, alignItems: "center" }}
          >
            <T variant="caption" tone="muted">
              {m.mobile.video.speed}
            </T>
            {speeds.map((r) => (
              <Chip
                key={r.value}
                tall
                minWidth={64}
                label={r.label}
                active={rate === r.value}
                onPress={() => {
                  setRate(r.value);
                  // Sur iOS, changer la vitesse relance la lecture : une image figée doit le rester.
                  const wasPlaying = player.playing;
                  player.playbackRate = playerRate(r.value, timeScale);
                  if (!wasPlaying) player.pause();
                }}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <Timeline
        positionMs={positionMs}
        durationMs={durationMs}
        segments={segments}
        markers={annotations.map((a) => a.tMs)}
        onSeek={seek}
      />

      {annotations.length > 0 ? (
        <View style={{ gap: space.sm }}>
          {annotations.map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "stretch",
                borderRadius: radius.card,
                backgroundColor: color.ink2,
              }}
            >
              <Pressable
                onPress={() => {
                  player.pause();
                  seek(a.tMs);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${formatTimecode(a.tMs)}, ${a.phase ? m.jumpPhase[a.phase] : ""}, ${a.text ?? ""}`}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  gap: space.md,
                  padding: space.md,
                  minHeight: 56,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    height: 24,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.button,
                    backgroundColor: scene.actionOnCard,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T
                    variant="caption"
                    style={{
                      color: scene.onActionOnCard,
                      fontFamily: tokens.font.bodyStrong,
                      fontVariant: ["tabular-nums"],
                    }}
                    maxFontSizeMultiplier={1.1}
                  >
                    {formatTimecode(a.tMs)}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  {a.phase ? (
                    <T variant="caption" tone="muted">
                      {m.jumpPhase[a.phase]}
                    </T>
                  ) : null}
                  <T variant="small">{a.text}</T>
                </View>
              </Pressable>
              {canAnnotate ? (
                <IconButton
                  testID={`annotation-delete-${a.id}`}
                  icon={Trash}
                  label={m.mobile.video.deleteAnnotationNamed(formatTimecode(a.tMs))}
                  disabled={remove.isPending}
                  onPress={() => confirmRemove(a.id)}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <T variant="small" tone="muted">
          {m.mobile.video.noAnnotations}
        </T>
      )}

      {canAnnotate && playable ? (
        <View style={{ gap: space.sm }}>
          <Chip
            label={m.video.highJumpTools}
            active={showJumpTools}
            onPress={() => {
              setShowJumpTools(!showJumpTools);
              setPhase(null);
            }}
          />
          {showJumpTools ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
              accessibilityLabel={m.video.jumpPhase}
            >
              <Chip label={m.mobile.video.noPhase} active={phase === null} onPress={() => setPhase(null)} />
              {PHASE_ORDER.map((ph) => (
                <Chip key={ph} label={m.jumpPhase[ph]} active={phase === ph} onPress={() => setPhase(ph)} />
              ))}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
            <Field
              testID="annotation-input"
              onFocus={() => player.pause()}
              label={m.video.remarkAt(formatTimecode(positionMs))}
              hideLabel
              placeholder={m.video.remarkAt(formatTimecode(positionMs))}
              value={text}
              onChangeText={setText}
              maxLength={500}
              containerStyle={{ flex: 1 }}
              error={formError}
            />
            <IconButton
              testID="annotation-send"
              icon={ArrowUp}
              label={m.video.addComment}
              tone="accent"
              disabled={!text.trim() || add.isPending}
              onPress={() => add.mutate()}
            />
          </View>
        </View>
      ) : null}
    </>
  );
};

export default function VideoAnalysis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, orgId, space: active } = useActiveSpace();
  const video = useVideo(orgId, id);
  const client = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const canAnnotate = active ? isStaff(active.role) : false;

  const share = useMutation({
    mutationFn: (withAthlete: boolean) => api.shareVideo(orgId, id, withAthlete),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["videos", orgId] });
    },
  });
  const [moderating, setModerating] = useState(false);

  if (me.data && !orgId) return <Redirect href="/" />;
  if (video.isPending) {
    return (
      <StackScreen dark>
        <LoadingState />
      </StackScreen>
    );
  }
  if (!video.data) {
    return (
      <StackScreen dark>
        <ErrorState message={m.mobile.video.detailError} onRetry={() => void video.refetch()} />
      </StackScreen>
    );
  }
  const v = video.data;
  // Le MP4 de Mux est plafonné à 30 i/s : c'est l'étirement à l'envoi qui y garde chaque image d'un ralenti.
  const uri = v.mp4Url ?? v.hlsUrl;
  const title = v.barHeightCm ? m.mobile.video.saut(v.athleteName, formatHeight(v.barHeightCm)) : v.athleteName;
  const subtitle = [
    v.recordedAt ? capitalize(formatDayMonth(v.recordedAt.slice(0, 10))) : null,
    v.attemptNo ? m.mobile.video.attemptN(v.attemptNo) : null,
    resultLabel(v.result),
    v.fps ? m.mobile.video.fps(v.fps) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <StackScreen dark title={title} subtitle={subtitle}>
      {uri ? (
        <Player
          key={`${uri}-${attempt}`}
          onRetry={() => setAttempt((n) => n + 1)}
          uri={uri}
          fps={v.fps}
          timeScale={v.timeScale}
          knownDurationMs={v.durationMs}
          annotations={v.annotations}
          canAnnotate={canAnnotate}
          highJump={hasHighJumpContext(v)}
          orgId={orgId}
          videoId={v.id}
        />
      ) : (
        <View
          style={{
            height: 180,
            borderRadius: radius.block,
            backgroundColor: color.ink2,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
          }}
        >
          <T variant="small" tone="muted" style={{ textAlign: "center" }}>
            {v.status === "error"
              ? m.video.failed
              : v.status === "ready"
                ? m.video.playbackUnavailable
                : m.mobile.video.noStream}
          </T>
        </View>
      )}

      {v.fps && !isHighFrameRate(v.fps) ? (
        <T variant="caption" tone="link">
          {m.video.fpsLow}
        </T>
      ) : null}

      {hasHighJumpContext(v) && v.barSheet.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.video.barSheet}</SectionTitle>
          <BarSheetRow rows={v.barSheet} currentCm={v.barHeightCm} />
        </View>
      ) : null}

      {canAnnotate ? (
        <VideoExerciseLink
          orgId={orgId}
          videoId={v.id}
          current={v.exerciseId ?? null}
          currentName={v.exerciseName ?? null}
        />
      ) : null}

      {canAnnotate ? (
        <View style={{ gap: space.xs }}>
          <Button
            testID="video-share"
            label={v.sharedWithAthlete ? m.video.unshare : m.video.share}
            icon={Share}
            variant={v.sharedWithAthlete ? "secondary" : "primary"}
            loading={share.isPending}
            onPress={() => share.mutate(!v.sharedWithAthlete)}
          />
          <T variant="caption" tone={share.isError ? "danger" : "muted"}>
            {share.isError
              ? errorMessage(share.error)
              : v.sharedWithAthlete
                ? m.video.shared
                : m.mobile.video.notShared}
          </T>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.mobile.video.replies}</SectionTitle>
        <CommentsSection orgId={orgId} entityType="video" entityId={v.id} dark placeholder={m.comments.placeholder} />
      </View>

      <View style={{ gap: space.xs }}>
        <Button
          testID="video-report"
          label={m.video.report}
          icon={Flag}
          variant="ghost"
          compact
          style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          onPress={() => setModerating(true)}
        />
        {moderating && video.data ? (
          <ModerationSheet
            dark
            orgId={orgId}
            target={{ entityType: "video", entityId: id, authorId: video.data.uploadedBy }}
            onClose={() => setModerating(false)}
          />
        ) : null}
      </View>
    </StackScreen>
  );
}
