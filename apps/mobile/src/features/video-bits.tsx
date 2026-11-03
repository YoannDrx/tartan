import type { VideoSummary } from "@tartan/contracts";
import { formatHeight, isHighFrameRate } from "@tartan/domain";
import { capitalize, formatDayMonth, m } from "@tartan/i18n";
import { Image, Pressable, View } from "react-native";
import { useUploads, type UploadItem } from "../lib/upload/upload-queue";
import { progressPct } from "../lib/upload/chunks";
import { BarGlyph } from "../ui/glyphs";
import { ChevronRight, CloudUpload } from "../ui/icons";
import { Button, Tag, T } from "../ui/primitives";
import { radius, scene, space, usePalette } from "../ui/theme";

export const resultLabel = (result: VideoSummary["result"]): string | null => {
  if (result === "O") return m.video.cleared;
  if (result === "X") return m.video.failedJump;
  if (result === "pass") return m.video.passed;
  return null;
};

const statusLabel = (video: VideoSummary): string | null => {
  if (video.status === "uploading") return m.mobile.video.sending;
  if (video.status === "processing") return m.video.processing;
  if (video.status === "error") return m.video.failed;
  return null;
};

export const VideoRow = ({
  video,
  showAthlete,
  onPress,
}: {
  video: VideoSummary;
  showAthlete: boolean;
  onPress: () => void;
}) => {
  const p = usePalette();
  const height = video.barHeightCm ? `${formatHeight(video.barHeightCm)} m` : m.mobile.video.noBar;
  const title = showAthlete ? video.athleteName : height;
  const detail = [
    showAthlete ? height : null,
    video.attemptNo ? m.mobile.video.attemptN(video.attemptNo) : null,
    resultLabel(video.result),
    video.recordedAt ? capitalize(formatDayMonth(video.recordedAt.slice(0, 10))) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const status = statusLabel(video);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, detail, status].filter(Boolean).join(", ")}
      android_ripple={{ color: p.ripple }}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: space.md,
        alignItems: "center",
        padding: space.md,
        minHeight: 72,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 64,
          height: 48,
          borderRadius: radius.thumb,
          overflow: "hidden",
          backgroundColor: scene.cardRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={{ width: 64, height: 48 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <BarGlyph color={scene.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="smallStrong">{title}</T>
        <T variant="caption" tone="muted">
          {detail}
        </T>
        <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap", marginTop: 2 }}>
          {status ? <Tag label={status} tone={video.status === "error" ? "alert" : "neutral"} /> : null}
          {video.fps ? (
            <Tag label={m.mobile.video.fps(video.fps)} tone={isHighFrameRate(video.fps) ? "neutral" : "warning"} />
          ) : null}
        </View>
      </View>
      <ChevronRight size={20} color={p.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
};

export const UploadRow = ({ item }: { item: UploadItem }) => {
  const retry = useUploads((s) => s.retry);
  const remove = useUploads((s) => s.remove);
  const p = usePalette();
  const pct = progressPct(item.offset, item.size);
  const failed = item.state === "failed";
  return (
    <View
      style={{ padding: space.md, gap: space.sm }}
      accessible={!failed}
      accessibilityLabel={`${item.athleteName}, ${m.video.uploading}, ${m.mobile.video.progress(pct)}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <CloudUpload
          size={22}
          color={failed ? p.danger : p.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={{ flex: 1 }}>
          <T variant="smallStrong">{item.athleteName}</T>
          <T variant="caption" tone={failed ? "danger" : "muted"}>
            {failed
              ? (item.error ?? m.mobile.video.uploadFailed)
              : `${m.video.uploading} · ${m.mobile.video.progress(pct)}`}
          </T>
        </View>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: p.surfaceAlt, overflow: "hidden" }}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: failed ? p.status.missed : p.text }} />
      </View>
      {failed ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            label={m.mobile.video.retry}
            variant="secondary"
            compact
            style={{ flex: 1 }}
            onPress={() => retry(item.id)}
          />
          <Button
            label={m.mobile.video.remove}
            variant="danger"
            compact
            style={{ flex: 1 }}
            onPress={() => remove(item.id)}
          />
        </View>
      ) : null}
    </View>
  );
};

export const BarSheetRow = ({
  rows,
  currentCm,
}: {
  rows: { heightCm: number; label: string; notation: string }[];
  currentCm: number | null;
}) => {
  const p = usePalette();
  if (rows.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
      {rows.map((r) => {
        const current = r.heightCm === currentCm;
        return (
          <View
            key={r.heightCm}
            accessible
            accessibilityLabel={m.mobile.barSheet.a11y(r.label, r.notation, current)}
            style={{
              minWidth: 58,
              flexGrow: 1,
              alignItems: "center",
              paddingVertical: space.xs + 2,
              borderRadius: radius.thumb,
              backgroundColor: current ? p.accent : p.surface,
            }}
          >
            <T variant="figure" style={[{ fontSize: 17, lineHeight: 20 }, current ? { color: p.accentText } : null]}>
              {r.label}
            </T>
            <T variant="caption" tone="muted" style={current ? { color: p.accentText } : null}>
              {r.notation}
            </T>
          </View>
        );
      })}
    </View>
  );
};
