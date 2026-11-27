import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import type { JumperPoseName } from "@tartan/design-tokens";
import { View } from "react-native";
import { errorMessage } from "../lib/errors";
import { Jumper } from "./jumper";
import { Button, ListSurface, T } from "./primitives";
import { radius, space, usePalette } from "./theme";

// Ces écrans servent une tâche : aucune animation de chargement. Un squelette fixe remplace le texte, des lignes à
// la place du contenu, pour que l'écran ne saute pas à l'arrivée des données. Le libellé reste pour les lecteurs
// d'écran.
const SkeletonRow = ({ wide }: { wide: boolean }) => {
  const p = usePalette();
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg }}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.button, backgroundColor: p.surfaceAlt }} />
      <View style={{ flex: 1, gap: space.sm }}>
        <View style={{ height: 12, width: wide ? "70%" : "48%", borderRadius: 6, backgroundColor: p.surfaceAlt }} />
        <View style={{ height: 10, width: wide ? "40%" : "30%", borderRadius: 5, backgroundColor: p.surfaceAlt }} />
      </View>
    </View>
  );
};

export const LoadingState = ({ label = m.common.loading, inline }: { label?: string; inline?: boolean }) => {
  const p = usePalette();
  const rows = inline ? 2 : 5;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ paddingVertical: inline ? space.sm : space.lg, flex: inline ? undefined : 1 }}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ borderRadius: radius.card, backgroundColor: p.surface, overflow: "hidden", paddingVertical: space.xs }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} wide={i % 2 === 0} />
        ))}
      </View>
    </View>
  );
};

export const ErrorState = ({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) => (
  <View
    accessibilityLiveRegion="polite"
    style={{ alignItems: "flex-start", gap: space.md, paddingVertical: space.xxl }}
  >
    <T variant="body">{message ?? errorMessage(error)}</T>
    {onRetry ? <Button label={m.common.retry} variant="secondary" compact onPress={onRetry} /> : null}
  </View>
);

// Un vide invite à agir : du texte, une action et la mascotte, sur une carte encre quel que soit le monde.
export const EmptyState = ({
  title,
  body,
  action,
  pose = "stand",
}: {
  title?: string;
  body: string;
  action?: ReactNode;
  pose?: JumperPoseName;
}) => (
  <ListSurface style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.lg }}>
    <View style={{ flex: 1, gap: space.md }}>
      {title ? (
        <T variant="title1" heading>
          {title}
        </T>
      ) : null}
      <T variant="body">{body}</T>
      {action}
    </View>
    <Jumper pose={pose} size={112} />
  </ListSurface>
);
