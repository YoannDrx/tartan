import type { JumpResult } from "@tartan/contracts";
import { formatHeight, isHighFrameRate, MAX_FILE_SECONDS, nextAttemptNo, timeScaleFor, type Attempt } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import {
  Camera,
  CommonResolutions,
  type Recorder,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
} from "react-native-vision-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chooseCaptureFps, type CaptureChoice } from "../src/lib/capture-fps";
import { useActiveSpace, useAthletes } from "../src/lib/queries";
import { submitJumpAttempt } from "../src/lib/sync/op-queue";
import { useUploads } from "../src/lib/upload/upload-queue";
import { Camera as CameraIcon, Images, Minus, Plus, Square, X } from "../src/ui/icons";
import { Button, Chip, IconButton, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../src/ui/states";
import { color, radius, Scene, space, usePalette } from "../src/ui/theme";

const Stepper = ({
  label,
  value,
  display,
  onChange,
  steps,
  min,
  max,
}: {
  label: string;
  value: number;
  display: string;
  onChange: (n: number) => void;
  steps: number[];
  min: number;
  max: number;
}) => {
  const p = usePalette();
  const shift = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={{ gap: space.xs + 2 }}>
      <T variant="smallStrong">{label}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs + 2 }}>
        {[...steps].reverse().map((s) => (
          <Pressable
            key={`-${s}`}
            onPress={() => shift(-s)}
            accessibilityRole="button"
            accessibilityLabel={`${m.mobile.a11y.decrease(label)} ${s}`}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.button,
              backgroundColor: p.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {steps.length === 1 ? <Minus size={18} color={p.text} /> : <T variant="smallStrong">{`−${s}`}</T>}
          </Pressable>
        ))}
        <T
          variant="figure"
          style={{ flex: 1, textAlign: "center", fontSize: 30, lineHeight: 34 }}
          accessibilityLiveRegion="polite"
        >
          {display}
        </T>
        {steps.map((s) => (
          <Pressable
            key={`+${s}`}
            onPress={() => shift(s)}
            accessibilityRole="button"
            accessibilityLabel={`${m.mobile.a11y.increase(label)} ${s}`}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.button,
              backgroundColor: p.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {steps.length === 1 ? <Plus size={18} color={p.text} /> : <T variant="smallStrong">{`+${s}`}</T>}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const LocalPreview = ({ uri, onFps }: { uri: string; onFps: (fps: number) => void }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEventListener(player, "sourceLoad", ({ availableVideoTracks }) => {
    const rate = availableVideoTracks[0]?.frameRate ?? null;
    // Fichier sans information : on garde la fréquence connue (celle de la capture).
    if (rate) onFps(Math.round(rate));
  });
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={{ flex: 1 }}
      accessibilityLabel={m.mobile.a11y.videoStatus}
    />
  );
};

const CameraModal = ({
  choice,
  onClose,
  onRecorded,
}: {
  choice: CaptureChoice;
  onClose: () => void;
  onRecorded: (uri: string, fps: number) => void;
}) => {
  const camera = useCameraPermission();
  const mic = useMicrophonePermission();
  const device = useCameraDevice("back");
  const insets = useSafeAreaInsets();
  const video = useVideoOutput({ targetResolution: CommonResolutions.FHD_16_9, enableAudio: mic.hasPermission });
  const recorderRef = useRef<Recorder | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [failed, setFailed] = useState(false);
  // La négociation peut retenir moins que demandé : c'est la fréquence réelle qui compte.
  const [selectedFps, setSelectedFps] = useState(choice.fps);

  useEffect(() => {
    if (camera.canRequestPermission) void camera.requestPermission();
    if (mic.canRequestPermission) void mic.requestPermission();
    // Une seule demande à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    if (recording) {
      await recorderRef.current?.stopRecording().catch(() => setFailed(true));
      return;
    }
    setFailed(false);
    try {
      // Au-delà, le fichier étiré dépasserait la durée acceptée à l'envoi : 60 s à 240 i/s.
      const maxDuration = Math.min(120, Math.floor(MAX_FILE_SECONDS / timeScaleFor(selectedFps)));
      const recorder = await video.createRecorder({ maxDuration });
      recorderRef.current = recorder;
      await recorder.startRecording(
        (filePath) => {
          setRecording(false);
          onRecorded(filePath.startsWith("file://") ? filePath : `file://${filePath}`, selectedFps);
        },
        () => {
          setRecording(false);
          setFailed(true);
        },
      );
      setRecording(true);
    } catch {
      setRecording(false);
      setFailed(true);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Scene dark>
        <View style={{ flex: 1, backgroundColor: color.ink }}>
          {!device ? (
            <View style={{ flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}>
              <T>{m.mobile.capture.noCamera}</T>
              <Button label={m.common.close} variant="secondary" onPress={onClose} />
            </View>
          ) : !camera.hasPermission ? (
            <View style={{ flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}>
              <T>{m.mobile.video.cameraDenied}</T>
              {camera.canRequestPermission ? (
                <Button label={m.mobile.video.cameraAllow} onPress={() => void camera.requestPermission()} />
              ) : (
                <Button
                  label={m.mobile.video.openSettings}
                  variant="secondary"
                  onPress={() => void Linking.openSettings()}
                />
              )}
              <Button label={m.common.close} variant="secondary" onPress={onClose} />
            </View>
          ) : (
            <>
              <Camera
                style={{ flex: 1 }}
                device={device}
                isActive
                outputs={[video]}
                constraints={[{ fps: choice.fps }, { resolutionBias: video }]}
                resizeMode="contain"
                onStarted={() => setReady(true)}
                onSessionConfigSelected={(config) => {
                  if (config.selectedFPS) setSelectedFps(Math.round(config.selectedFPS));
                }}
                onError={() => setFailed(true)}
              />
              <View
                style={{
                  position: "absolute",
                  top: insets.top + space.sm,
                  left: space.lg,
                  right: space.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <IconButton
                  icon={X}
                  label={m.mobile.video.cameraClose}
                  tone="filled"
                  onPress={onClose}
                  disabled={recording}
                />
                <View
                  style={{
                    backgroundColor: color.ink,
                    borderRadius: radius.pill,
                    paddingHorizontal: space.md,
                    paddingVertical: space.xs + 2,
                  }}
                >
                  <T variant="smallStrong" style={{ fontVariant: ["tabular-nums"] }}>
                    {m.mobile.capture.badge(selectedFps)}
                  </T>
                </View>
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: insets.bottom + space.xl,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                  gap: space.md,
                }}
              >
                {failed ? (
                  <View style={{ backgroundColor: color.ink, borderRadius: radius.button, padding: space.sm }}>
                    <T variant="caption">{m.mobile.video.cameraFail}</T>
                  </View>
                ) : null}
                <Pressable
                  testID="camera-record"
                  onPress={() => void toggle()}
                  disabled={!ready}
                  accessibilityRole="button"
                  accessibilityLabel={recording ? m.mobile.video.stop : m.mobile.video.record}
                  accessibilityState={{ disabled: !ready }}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    borderWidth: 4,
                    borderColor: color.white,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: ready ? 1 : 0.5,
                  }}
                >
                  {recording ? (
                    <Square size={28} color={color.brand} fill={color.brand} />
                  ) : (
                    <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: color.brand }} />
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Scene>
    </Modal>
  );
};

export default function Capture() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { orgId } = useActiveSpace();
  const athletes = useAthletes(orgId);
  const addUpload = useUploads((s) => s.add);
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barCm, setBarCm] = useState(160);
  const [result, setResult] = useState<JumpResult>("O");
  const [steps, setSteps] = useState(9);
  const [saved, setSaved] = useState<Attempt[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [attemptOverride, setAttemptOverride] = useState<number | null>(null);
  const [athleteError, setAthleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const device = useCameraDevice("back");
  const choice = useMemo(() => (device ? chooseCaptureFps((fps) => device.supportsFPS(fps)) : null), [device]);
  const advice = !choice
    ? m.mobile.capture.noCamera
    : choice.fps >= 240
      ? m.mobile.capture.fps240
      : choice.slowMotion
        ? m.mobile.capture.fps120
        : m.mobile.capture.fpsStandard(choice.fps);

  const suggested = nextAttemptNo(saved, barCm) ?? 1;
  const attemptNo = attemptOverride ?? suggested;

  const pick = async () => {
    // Sur iOS, sans accès préalable à la photothèque, le sélecteur réencode à 30 i/s : le ralenti serait perdu.
    if (Platform.OS === "ios") await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => undefined);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
      // Pas de réencodage : garder la fréquence d'origine, sinon le ralenti est perdu.
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    const asset = picked.assets?.[0];
    if (!picked.canceled && asset) {
      setFps(null);
      setUri(asset.uri);
    }
  };

  const remember = () => {
    setSaved([...saved, { barHeightCm: barCm, attemptNo, result }]);
    setAttemptOverride(null);
    setResult("O");
    setUri(null);
    setFps(null);
  };

  const athleteName = () => {
    const a = athletes.data?.find((x) => x.id === athleteId);
    return a ? `${a.firstName} ${a.lastName}`.trim() : "";
  };

  const attempt = { barHeightCm: barCm, attemptNo, result, approachSteps: steps };

  const send = async () => {
    if (!athleteId) {
      setAthleteError(m.mobile.video.pickAthleteRequired);
      return;
    }
    if (!uri) return;
    setBusy(true);
    try {
      const refused = await addUpload({
        orgId,
        athleteName: athleteName(),
        sourceUri: uri,
        input: {
          athleteId,
          scheduledSessionId: params.sessionId ?? null,
          fps,
          recordedAt: new Date().toISOString(),
          attempt,
        },
      });
      if (refused) {
        setMessage(m.video.tooLong(refused.tooLongSeconds));
        return;
      }
      setMessage(m.mobile.video.queued);
      remember();
    } catch {
      setMessage(m.mobile.video.cameraFail);
    } finally {
      setBusy(false);
    }
  };

  const saveOnly = () => {
    if (!athleteId) {
      setAthleteError(m.mobile.video.pickAthleteRequired);
      return;
    }
    void submitJumpAttempt(orgId, { athleteId, scheduledSessionId: params.sessionId ?? null, ...attempt });
    setMessage(m.mobile.video.saved);
    remember();
  };

  return (
    <StackScreen
      dark
      title={m.video.capture}
      footer={
        uri ? (
          <Button testID="capture-send" label={m.mobile.video.queue} loading={busy} onPress={() => void send()} />
        ) : (
          <Button
            testID="capture-save-attempt"
            label={m.mobile.video.saveWithoutVideo}
            variant="secondary"
            onPress={saveOnly}
          />
        )
      }
    >
      {uri ? (
        <View style={{ gap: space.sm }}>
          <View style={{ height: 220, borderRadius: radius.block, overflow: "hidden", backgroundColor: color.ink2 }}>
            <LocalPreview key={uri} uri={uri} onFps={setFps} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <T variant="caption" tone={fps && !isHighFrameRate(fps) ? "link" : "muted"} style={{ flex: 1 }}>
              {fps
                ? isHighFrameRate(fps)
                  ? m.mobile.video.detected(fps)
                  : `${m.mobile.video.detected(fps)}. ${m.video.fpsLow}`
                : m.video.slowHint}
            </T>
            <Button label={m.mobile.video.changeVideo} variant="secondary" compact onPress={() => setUri(null)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <T variant="small" tone="muted">
            {advice}
          </T>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="capture-import"
                label={m.video.import}
                icon={Images}
                onPress={() => void pick()}
              />
            </View>
            {/* Pas de caméra (simulateur, appareil sans capteur) : un bouton qui ne ferait rien n'a pas sa place. */}
            {choice ? (
              <View style={{ flex: 1 }}>
                <Button
                  testID="capture-film"
                  label={m.mobile.video.film}
                  icon={CameraIcon}
                  variant="secondary"
                  onPress={() => setCameraOpen(true)}
                />
              </View>
            ) : null}
          </View>
        </View>
      )}

      {message ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {message}
        </T>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="smallStrong">{m.mobile.video.pickAthlete}</T>
        {athletes.isPending ? <LoadingState inline /> : null}
        {athletes.isError && !athletes.data ? (
          <ErrorState error={athletes.error} onRetry={() => void athletes.refetch()} />
        ) : null}
        {athletes.data?.length === 0 ? <EmptyState body={m.mobile.video.noAthletes} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {athletes.data?.map((a) => (
            <Chip
              key={a.id}
              tall
              label={`${a.firstName} ${a.lastName}`.trim()}
              active={athleteId === a.id}
              onPress={() => {
                setAthleteId(a.id);
                setAthleteError(null);
                setSaved([]);
              }}
            />
          ))}
        </ScrollView>
        {athleteError ? (
          <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {athleteError}
          </T>
        ) : null}
      </View>

      <Stepper
        label={m.mobile.video.barLabel}
        value={barCm}
        display={`${formatHeight(barCm)} m`}
        steps={[1, 5]}
        min={50}
        max={700}
        onChange={setBarCm}
      />

      <View style={{ gap: space.sm }}>
        <T variant="smallStrong">{m.video.attempt}</T>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[1, 2, 3].map((n) => (
            <Chip
              key={n}
              tall
              minWidth={64}
              label={String(n)}
              active={attemptNo === n}
              accessibilityLabel={m.mobile.video.attemptN(n)}
              onPress={() => setAttemptOverride(n)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="smallStrong">{m.video.result}</T>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip
            tall
            minWidth={64}
            label="O"
            accessibilityLabel={m.video.cleared}
            active={result === "O"}
            onPress={() => setResult("O")}
          />
          <Chip
            tall
            minWidth={64}
            label="X"
            accessibilityLabel={m.video.failedJump}
            active={result === "X"}
            onPress={() => setResult("X")}
          />
          <Chip
            tall
            minWidth={64}
            label="–"
            accessibilityLabel={m.video.passed}
            active={result === "pass"}
            onPress={() => setResult("pass")}
          />
        </View>
      </View>

      <Stepper
        label={m.video.approachSteps}
        value={steps}
        display={String(steps)}
        steps={[1]}
        min={1}
        max={40}
        onChange={setSteps}
      />

      {cameraOpen && choice ? (
        <CameraModal
          choice={choice}
          onClose={() => setCameraOpen(false)}
          onRecorded={(recorded, recordedFps) => {
            setCameraOpen(false);
            setFps(recordedFps);
            setUri(recorded);
          }}
        />
      ) : null}
    </StackScreen>
  );
}
