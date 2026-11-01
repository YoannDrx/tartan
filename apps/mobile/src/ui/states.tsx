import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { errorMessage } from "../lib/errors";
import { Button, T } from "./primitives";
import { space, usePalette } from "./theme";

export const LoadingState = ({ label = m.common.loading, inline }: { label?: string; inline?: boolean }) => {
  const p = usePalette();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: space.md,
        paddingVertical: inline ? space.lg : space.huge,
        flex: inline ? undefined : 1,
      }}
    >
      <ActivityIndicator color={p.text} size={inline ? "small" : "large"} />
      <T variant="small" tone="muted">
        {label}
      </T>
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

export const EmptyState = ({ title, body, action }: { title?: string; body: string; action?: ReactNode }) => (
  <View style={{ paddingVertical: space.xxl, gap: space.md }}>
    {title ? (
      <T variant="title1" heading>
        {title}
      </T>
    ) : null}
    <T variant="body" style={{ maxWidth: 320 }}>
      {body}
    </T>
    {action}
  </View>
);
