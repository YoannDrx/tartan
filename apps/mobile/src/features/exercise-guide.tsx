import type { CatalogVideo, ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { exerciseClip } from "@tartan/mascot/exercises";
import { useVideoPlayer, VideoView } from "expo-video";
import { guideIllustrationQuery } from "../lib/exercise-guide-media";
import { guideAuthorship, guideMediaModes, showsReviewedText, shownGuideText } from "../lib/exercise-guide-text";
import { GuideMotion } from "./guide-motion";
import { ChevronRight } from "../ui/icons";
import { Button, Chip, SectionTitle, T } from "../ui/primitives";
import { color, radius, space, usePalette } from "../ui/theme";

const t = m.nativeExercises.guide;
const media = m.exerciseGuide.media;
const views = m.exerciseGuide.motion.views;

export type GuideVariants = {
  easier: { id: string; name: string } | null;
  harder: { id: string; name: string } | null;
};

function GuideIllustration({ guide }: { guide: ExerciseGuide }) {
  const illustration = useQuery(guideIllustrationQuery(guide));
  return illustration.data ? (
    <View accessible accessibilityRole="image" accessibilityLabel={guide.illustration.alt}>
      <SvgXml
        xml={illustration.data}
        width="100%"
        height={220}
        onError={() => undefined}
        fallback={
          <T variant="small" tone="muted">
            {m.exerciseGuide.illustrationUnavailable}
          </T>
        }
      />
      <T variant="small" tone="muted">
        {guide.technicalReview === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending}
      </T>
    </View>
  ) : (
    <T variant="small" tone="muted">
      {m.exerciseGuide.illustrationUnavailable}
    </T>
  );
}

// Une vidéo de la fiche commune, lue par l'adresse signée que renvoie le serveur.
function CatalogVideoView({ guide, video }: { guide: ExerciseGuide; video: CatalogVideo & { streamUrl: string } }) {
  const player = useVideoPlayer(video.streamUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <View style={{ aspectRatio: 16 / 9, borderRadius: radius.card, overflow: "hidden", backgroundColor: color.ink }}>
      <VideoView
        testID="exercise-guide-video"
        player={player}
        nativeControls
        contentFit="contain"
        style={{ flex: 1 }}
        accessibilityLabel={media.videoOf(guide.illustration.alt, views[video.view])}
      />
    </View>
  );
}

// La vidéo de la fiche commune, une vue à la fois. Sans adresse de lecture, la fiche le dit.
function CatalogVideoPlayer({ guide, videos }: { guide: ExerciseGuide; videos: CatalogVideo[] }) {
  const [view, setView] = useState(videos[0]!.view);
  const video = videos.find((item) => item.view === view) ?? videos[0]!;
  return (
    <View style={{ gap: space.sm }}>
      {video.streamUrl ? (
        <CatalogVideoView key={video.view} guide={guide} video={{ ...video, streamUrl: video.streamUrl }} />
      ) : (
        <T variant="small" tone="muted" accessibilityLiveRegion="polite">
          {media.videoUnavailable}
        </T>
      )}
      {videos.length > 1 ? (
        <View accessibilityLabel={m.exerciseGuide.motion.view} style={{ flexDirection: "row", gap: space.sm }}>
          {videos.map((item) => (
            <Chip
              key={item.view}
              tall
              testID={`exercise-guide-video-${item.view}`}
              label={views[item.view]}
              active={view === item.view}
              onPress={() => setView(item.view)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Le geste d'abord ; une fiche commune qui a sa vidéo la propose à côté (« Geste animé », « Vidéo »).
function GuideMedia({ guide }: { guide: ExerciseGuide }) {
  const clip = exerciseClip(guide.catalogKey);
  const modes = guideMediaModes(guide, Boolean(clip));
  const [mode, setMode] = useState(modes[0] ?? "motion");
  if (modes.length === 0)
    return guide.illustration.status === "ready" ? (
      <GuideIllustration key={guide.illustration.path} guide={guide} />
    ) : (
      <T variant="small" tone="muted">
        {m.exerciseGuide.illustrationNotReady}
      </T>
    );
  return (
    <View style={{ gap: space.sm }}>
      {modes.length > 1 ? (
        <View accessibilityLabel={media.choice} style={{ flexDirection: "row", gap: space.sm }}>
          {modes.map((option) => (
            <Chip
              key={option}
              tall
              testID={`exercise-guide-media-${option}`}
              label={media[option]}
              active={mode === option}
              onPress={() => setMode(option)}
            />
          ))}
        </View>
      ) : null}
      {mode === "motion" && clip ? (
        <GuideMotion guide={guide} clip={clip} />
      ) : (
        <CatalogVideoPlayer guide={guide} videos={guide.illustration.videos ?? []} />
      )}
    </View>
  );
}

const Steps = ({ lines }: { lines: readonly string[] }) => {
  const p = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      {lines.map((line, index) => (
        <View
          key={index}
          accessible
          accessibilityLabel={`${t.step(index + 1)} : ${line}`}
          style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}
        >
          {/* Le numéro de l'étape est celui de sa pastille, sous le geste. */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: p.raised,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T variant="smallStrong" style={{ color: p.onRaised, fontVariant: ["tabular-nums"] }}>
              {String(index + 1)}
            </T>
          </View>
          <T style={{ flex: 1, paddingTop: 2 }}>{line}</T>
        </View>
      ))}
    </View>
  );
};

const Bullets = ({ lines }: { lines: readonly string[] }) => {
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      {lines.map((line, index) => (
        <View key={index} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 6, height: 6, borderRadius: 3, marginTop: 9, backgroundColor: p.text }}
          />
          <T style={{ flex: 1 }}>{line}</T>
        </View>
      ))}
    </View>
  );
};

/**
 * La fiche d'un geste, la même partout (bibliothèque, constructeur, séance de l'athlète), comme sur le web : le geste
 * d'abord, une phrase d'objectif, la mise en place en une ligne, les étapes numérotées comme les pastilles du geste,
 * les erreurs à éviter, puis les variantes. Le texte complet reste sous « Détail ».
 */
export function MovementGuide({
  guide,
  variants,
  onOpenVariant,
}: {
  guide: ExerciseGuide;
  variants?: GuideVariants;
  onOpenVariant?: (variant: { id: string; name: string }) => void;
}) {
  const p = usePalette();
  const [detail, setDetail] = useState(false);
  const text = shownGuideText(guide);
  const reviewed = showsReviewedText(guide);
  const variantRows = (
    [
      [t.easier, text.easier, variants?.easier ?? null],
      [t.harder, text.harder, variants?.harder ?? null],
    ] as const
  ).filter(([, variant]) => variant);
  const authorship = guideAuthorship(guide);
  return (
    <View testID="exercise-guide-concise" accessibilityLabel={m.exerciseGuide.title} style={{ gap: space.lg }}>
      <GuideMedia guide={guide} />
      <T variant="bodyStrong">{text.objective}</T>
      <View style={{ gap: space.xs }}>
        <SectionTitle>{t.setup}</SectionTitle>
        <T>{text.setup}</T>
      </View>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.steps}</SectionTitle>
        <Steps lines={text.steps} />
      </View>
      <View style={{ gap: space.xs }}>
        <SectionTitle>{t.mistakes}</SectionTitle>
        <Bullets lines={text.mistakes} />
      </View>
      {variantRows.length > 0 ? (
        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: p.border }}>
          {variantRows.map(([label, variant, link], index) =>
            link && onOpenVariant ? (
              <Pressable
                key={label}
                accessibilityRole="link"
                accessibilityLabel={`${label} : ${m.nativeExercises.sheet.variant(link.name)}`}
                onPress={() => onOpenVariant(link)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderColor: p.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <T variant="bodyStrong" style={{ width: 120 }}>
                  {label}
                </T>
                <T tone="link" style={{ flex: 1, textDecorationLine: "underline" }}>
                  {link.name}
                </T>
                <ChevronRight size={18} color={p.link} accessibilityElementsHidden importantForAccessibility="no" />
              </Pressable>
            ) : (
              <View
                key={label}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingVertical: space.sm,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderColor: p.border,
                }}
              >
                <T variant="bodyStrong" style={{ width: 120 }}>
                  {label}
                </T>
                <T style={{ flex: 1 }}>{variant!.text}</T>
              </View>
            ),
          )}
        </View>
      ) : null}
      <Button
        testID="exercise-guide-detail"
        label={t.detail}
        variant="ghost"
        compact
        expanded={detail}
        style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
        onPress={() => setDetail(!detail)}
      />
      {detail ? (
        <View testID="exercise-guide-detail-content" style={{ gap: space.md }}>
          {reviewed ? (
            <>
              <T variant="small" tone="muted">
                {t.detailHint}
              </T>
              <T>{guide.objective}</T>
              <View style={{ gap: space.xs }}>
                <SectionTitle>{t.setup}</SectionTitle>
                <Bullets lines={guide.setup} />
              </View>
              <View style={{ gap: space.sm }}>
                <SectionTitle>{t.steps}</SectionTitle>
                <Steps lines={guide.steps} />
              </View>
              <View style={{ gap: space.xs }}>
                <SectionTitle>{t.mistakes}</SectionTitle>
                <Bullets lines={guide.mistakes} />
              </View>
              {(
                [
                  [t.easier, guide.easier],
                  [t.harder, guide.progression],
                ] as const
              ).map(([title, line]) =>
                line ? (
                  <View key={title} style={{ gap: space.xs }}>
                    <SectionTitle>{title}</SectionTitle>
                    <T>{line}</T>
                  </View>
                ) : null,
              )}
            </>
          ) : null}
          {(
            [
              [m.exerciseGuide.breathing, guide.breathing],
              [m.exerciseGuide.counting, guide.counting.explanation],
              [m.exerciseGuide.load, guide.loadExplanation],
            ] as const
          ).map(([title, line]) =>
            line ? (
              <View key={title} style={{ gap: space.xs }}>
                <SectionTitle>{title}</SectionTitle>
                <T>{line}</T>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
      <T variant="small" tone="muted">
        {`${
          authorship === "coach"
            ? t.coach
            : authorship === "approved"
              ? m.exerciseGuide.approved
              : m.exerciseGuide.pending
        } ${m.exerciseGuide.families[guide.family]}, ${m.exerciseGuide.levels[guide.level].toLowerCase()}.`}
      </T>
    </View>
  );
}

// Dans la séance et le formulaire : la fiche repliée sous « Voir le guide du mouvement », pour ne pas couvrir la tâche.
export function MovementGuideDisclosure({ guide }: { guide: ExerciseGuide }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Button
        testID="exercise-guide-open"
        label={m.exerciseGuide.open}
        variant="secondary"
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <View testID="exercise-guide-content">
          <MovementGuide guide={guide} />
        </View>
      ) : null}
    </View>
  );
}
