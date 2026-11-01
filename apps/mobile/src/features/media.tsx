import { m } from "@tartan/i18n";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { WebView } from "react-native-webview";
import { z } from "zod";
import { config } from "../lib/config";
import { useIsOnline } from "../lib/network";
import { CategoryGlyph } from "../ui/glyphs";
import { Play } from "../ui/icons";
import { Tag, T } from "../ui/primitives";
import { color, radius, space, usePalette } from "../ui/theme";

// Les vidéos Mux sont privées : l'API fournit des adresses signées (streamUrl en MP4, hlsUrl).
// Sans clé Mux ou sans jeton, ces champs manquent : l'écran affiche « pas de vidéo ».
const exerciseMedia = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("upload"),
    streamUrl: z.string().nullish(),
    hlsUrl: z.string().nullish(),
    title: z.string().nullish(),
  }),
  z.object({
    kind: z.literal("youtube"),
    youtubeId: z.string(),
    title: z.string().nullish(),
    startS: z.number().nullish(),
    endS: z.number().nullish(),
  }),
]);
export type ExerciseMedia = z.infer<typeof exerciseMedia>;

export const parseMedia = (raw: unknown): ExerciseMedia | null => {
  const parsed = exerciseMedia.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.kind === "upload" && !parsed.data.streamUrl && !parsed.data.hlsUrl) return null;
  return parsed.data;
};

export const SPEEDS = [
  { value: 0.25, label: "0,25×" },
  { value: 0.5, label: "0,5×" },
  { value: 1, label: "1×" },
] as const;

const NoVideo = ({ message }: { message: string }) => {
  const p = usePalette();
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: p.surface }}
    >
      <T variant="small" tone="muted" style={{ textAlign: "center" }}>
        {message}
      </T>
    </View>
  );
};

const MuxLoop = ({ uri, rate }: { uri: string; rate: number }) => {
  const source = useMemo(() => ({ uri, useCaching: true }), [uri]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = false;
    p.play();
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);
  if (status === "error") return <NoVideo message={m.mobile.sessionMode.videoError} />;
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={{ flex: 1 }}
      accessibilityLabel={m.sessionMode.playDemo}
    />
  );
};

// Lecteur officiel YouTube (API IFrame) : pas de téléchargement, début et fin respectés, boucle.
const youtubeHtml = (media: Extract<ExerciseMedia, { kind: "youtube" }>, rate: number) => {
  const start = media.startS ?? 0;
  const end = media.endS ?? null;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body,#p{margin:0;padding:0;width:100%;height:100%;background:${color.ink}}</style></head><body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script><script>
var player,rate=${rate};
function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:${JSON.stringify(media.youtubeId)},
playerVars:{playsinline:1,rel:0,modestbranding:1,mute:1,autoplay:1,start:${start}${end !== null ? `,end:${end}` : ""},origin:${JSON.stringify(config.webUrl)}},
events:{onReady:function(e){e.target.mute();e.target.setPlaybackRate(rate);e.target.playVideo();},
onStateChange:function(e){if(e.data===YT.PlayerState.ENDED){e.target.seekTo(${start});e.target.playVideo();}}}});}
window.setRate=function(r){rate=r;if(player&&player.setPlaybackRate)player.setPlaybackRate(r);};
</script></body></html>`;
};

const YouTubeLoop = ({ media, rate }: { media: Extract<ExerciseMedia, { kind: "youtube" }>; rate: number }) => {
  const ref = useRef<WebView>(null);
  const [failed, setFailed] = useState(false);
  const initialRate = useRef(rate);
  const html = useMemo(() => youtubeHtml(media, initialRate.current), [media]);
  useEffect(() => {
    ref.current?.injectJavaScript(`window.setRate&&window.setRate(${rate});true;`);
  }, [rate]);
  if (failed) return <NoVideo message={m.mobile.sessionMode.videoError} />;
  return (
    <WebView
      ref={ref}
      source={{ html, baseUrl: config.webUrl }}
      originWhitelist={["*"]}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      scrollEnabled={false}
      onError={() => setFailed(true)}
      style={{ flex: 1, backgroundColor: color.ink }}
      accessibilityLabel={m.sessionMode.playDemo}
    />
  );
};

export const ExerciseVideo = ({ media, rate }: { media: ExerciseMedia | null; rate: number }) => {
  const online = useIsOnline();
  let content;
  if (!media) content = <NoVideo message={m.sessionMode.noVideo} />;
  else if (media.kind === "youtube") {
    content = online ? (
      <YouTubeLoop media={media} rate={rate} />
    ) : (
      <NoVideo message={m.mobile.sessionMode.offlineNote} />
    );
  } else {
    content = <MuxLoop uri={(media.streamUrl ?? media.hlsUrl) as string} rate={rate} />;
  }
  return (
    <View style={{ height: 210, borderRadius: radius.block, overflow: "hidden", backgroundColor: color.ink2 }}>
      {content}
    </View>
  );
};

type ExerciseRowProps = {
  name: string;
  category: string;
  summary?: string;
  hasVideo: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
};

// Vignette 44 px, nom, prescription en texte secondaire, étiquette de catégorie.
export const ExerciseRow = ({ name, category, summary, hasVideo, onPress, accessibilityHint }: ExerciseRowProps) => {
  const p = usePalette();
  const categoryLabel = (m.exerciseCategory as Record<string, string>)[category] ?? category;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={[name, summary, categoryLabel].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: p.ripple }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        minHeight: 64,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.thumb,
          backgroundColor: p.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasVideo ? (
          <Play size={18} color={p.text} fill={p.text} />
        ) : (
          <CategoryGlyph category={category} size={20} color={p.text} />
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="smallStrong">{name}</T>
        {summary ? (
          <T variant="caption" tone="muted">
            {summary}
          </T>
        ) : null}
      </View>
      <View>
        <Tag label={categoryLabel} />
      </View>
    </Pressable>
  );
};
