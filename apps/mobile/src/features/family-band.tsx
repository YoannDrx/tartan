import type { ExerciseFamily } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { View } from "react-native";
import { FamilyGlyph } from "../ui/glyphs";
import { T } from "../ui/primitives";
import { radius, space } from "../ui/theme";
import { useFamilyTint } from "./media";

/** Les fiches affichées, regroupées par famille dans leur ordre, chacune avec son rang dans toute la liste. */
export const familySections = <E,>(items: readonly E[], familyOf: (item: E) => ExerciseFamily) => {
  const sections: { family: ExerciseFamily; items: { item: E; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const family = familyOf(item);
    const last = sections.at(-1);
    if (last?.family === family) last.items.push({ item, index });
    else sections.push({ family, items: [{ item, index }] });
  });
  return sections;
};

/**
 * Le bandeau d'une famille : sa teinte, son pictogramme, son nom et son nombre de fiches. Il reste en haut de l'écran
 * pendant que sa section défile, puis la famille suivante le pousse. Le nom porte le sens, la couleur aide à se repérer.
 */
export const FamilyBand = ({ family, count }: { family: ExerciseFamily; count: number }) => {
  const tint = useFamilyTint(family);
  const name = m.exerciseGuide.families[family];
  const total = m.exerciseGuide.familyCount(count);
  return (
    <View
      testID={`exercise-family-${family}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${name}, ${total}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        minHeight: 44,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderTopLeftRadius: radius.card,
        borderTopRightRadius: radius.card,
        backgroundColor: tint.background,
      }}
    >
      <FamilyGlyph family={family} size={20} color={tint.text} />
      <T variant="section" style={{ flex: 1, color: tint.text }}>
        {name}
      </T>
      <T variant="caption" style={{ color: tint.text, fontVariant: ["tabular-nums"] }}>
        {total}
      </T>
    </View>
  );
};
