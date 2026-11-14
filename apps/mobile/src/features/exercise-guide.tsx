import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { guideIllustrationQuery } from "../lib/exercise-guide-media";
import { Button, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

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

export function MovementGuide({ guide }: { guide: ExerciseGuide }) {
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
        <View testID="exercise-guide-content" style={{ gap: space.md }}>
          <SectionTitle>{m.exerciseGuide.title}</SectionTitle>
          <T variant="small" tone="muted">
            {[
              m.exerciseGuide.families[guide.family],
              m.exerciseGuide.levels[guide.level],
              m.exerciseGuide.version(guide.version),
            ].join(" · ")}
          </T>
          <T variant="smallStrong">
            {guide.technicalReview === "approved" ? m.exerciseGuide.approved : m.exerciseGuide.pending}
          </T>
          <T>{guide.objective}</T>
          {guide.illustration.status === "ready" ? (
            <GuideIllustration key={guide.illustration.path} guide={guide} />
          ) : (
            <T variant="small" tone="muted">
              {m.exerciseGuide.illustrationNotReady}
            </T>
          )}
          {(
            [
              [m.exerciseGuide.setup, guide.setup],
              [m.exerciseGuide.steps, guide.steps],
              [m.exerciseGuide.mistakes, guide.mistakes],
            ] as const
          ).map(([title, lines]) => (
            <View key={title} style={{ gap: space.xs }}>
              <SectionTitle>{title}</SectionTitle>
              {lines.map((line, index) => (
                <T key={index}>{`${index + 1}. ${line}`}</T>
              ))}
            </View>
          ))}
          {(
            [
              [m.exerciseGuide.breathing, guide.breathing],
              [m.exerciseGuide.counting, guide.counting.explanation],
              [m.exerciseGuide.load, guide.loadExplanation],
              [m.exerciseGuide.easier, guide.easier],
              [m.exerciseGuide.progression, guide.progression],
            ] as const
          ).map(([title, text]) =>
            text ? (
              <View key={title} style={{ gap: space.xs }}>
                <SectionTitle>{title}</SectionTitle>
                <T>{text}</T>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );
}
