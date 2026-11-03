import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import type { JumperPoseName } from "@tartan/design-tokens";
import { View } from "react-native";
import { errorMessage } from "../lib/errors";
import { Jumper } from "./jumper";
import { Button, ListSurface, T } from "./primitives";
import { space } from "./theme";

// Ces écrans servent une tâche : un libellé fixe, aucune animation de chargement.
export const LoadingState = ({ label = m.common.loading, inline }: { label?: string; inline?: boolean }) => (
  <View
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel={label}
    style={{
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: inline ? space.lg : space.huge,
      flex: inline ? undefined : 1,
    }}
  >
    <T variant="small" tone="muted">
      {label}
    </T>
  </View>
);

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
